# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

ESPHome firmware-as-configuration for an ESP32 that autonomously runs a salt-pool (filtration, optional electrolyser, pH, ORP/Redox, booster). There is no application source, no test suite — the deliverable is the set of YAML presets at the repo root plus the reusable packages under [packages/](packages/). The ESP is authoritative: Home Assistant provides time and notifications but is not required for the pump to run.

`CLAUDE.md` itself is gitignored — it is a local agent guide, not a project artifact. Do not try to commit it.

## Documentation

`docs/index.html` is the user-facing installation and reference page. **Always update it when any of the following change**: sensor names or roles, configurable parameters (defaults, ranges), operational behaviour (antifreeze, sampling, swap mechanism, filtration modes), or the preset matrix. The page targets end-users — keep explanations simple and jargon-free.

## Common commands

All ESPHome commands are run from the repo root against a preset (`frangipool-*.yaml`) — never against a `packages/*.yaml` file (those lack `esphome:` top-level and will not validate standalone).

```bash
# Validate a preset's configuration (Python ESPHome CLI required)
esphome config frangipool-erp.yaml

# Compile firmware (caches under .esphome/)
esphome compile frangipool-erp.yaml

# Upload OTA and stream logs
esphome run frangipool-erp.yaml
esphome logs frangipool-erp.yaml
```

CI pins ESPHome to `esphome==2026.3.3` in [.github/workflows/validate.yml](.github/workflows/validate.yml) — match it locally when validating changes you intend to merge.

### Validating local package edits

Presets use `!include packages/<name>.yaml` — they always resolve against the working tree. A plain `esphome config frangipool-erp.yaml` validates the local packages directly, no URL rewriting needed.

### Dallas probe addressing

Presets ship with `temp_address: "0x0000000000000000"`. Flash as-is over USB, open `esphome logs <preset>`, and the 1-Wire bus scan prints discovered probe addresses at boot. Substitute those addresses into the preset's `substitutions:` block.

## Architecture

### Preset → packages composition

The eight `frangipool-*.yaml` files at the repo root are thin composition layers. Each defines only:

- `substitutions:` (device name, Dallas addresses)
- `esphome.project` (preset name + version)
- `dashboard_import.package_import_url` (for ESPHome Dashboard "Use a project")
- `packages:` list — which modules to import from [packages/](packages/)

All logic lives in the eight package files. When adding hardware variants, create a new preset with the appropriate package combo; do **not** duplicate logic into the preset.

| Package | Responsibility |
| --- | --- |
| [packages/base.yaml](packages/base.yaml) | Always included. WiFi/AP, encrypted API, OTA, captive portal, Dallas 1-Wire bus on GPIO23, pump switch on GPIO25 (active-LOW), antifreeze `binary_sensor`, `pool_temp` (sampled during pumping), uptime/RSSI diagnostics. |
| [packages/filtration.yaml](packages/filtration.yaml) | Authoritative pump scheduler: `_calcul_filtration` script + `interval: 30s` loop, mode select (Off/Hiver/Courbe/Auto), force-duration buttons, `force_filtration` / `recalc_filtration` HA API actions. |
| [packages/i2c_ads1115.yaml](packages/i2c_ads1115.yaml) | I²C on GPIO21/22 + ADS1115 @ `0x48`. Required by `redox` and `ph`. |
| [packages/electrolyser.yaml](packages/electrolyser.yaml) | GPIO27 relay (NOT inverted — `RESTORE_DEFAULT_ON` intentionally). Pure actuator; policy lives in `redox_electrolyser.yaml`. |
| [packages/redox.yaml](packages/redox.yaml) | ORP sensor on ADS1115 A0, calibration buttons (225 mV / 475 mV / reset). `pool_redox` is sampled once per minute from `realtime_redox` only when pump uptime ≥ `pump_uptime_delay`. |
| [packages/ph.yaml](packages/ph.yaml) | pH sensor on ADS1115 A1, two-point calibration (pH 7 + pH 4) computing slope and intercept. Factory defaults `g_ph_slope = 3.56`, `g_ph_intercept = -1.889`. Calibration result code persisted as `g_ph_last_result_code` (int enum). |
| [packages/redox_electrolyser.yaml](packages/redox_electrolyser.yaml) | Auto-regulation policy for the electrolyser (see below). |
| [packages/booster.yaml](packages/booster.yaml) | GPIO26 booster pump relay (active-LOW). |

