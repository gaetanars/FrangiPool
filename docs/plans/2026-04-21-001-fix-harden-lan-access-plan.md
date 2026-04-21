---
title: Harden LAN access — secrets, API encryption, remove web_server & Improv
type: fix
status: active
date: 2026-04-21
origin: docs/brainstorms/2026-04-21-lan-access-hardening-requirements.md
todo: 001
---

# Harden LAN access — secrets, API encryption, remove web_server & Improv

## Overview

Close the unauthenticated LAN attack surface in `packages/base.yaml`: any device on the LAN can currently trigger the pump for 24 h, force the electrolyser into continuous chlorine generation, modify ORP setpoints, or flash arbitrary firmware. Resolution: introduce `!secret`-based credentials for WiFi/API/OTA/AP, remove `web_server:`, `improv_serial:`, `esp32_improv:`, commit a `secrets.example.yaml`, gitignore `secrets.yaml`, rewrite the affected README sections, and update CI to seed a secrets file before `esphome config`. Single PR, no migration path (no deployed fleet).

Carries forward decisions from the origin brainstorm: A+B+C maximal scope, Improv removed entirely (not gated), no transitional release (see origin: [docs/brainstorms/2026-04-21-lan-access-hardening-requirements.md](../brainstorms/2026-04-21-lan-access-hardening-requirements.md)).

## Problem Statement / Motivation

`packages/base.yaml` exposes write-capable entities over the LAN with zero authentication:

- `packages/base.yaml:20` — `api:` has no `encryption.key` (since ESPHome 2026.1 `api.password` is removed, encryption is the only supported auth).
- `packages/base.yaml:22-23` — `ota: - platform: esphome` has no `password`.
- `packages/base.yaml:32-34` — `web_server: port: 80, version: 3` has no `auth:`. CVE-2025-57808 (CVSS 7.3, patched in ESPHome 2025.8.1) was an auth-bypass against this exact component — a strong argument for removing it entirely.
- `packages/base.yaml:25-30` — `improv_serial:` + `esp32_improv: authorizer: none`. BLE-range attacker can push WiFi credentials.
- `packages/base.yaml:7-10` — WiFi AP fallback uses `password: "12345678"`, the canonical weak password.

PR #6 widens this blast radius with new write-capable entities (force 2h/6h/24h buttons, stop). Hardening must ship in the same PR so we don't publish additional remote controls behind an open door.

No units are deployed yet — breaking OTA/API compat is acceptable.

## Proposed Solution

Single PR, five changes:

1. **`packages/base.yaml`**: add `wifi.ssid`/`wifi.password` (top-level, currently absent), replace weak AP password, add `api.encryption.key`, add `ota.password`, delete `web_server:`, delete `improv_serial:`, delete `esp32_improv:`. Keep `captive_portal:` for AP-fallback recovery.
2. **`secrets.example.yaml`** (new, repo root): placeholders with **validation-passing shapes** — a real 32-byte base64 API key (all-zeros placeholder is fine), 8+ char AP password, non-empty SSID/WiFi/OTA password. `REPLACE_ME` strings fail ESPHome's API key validator.
3. **`.gitignore`**: add `secrets.yaml`.
4. **`.github/workflows/validate.yml`**: insert `cp secrets.example.yaml secrets.yaml` step before `esphome config` (no `--skip-secrets` flag exists in ESPHome).
5. **`README.md`**: remove "Interface web locale" section (lines 115-117), update `packages/base.yaml` description (line 170) to drop "interface web port 80, API/OTA/Improv" and replace with "API chiffrée, OTA passwordé, captive portal", add new "Secrets" section after "Substitutions" covering: copy `secrets.example.yaml` → `secrets.yaml`, generate API key via `openssl rand -base64 32`, note that first flash must be USB (Improv gone), warning that losing `secrets.yaml` requires USB reflash + HA re-adoption.

### End-state YAML (packages/base.yaml, security-relevant blocks)

```yaml
wifi:
  ssid: !secret wifi_ssid
  password: !secret wifi_password
  ap:
    ssid: ${friendly_name} Fallback Hotspot
    password: !secret ap_password

# ... unchanged: esp32, logger, time, one_wire, globals, number, sensor, binary_sensor, switch, button, status_led, interval ...

api:
  encryption:
    key: !secret api_encryption_key

ota:
  - platform: esphome
    password: !secret ota_password

# improv_serial removed
# esp32_improv removed

captive_portal:

# web_server removed
```

### End-state secrets.example.yaml

