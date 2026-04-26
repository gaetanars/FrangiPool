# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

ESPHome firmware-as-configuration for an ESP32 that autonomously runs a salt-pool (filtration, optional electrolyser, pH, ORP/Redox, booster). There is no application source, no test suite — the deliverable is the set of YAML presets at the repo root plus the reusable packages under [packages/](packages/). The ESP is authoritative: Home Assistant provides time and notifications but is not required for the pump to run.

`CLAUDE.md` itself is gitignored — it is a local agent guide, not a project artifact. Do not try to commit it.

## Common commands

All ESPHome commands are run from the repo root against a preset (`salt_*.yaml`) — never against a `packages/*.yaml` file (those lack `esphome:` top-level and will not validate standalone).

```bash
# Validate a preset's configuration (Python ESPHome CLI required)
esphome config salt_full.yaml

# Compile firmware (caches under .esphome/)
esphome compile salt_full.yaml

# Upload OTA and stream logs
esphome run salt_full.yaml
esphome logs salt_full.yaml
```

CI pins ESPHome to `esphome==2026.3.3` in [.github/workflows/validate.yml](.github/workflows/validate.yml) — match it locally when validating changes you intend to merge.

### Validating local package edits

By default every preset pulls packages from `github://gaetanars/FrangiPool/packages/<name>.yaml@main`. A plain `esphome config salt_full.yaml` therefore validates against **`main`**, not your working tree — a package edit will appear to "work" but actually wasn't loaded. CI rewrites the URLs to local includes before validating:

```bash
# Replicate CI locally: point the preset at on-disk packages for validation
sed -i '' 's|github://gaetanars/FrangiPool/packages/\(.*\)\.yaml@main|!include packages/\1.yaml|g' salt_full.yaml
esphome config salt_full.yaml
# ...then `git checkout salt_full.yaml` to revert the URL rewrite.
```

(macOS `sed` requires the empty `-i ''`; CI runs Linux `sed -i` without the argument.)

A `secrets.yaml` must exist at the repo root for any validate/compile call. Seed from the example:

```bash
cp secrets.example.yaml secrets.yaml   # placeholder values pass schema but are unsafe to flash
```

The real API key must be exactly 32 bytes base64 — generate with `openssl rand -base64 32`.

### Dallas probe addressing

Presets ship with `temp_address: "0x0000000000000000"`. Flash as-is over USB, open `esphome logs <preset>`, and the 1-Wire bus scan prints discovered probe addresses at boot. Substitute those addresses into the preset's `substitutions:` block.

## Architecture

### Preset → packages composition

The eight `salt_*.yaml` / `salt_booster_*.yaml` files at the repo root are thin composition layers. Each defines only:
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
| [packages/redox.yaml](packages/redox.yaml) | ORP sensor on ADS1115 A0, calibration buttons (225 mV / 475 mV / reset), 5-min trend `g_redox_trend_state`. |
| [packages/ph.yaml](packages/ph.yaml) | pH sensor on ADS1115 A1, single-point calibration at 7.00. |
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

### Electrolyser regulation: asymmetric policy

`packages/redox_electrolyser.yaml` implements **fast OFF, slow ON** by design ([docs/solutions/architecture/redox-asymmetric-regulation-policy.md](docs/solutions/architecture/redox-asymmetric-regulation-policy.md)):

- **OFF** is edge-triggered via `sensor.pool_redox.on_value_range.above` and by mode-transition handlers — reacts in seconds to over-chlorination risk.
- **ON** is *only* reachable through the `interval: 1min` block, gated by `g_redox_stable_minutes >= 30` AND `g_redox_trend_state <= 0` AND `ORP < setpoint - 30 mV` AND pump running past `pump_uptime_delay`.

When editing any `electrolyser.turn_on` / `electrolyser.turn_off` call, enumerate all five writer types before trusting the gate: `on_value_range`, `interval`, `select.on_value` (including Auto/else branches), `button.on_press`, and `api.actions`. The code review checklist in the linked doc is the authoritative version. Also: `select.on_value` Auto branches **must** reset `g_redox_stable_minutes = 0` so the gate starts measuring from mode-switch time, not from stale prior-mode minutes.

### Safety-critical lambda pattern (NaN guards)

