---
title: ESPHome antifreeze binary_sensor silently stays OFF on Dallas NaN — isnan guard required
category: architecture
date: 2026-04-21
module: base
component: antifreeze-binary-sensor
tags: [esphome, nan, dallas, antifreeze, safety-logic, binary-sensor, fail-safe, lambda]
related_commits: [4358410]
related_todos: []
problem_type: logic_error
severity: high
symptoms:
  - "`pipe_temp_raw` publishes NaN on Dallas bus failure (probe disconnect, short, CRC error)"
  - "`binary_sensor.antifreeze` stays OFF for the entire sensor-failure window regardless of actual ambient temperature"
  - "No HA alert and no ESPHome log entry explicitly flags the silent OFF-lock"
  - "Pump never engages on the antigel path even when `pipe_temp_raw` would normally be below the setpoint"
root_cause: logic_error
resolution_type: code_fix
---

## Problem

The `antifreeze` binary_sensor in `packages/base.yaml` uses a latched hysteresis lambda that reads the Dallas-backed `pipe_temp_raw` sensor. When the Dallas bus fails — unplugged probe, short circuit, or CRC error — the sensor publishes `NaN`. In C++, every comparison involving NaN evaluates to `false`, so `t < on_threshold` never fires. If the antigel state is `false` at the moment of failure, it stays `false` for the entire failure duration with no indication, leaving the pipe at risk of freezing undetected. The filtration scheduler consults `id(antifreeze).state` as its highest-priority override in the 30 s interval, so a stuck-OFF antigel silently removes the last line of defense against frost damage.

## Symptoms

- `pipe_temp_raw` reports `NaN` in ESPHome logs and Home Assistant (visible as `unknown` or `unavailable` depending on HA version and entity config).
- `binary_sensor.antifreeze` remains OFF regardless of actual ambient conditions during the sensor-failure window.
- The filtration pump never engages on the antigel path even when temperatures would normally fall below the configured `max_antifreeze_temp` threshold.
- No alert, no HA notification, and no explicit ESPHome log entry flags the silent OFF-lock — the only upstream signal is the Dallas CRC warning (`[W] dallas.sensor: Got bad CRC` or similar), which is easy to miss during a winter outage.
- The failure mode is time-correlated with cold spells, exactly when antigel protection matters most.

## What didn't work

- **Relying on `filters: delayed_on / delayed_off`.** These filters operate on the boolean output of the lambda, after the comparison has already been evaluated. When NaN keeps both comparisons false, the lambda returns `state` (which is `false`) on every call, and the filters never see a rising edge to delay — they are invisible to the upstream failure.
- **Relying on `device_class: cold`.** `device_class` is a Home Assistant concept that affects display and grouping. It has no bearing on how ESPHome evaluates the lambda or how it handles internal sensor values. It does not introspect `NaN`.
- **Assuming NaN would propagate to a fail-safe state.** The intuition that "invalid input → false output" sounds like safe degradation, but for a latched hysteresis sensor that starts `false`, NaN-driven false comparisons simply lock the latch in place. The result is indistinguishable from "temperature is fine" — the worst possible silent failure mode.
- **Relying on a multi-agent code review to catch it.** (session history) Two prior code-review sessions on this branch (April 20 and April 21) ran seven-plus parallel reviewers each — none surfaced the `antigel` NaN failure mode. The architectural reviewer traced the `antifreeze → filtration_scheduler` contract as sound composition without examining the upstream lambda. This is worth naming: the lens that catches this specific class of bug is the adversarial/reliability lens ("what if the sensor returns NaN forever?"), not the architecture-contract lens.

## Solution

Add an explicit `std::isnan` guard at the top of the lambda, before any threshold comparison, that returns the current latched `state` on sensor failure. Returning the latched value is the only fail-soft choice: returning `false` unconditionally reproduces the bug; returning `true` unconditionally runs the pump indefinitely under a faulty sensor; returning the last confirmed state preserves whatever decision the controller had already committed to.

```yaml
  - platform: template
    name: Antigel
    device_class: cold
    id: antifreeze
    icon: mdi:snowflake-alert
    lambda: |-
      static bool state = false;

      float t = id(pipe_temp_raw).state;
      // Capteur Dallas injoignable : préserver l'état précédent plutôt que laisser NaN verrouiller OFF.
      if (std::isnan(t)) return state;

      float on_threshold  = id(max_antifreeze_temp).state - 1.0;
      float off_threshold = id(max_antifreeze_temp).state;

      if (!state && t < on_threshold) {
        state = true;
      } else if (state && t >= off_threshold) {
        state = false;
      }

      return state;
    filters:
      - delayed_on: 120s
      - delayed_off: 300s
```

The guard is placed before threshold computation so threshold reads on `max_antifreeze_temp` are also skipped, eliminating any secondary edge case where that numeric input could also be `NaN`.

## Why this works