```yaml
# secrets.example.yaml — copy to secrets.yaml (gitignored) and fill in.
#
# Generate a fresh API encryption key before flashing:
#   openssl rand -base64 32
#
# DO NOT commit secrets.yaml.

wifi_ssid: "YourHomeWiFi"
wifi_password: "change-me-wifi-password"

# Fallback AP (active if home WiFi unreachable). WPA2 requires 8-63 chars.
# Anyone who joins this AP can re-flash firmware via captive_portal — use a strong value.
ap_password: "change-me-fallback-min8chars"

# ESPHome native-API Noise key. Exactly 32 bytes base64 (44 chars incl. padding).
# Placeholder below is all-zero-bytes base64 — REPLACE BEFORE FLASHING.
api_encryption_key: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

# OTA flash password. Any strong random string.
ota_password: "change-me-ota-password"
```

## Technical Considerations

- **ESPHome 2026.3.3** (pinned in CI): `api.password` is deprecated/removed; only `api.encryption.key` auth. `ota:` list form with `- platform: esphome` is current syntax.
- **`!secret` resolution**: relative to the entry YAML's directory (the `salt_*.yaml` at repo root), not the package file. `secrets.yaml` must live at repo root — already the natural location.
- **Missing `!secret` = compile error** (fail-fast at `esphome config`). Good — forces users to populate.
- **`captive_portal` auto-loads the web_server OTA platform** in AP fallback mode (ESPHome changelog 2025.7.0). It stays gated by `ap_password` only. Reinforces why the AP password must be strong.
- **Removing `esp32_improv:`** frees ~40-60 KB heap + ~80-100 KB flash and strips the BLE stack (no other component references `esp32_ble*` in this repo).
- **`api.reboot_timeout` default 15 min**: if HA can't reconnect (wrong key), the device reboots every 15 min. Recovery via USB still works. No override needed.
- **Logger does not auto-scrub `!secret` values** — secrets become literals at compile time. Current `logger.level: INFO` doesn't log credentials. No change needed, but note for future.
- **No other packages affected** — `packages/{filtration,electrolyser,redox,ph,booster,redox_electrolyser,i2c_ads1115}.yaml` have no `api`/`ota`/`web_server`/`improv` references.

## System-Wide Impact