### Pump authority model

`switch.pump` (alias `id: pump` in `base.yaml`) is **scheduler-owned**: the only authoritative writer is the `interval: 30s` lambda in `packages/filtration.yaml`. Priority order inside that lambda, top-down:

1. Decrement `g_forced_remaining_s` (counts down even during antifreeze — prevents "frozen" forced timers).
2. **Antifreeze** (`id(antifreeze).state`) → `pump.turn_on()`, return. Runs even without NTP sync.
3. **Forced mode** (`g_forced_remaining_s > 0`) → `pump.turn_on()`, return.
4. **Mode = Off** → `pump.turn_off()`, return. Checked before the NTP guard on purpose.
5. **NTP guard** (`!now.is_valid()`) → `pump.turn_off()`; the `_ntp_alert_once` latch posts a one-shot HA notification.
6. Cycle matches morning/evening window → `pump.turn_on()`.
7. Otherwise → `pump.turn_off()`, and if we just exited a window, fire `_calcul_filtration` to refresh the next window.

Any new code that writes to `pump` (e.g. a new forced button, an HA API action) must go through the scheduler's globals (`g_forced_remaining_s`, `filtration_mode`) instead of calling `id(pump).turn_on/off()` directly, or it will race with the 30 s tick.

### Electrolyser regulation: hysteresis with pump-uptime gate

`packages/redox_electrolyser.yaml` regulates the chlorine electrolyser with pure hysteresis on `pool_redox`. The historical "fast OFF / slow ON with 30-min stability gate" was removed because the pump-uptime sampling in `packages/redox.yaml` was already filtering transient noise, making the second-stage debouncer redundant and confusing.

Current model:

- **`interval: 1min`** is the authoritative regulator. In Auto mode, after early-returning when pump is OFF or `pump_uptime < pump_uptime_delay`, it applies hysteresis: `pool_redox > setpoint → turn_off`, `pool_redox < setpoint - 30 → turn_on`, otherwise hold state.
- **`sensor.pool_redox.on_value_range.above`** kept as a sub-second OFF safety net for over-chlorination — single-direction writer (OFF only), does not contradict the interval.
- **`select.electrolyser_mode.on_value`** handles Off/Forcé immediately. The Auto branch only applies an immediate OFF if `pool_redox > setpoint`; otherwise it delegates to the next interval tick.

When editing any `electrolyser.turn_on` / `electrolyser.turn_off` call, enumerate all five writer types and verify each one is consistent: `on_value_range`, `interval`, `select.on_value` (including Auto/else branches), `button.on_press`, and `api.actions`. Any new writer must not bypass or contradict the `interval: 1min` authoritative regulator.

### Safety-critical lambda pattern (NaN guards)

Template sensors / binary_sensors that read Dallas probes (e.g. `pipe_temp_raw`) must guard `std::isnan` at the top of the lambda and return the last known state — returning `false` unconditionally silently locks an antifreeze latch OFF forever on probe failure. `filters: delayed_on/delayed_off` and `device_class: cold` do **not** help here — NaN short-circuits the comparisons before the filters ever see an edge.

### ESPHome `script:` mode selection

For any script with more than ~3 trigger sources, default to `mode: restart` provided the lambda is pure (reads current entity state, writes globals + `component.update` at the end). `_calcul_filtration` is the canonical example — its 10 triggers (mode select, 5 number entities, pivot datetime, time sync, midnight cron, end-of-window) coalesce correctly under `restart`.

Do **not** use `mode: queued` with `max_runs: 1` — that combination silently drops triggers during bursts (HA slider drag produces `script already running, discarding trigger` warnings in the logs with no visible failure).

### Conventions baked into the code