IEEE 754 mandates that any ordered comparison (`<`, `>`, `<=`, `>=`, `==`) with a NaN operand returns `false`. This means neither branch of the hysteresis fires, and the lambda silently returns whatever `static bool state` currently holds — correct if `state` is `true`, actively dangerous if `state` is `false`. The `static bool state` variable already exists to implement hysteresis across lambda invocations; the `isnan` guard simply elevates it to a first-class fail-soft mechanism. When the sensor recovers and publishes a valid float, normal threshold evaluation resumes immediately. As a diagnostic side-channel, ESPHome continues emitting Dallas CRC warnings to the log during the failure window, giving engineers a visible signal even though the antigel state itself does not change.

The choice of "return the latched state" over "return `true` (fail-safe ON)" for this specific sensor is deliberate: the antifreeze binary_sensor drives the pump through the filtration scheduler's highest-priority override branch, which would cause the pump to run continuously under a sustained sensor failure if we defaulted to ON. For pool equipment the trade-off favors "preserve last known decision" — a sensor that was already flagging antigel stays ON under transient NaN (correct), and a sensor that was OFF stays OFF but the upstream Dallas CRC log warnings remain visible to engineers. Sensors with a different safety asymmetry (leak detector → should fail ON; flame detector → should fail ON) would choose `return true` instead; name that choice in a comment so it isn't reverted during a future refactor.

## Prevention

### The isnan-guard idiom (repo-local pattern)

Every `binary_sensor: platform: template` lambda in this repo that reads from a Dallas, I2C, ADS1115, or pulse-count sensor and branches on `<` / `>` / `<=` / `>=` must start with an explicit `std::isnan` check. This idiom is already established elsewhere in the firmware: `packages/filtration.yaml` uses the same pattern in `_calcul_filtration` (`bool temp_valid = !std::isnan(t);` around line 337) to guard the `pool_temp` read against first-boot bus sync gaps. (session history: the single-isnan early-return pattern was established by todo #022's resolve work earlier in the same PR — this antigel fix is the second application of that repo-canonical pattern.) Future sensor-gated safety lambdas should copy this shape:

```yaml
    lambda: |-
      static bool state = false;

      float t = id(some_numeric_sensor).state;
      // Fail-soft: preserve last known state on sensor loss.
      // Rationale: NaN on a bus sensor is transient; holding the last
      // confirmed state prevents both spurious ON and silent OFF lockout.
      // For a leak or flame detector, change the fallback to `return true`.
      if (std::isnan(t)) return state;

      // threshold comparisons follow
      return state;
```

### What filters don't cover

`delayed_on` / `delayed_off` are boolean-domain filters. They operate after the lambda returns. NaN lives upstream of them and is invisible to filters. A binary_sensor that reads a numeric sensor cannot rely on filters for NaN safety — the guard belongs in the lambda.

### Review checklist for any sensor-gated safety lambda

1. Does the input come from a bus that can drop (Dallas, I2C) or a reading that can go out-of-range (analog probe, pulse counter)?
2. Does the lambda branch on `<`, `>`, `<=`, or `>=` against that value?
3. If both are yes: add an `isnan` guard and document the explicit fallback behavior in a comment.

### Review-lens gap worth naming

(session history) The April 20 and April 21 code-review sessions on this branch ran architecture, security, performance, simplicity, patterns, agent-native, and docs reviewers — none caught this bug. The lens that caught it on April 21 was the adversarial + reliability lens running on PR #6. When reviewing sensor-driven firmware, add an explicit "what if this sensor returns NaN/forever" scenario to the reviewer mix rather than relying on generic architecture review to surface it.

### Follow-up (not in this PR)

Add a companion `binary_sensor` that fires ON when `pipe_temp_raw` has been NaN for > N minutes and wires `homeassistant.action: persistent_notification.create` so silent sensor failures surface to operators without requiring ESPHome log inspection.

## Related

- PR #6 review thread — fix applied in commit `4358410` (`fix(review): apply ce-code-review findings on PR #6`).
- [docs/solutions/architecture/esphome-script-mode-queued-vs-restart.md](esphome-script-mode-queued-vs-restart.md) — sibling ESPHome lambda-behavior gotcha from the same PR.
- [docs/solutions/architecture/redox-asymmetric-regulation-policy.md](redox-asymmetric-regulation-policy.md) — asymmetric safety regulation pattern from the same PR; adjacent lens on fail-safe defaults in pool-control firmware.
- `packages/filtration.yaml:337` — existing `std::isnan(t)` guard on `pool_temp` in `_calcul_filtration`; the repo-canonical NaN-defense idiom this fix follows.
- `packages/base.yaml:154` — the antigel isnan guard itself (this fix).
- ESPHome binary_sensor template reference: https://esphome.io/components/binary_sensor/template.html
- ESPHome Dallas component: https://esphome.io/components/sensor/dallas.html