- **Interaction graph**: removing `web_server` cuts off the HA dashboard card that iframes `http://<esp>/` (if any user had one). None in this repo's `homeassistant/dashboard/frangipool.yaml` — verified. HA integration (native API) continues working once re-adopted with the encryption key.
- **Error propagation**: `esphome config` now fails fast if `secrets.yaml` is missing/incomplete or if the API key is malformed. CI must provide a valid-shape file.
- **State lifecycle risks**: first flash order matters — if OTA password is set but user flashes via OTA with the old image that has no password, first OTA may succeed without auth, then subsequent OTAs require the password. Recommend documenting USB-first for the initial cutover (only affects the dev's own units since no fleet is deployed).
- **API surface parity**: only `packages/base.yaml` exposes network endpoints. `captive_portal` remains the sole HTTP surface, and only during AP fallback.
- **Integration test scenarios** (manual on-device after flash):
  1. `nmap -p 80,6053 <device_ip>` → 80 closed/filtered, 6053 open.
  2. `curl http://<device_ip>/button/filtration_force_24h/press` → connection refused.
  3. HA adoption without API key → fails. With correct key → succeeds.
  4. `esphome run` with wrong `ota_password` → rejected. Correct password → accepted.
  5. Force WiFi to wrong SSID → device enters AP fallback, captive portal reachable at 192.168.4.1 after joining AP with `ap_password`.

## Acceptance Criteria

### Config & build

- [ ] `packages/base.yaml` has `api.encryption.key: !secret api_encryption_key`.
- [ ] `packages/base.yaml` has `ota.password: !secret ota_password` on the `- platform: esphome` entry.
- [ ] `packages/base.yaml` top-level `wifi.ssid: !secret wifi_ssid` / `wifi.password: !secret wifi_password`.
- [ ] `packages/base.yaml` `wifi.ap.password: !secret ap_password` (no literal).
- [ ] `packages/base.yaml` contains no `improv_serial`, `esp32_improv`, or `web_server` blocks.
- [ ] `captive_portal:` is preserved.
- [ ] `secrets.example.yaml` exists at repo root with `wifi_ssid`, `wifi_password`, `ap_password`, `api_encryption_key`, `ota_password` keys and validation-passing shapes (API key is a real 32-byte base64 string, AP password ≥ 8 chars).
- [ ] `.gitignore` contains `secrets.yaml` on its own line.
- [ ] `grep -rn '12345678\|"frangipool"$' packages/` returns no credential-like literals.

### CI

- [ ] `.github/workflows/validate.yml` has a step `cp secrets.example.yaml secrets.yaml` before the `esphome config` step.
- [ ] All eight matrix jobs go green on the PR.

### Documentation (README.md)

- [ ] "Interface web locale" section (lines 115-117) is removed.
- [ ] `packages/base.yaml` row in the packages table no longer mentions "interface web port 80, API/OTA/Improv" — replaced with "API chiffrée, OTA passwordé, captive portal".
- [ ] New "Secrets" section exists (in French, matching README tone) covering:
  - Copy `secrets.example.yaml` → `secrets.yaml` at repo root.
  - Generate API key with `openssl rand -base64 32`.
  - First flash must be USB (Improv is gone).
  - `secrets.yaml` is gitignored.
  - Losing `secrets.yaml` requires USB reflash + HA re-adoption.
  - Captive portal recovery: if home WiFi fails, device exposes AP named `${friendly_name} Fallback Hotspot` protected by `ap_password` — joining it reaches the WiFi re-config form at `http://192.168.4.1/`.
- [ ] Import rapide / Substitutions sections reference the Secrets section as a prerequisite.

### On-device verification (documented, not automated)

- [ ] `nmap -p 80 <device_ip>` reports closed/filtered.
- [ ] `curl -X POST http://<device_ip>/button/filtration_force_24h/press` returns connection refused.
- [ ] HA adoption requires the API encryption key from `secrets.yaml`.
- [ ] `esphome run` without the OTA password fails.

## Success Metrics

- Zero unauthenticated LAN vectors for pump/electrolyser/OTA control after merge.
- CI matrix (8 configs) stays green.
- Flash-to-HA time for a new user (with README in hand) stays under 10 minutes.
- Firmware image: measurable heap increase post-boot (sanity check that BLE/web_server were truly stripped).

## Dependencies & Risks

- **Risk — user copies `secrets.example.yaml` unchanged**: device boots with known placeholder credentials. Mitigation: README step explicitly tells user to regenerate the API key; placeholder AP password is prefixed `change-me-` so it's visibly a placeholder.
- **Risk — CI rewrites github:// to !include, but real users keep pulling @main**: until this PR merges, deployed `dashboard_import` clients still fetch the old insecure `base.yaml` from `github://frangipool/esphome-config/...@main`. Acceptable since no deployed fleet exists. Separate issue: the github:// reference points to `frangipool/esphome-config` (not `gaetanars/FrangiPool`) — out of scope for this PR, flag in follow-up.
- **Risk — first OTA after merge**: if the dev already has a device flashed with the old image, the new image requires `ota_password` from `secrets.yaml` — once the new image is flashed, future OTAs are gated. Flash from USB for the cutover to avoid ambiguity.
- **Risk — `docs/` is gitignored**: this plan and the origin brainstorm are untracked. Not blocking the PR, but if the user wants these shared, `.gitignore` must be adjusted separately.
- **Dependency — `openssl`**: users need it installed to generate the API key. Available by default on macOS/Linux; README provides a Python fallback for Windows: `python -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"`.

## Sources & References

### Origin

- **Origin document:** [docs/brainstorms/2026-04-21-lan-access-hardening-requirements.md](../brainstorms/2026-04-21-lan-access-hardening-requirements.md). Key decisions carried forward:
  - A+B+C maximal hardening (remove Improv & web_server, not just passwords).
  - Improv removed entirely, not gated by GPIO/timer — consistent with "no deployed fleet" assumption.
  - Single PR, no transitional release.

### Todo

- [todos/001-pending-p1-unauthenticated-lan-access-pump-ota.md](../../todos/001-pending-p1-unauthenticated-lan-access-pump-ota.md) — original issue writeup with per-line findings.

### Internal References

- `packages/base.yaml:7-34` — target blocks.
- `.github/workflows/validate.yml:26,31-36` — pinned ESPHome 2026.3.3, github:// → `!include` rewrite, `esphome config` step.
- `.gitignore:1-3` — current ignores (`.esphome`, `CLAUDE.md`, `docs/`).
- `README.md:115-117,170` — sections to update.
- `homeassistant/dashboard/frangipool.yaml` — verified no references to ESP HTTP endpoint or Improv.

### External References

- ESPHome API: https://esphome.io/components/api.html
- ESPHome OTA esphome platform: https://esphome.io/components/ota/esphome.html
- ESPHome WiFi: https://esphome.io/components/wifi.html
- ESPHome captive_portal: https://esphome.io/components/captive_portal.html
- ESPHome esp32_improv: https://esphome.io/components/esp32_improv.html
- ESPHome security best practices: https://esphome.io/guides/security_best_practices.html
- CVE-2025-57808 (web_server auth bypass): https://www.miggo.io/vulnerability-database/cve/CVE-2025-57808
- 2023.2 API encryption migration thread: https://community.home-assistant.io/t/2023-2-esphome-deprecated-api-password-how-to-update-to-encryption-key/528886

### Related Work

- PR #6 (the current branch `feat/esphome-standalone-filtration`) — adds force 2h/6h/24h buttons that widened the attack surface.
- Follow-up out of scope: align `github://frangipool/esphome-config/...` references to `github://gaetanars/FrangiPool/...` across `salt_*.yaml`, README, and CI rewrite (tracked separately).