Template sensors / binary_sensors that read Dallas probes (e.g. `pipe_temp_raw`) must guard `std::isnan` at the top of the lambda and return the last known state — returning `false` unconditionally silently locks an antifreeze latch OFF forever on probe failure ([docs/solutions/architecture/antifreeze-nan-silent-failure.md](docs/solutions/architecture/antifreeze-nan-silent-failure.md)). `filters: delayed_on/delayed_off` and `device_class: cold` do **not** help here — NaN short-circuits the comparisons before the filters ever see an edge.

### ESPHome `script:` mode selection

For any script with more than ~3 trigger sources, default to `mode: restart` provided the lambda is pure (reads current entity state, writes globals + `component.update` at the end). `_calcul_filtration` is the canonical example — its 10 triggers (mode select, 5 number entities, pivot datetime, time sync, midnight cron, end-of-window) coalesce correctly under `restart`.

Do **not** use `mode: queued` with `max_runs: 1` — that combination silently drops triggers during bursts (HA slider drag produces `script already running, discarding trigger` warnings). Full rationale + decision table in [docs/solutions/architecture/esphome-script-mode-queued-vs-restart.md](docs/solutions/architecture/esphome-script-mode-queued-vs-restart.md).

### Conventions baked into the code

- **Globals prefix `g_`.** All package-level globals use `g_` so `id(g_foo)` is visually distinct from entity IDs. Preserve this when adding globals.
- **Active-LOW relays.** Pump (GPIO25) and booster (GPIO26) use `inverted: true`. The electrolyser (GPIO27) is deliberately **not** inverted and uses `RESTORE_DEFAULT_ON`. Do not "normalize" these — the hardware differs.
- **`pool_temp` / `pool_redox` / `pool_ph` are sampled, not live.** The `realtime_*` / raw sensors are continuous; the `pool_*` variants latch via `g_store_*` only when the pump has been running longer than `pump_uptime_delay` (default 20 min). Regulation logic should read the sampled values unless it needs the live signal.
- **Notifications use `homeassistant.action: persistent_notification.create`** wrapped in an `api.connected:` check (see `_ntp_alert_once`, `_invalid_window_alert_once`) so they don't fire into the void during API outages. Latch a "sent" global and clear it when the condition resolves.

### Persistent vs ephemeral state

A handful of globals intentionally differ in `restore_value` — changing these will regress recovery behaviour:

- `g_auto_submode`, `g_auto_initialized` → **restore** (keep seasonal hysteresis state across reboots).
- `g_forced_remaining_s` → **do not restore** (force modes are ephemeral by design — spec R8).
- `g_ntp_alert_sent`, `g_invalid_window_alert_sent` → **do not restore** (re-alert after reboot).
- `g_h_debut1/fin1/debut2/fin2`, `g_cycle_phase` → **do not restore** (recomputed on every boot via the `on_time_sync` trigger).

### Home Assistant dashboard

[homeassistant/dashboard/frangipool.yaml](homeassistant/dashboard/frangipool.yaml) is a Lovelace raw-config dashboard that assumes the entity-ID prefix `frangipool_*`. When renaming a device, every occurrence needs substituting (dashes in `name` become underscores in HA entity IDs). The dashboard auto-hides optional sections (pH, Redox, Booster, electrolyser regulation) based on entity presence, so it works across all eight presets unchanged.

Default to **dropping dashboard references** rather than re-adding firmware entities that YAGNI already removed — do not resurrect a package entity just to satisfy a dashboard card; delete the card instead.

## Where to find more context

- [README.md](README.md) — user-facing documentation (preset matrix, substitutions, secrets workflow, full filtration spec, HA migration v1.x → v2.0).
- [docs/solutions/](docs/solutions/) — documented solutions to past problems (post-mortems, design patterns, workflow learnings) organized by category (`architecture/`, `design-patterns/`, …) with YAML frontmatter (`module`, `tags`, `problem_type`). Re-read before touching the antifreeze lambda, the ORP regulator, multi-trigger scripts, or making decisions in any documented area.
- [docs/plans/](docs/plans/) and [docs/brainstorms/](docs/brainstorms/) — requirements docs and implementation plans for recent or in-flight changes.
- [todos/](todos/) — gitignored local work queue; read-only reference when working on a matching topic.