- **Globals prefix `g_`.** All package-level globals use `g_` so `id(g_foo)` is visually distinct from entity IDs. Preserve this when adding globals.
- **Active-LOW relays.** Pump (GPIO25) and booster (GPIO26) use `inverted: true`. The electrolyser (GPIO27) is deliberately **not** inverted and uses `RESTORE_DEFAULT_ON`. Do not "normalize" these — the hardware differs.
- **`pool_temp` / `pool_redox` / `pool_ph` are sampled, not live.** The `realtime_*` / raw sensors are continuous; the `pool_*` variants latch via `g_store_*` only when the pump has been running longer than `pump_uptime_delay` (default 20 min). Regulation logic should read the sampled values unless it needs the live signal.
- **Notifications use `homeassistant.action: persistent_notification.create`** wrapped in an `api.connected:` check (see `_ntp_alert_once`, `_invalid_window_alert_once`) so they don't fire into the void during API outages. Latch a "sent" global and clear it when the condition resolves.
- **Persisted string states use `int` enum globals, not `std::string`.** ESPHome NVS slots are fixed-size; a `std::string` with `restore_value: true` can be silently truncated or empty after reboot. Encode the finite set of states as `int` codes and decode to strings in a `text_sensor` template lambda (`switch/case`). Canonical example: `g_ph_last_result_code` in `packages/ph.yaml`.

### Persistent vs ephemeral state

A handful of globals intentionally differ in `restore_value` — changing these will regress recovery behaviour:

- `g_auto_submode`, `g_auto_initialized` → **restore** (keep seasonal hysteresis state across reboots).
- `g_forced_remaining_s` → **do not restore** (force modes are ephemeral by design — spec R8).
- `g_ntp_alert_sent`, `g_invalid_window_alert_sent` → **do not restore** (re-alert after reboot).
- `g_h_debut1/fin1/debut2/fin2`, `g_cycle_phase` → **do not restore** (recomputed on every boot via the `on_time_sync` trigger).
- `g_ph_slope`, `g_ph_intercept`, `g_v_ph7`, `g_v_ph4`, `g_ph_last_result_code` → **restore** (pH calibration survives reboots and OTA).
- `g_ph_calibration_in_progress`, `g_ph_abort` → **do not restore** (script execution state — ephemeral).

### Home Assistant dashboard

[homeassistant/dashboard/frangipool.yaml](homeassistant/dashboard/frangipool.yaml) is a Lovelace raw-config dashboard that assumes the entity-ID prefix `frangipool_*`. When renaming a device, every occurrence needs substituting (dashes in `name` become underscores in HA entity IDs). The dashboard auto-hides optional sections (pH, Redox, Booster, electrolyser regulation) based on entity presence, so it works across all eight presets unchanged.

Default to **dropping dashboard references** rather than re-adding firmware entities that YAGNI already removed — do not resurrect a package entity just to satisfy a dashboard card; delete the card instead.

### Release CI workflow invariants

The guards in the release workflows are intentional — do not remove them:

- **Tag on `origin/main` only** — the refname-exact check (`grep -Fxq 'refs/remotes/origin/main'`) prevents releases from feat branches. Always tag a commit already on `main`.
- **Idempotence guard** — `gh release view` before creating prevents silent overwrites on force-retag. To retag: `gh release delete vX.Y.Z --yes && git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`, then re-tag.
- **Prev-tag by name, not position** — `grep -v -Fx "$current_tag"` skips the current tag by name so forward-looking retags compute the correct diff window.
- **`pcb-0.1.0` is a seed anchor** — never delete or move it. It is the base for `git tag --list 'pcb-*'` prev-tag computation. The workflow skips it via an explicit guard.
- **Shared concurrency group `release-main`** — both firmware and PCB workflows share it to prevent CHANGELOG auto-commit races on simultaneous tag pushes.
- **CHANGELOG commit before release publish** — `stefanzweifel/git-auto-commit-action` runs before `ncipollo/release-action` so the release notes SHA matches the committed file.
- **`makeLatest: legacy` for firmware, `false` for PCB** — GitHub's semver comparison keeps the highest firmware version as "latest"; PCB releases must never steal that badge.

## Where to find more context

- [README.md](README.md) — user-facing documentation (preset matrix, installation, filtration spec, HA migration v1.x → v2.0).
- [todos/](todos/) — gitignored local work queue; read-only reference when working on a matching topic.
