---
title: Asymmetric ORP regulation policy — fast OFF, gated ON (eliminate parallel control paths)
category: architecture
date: 2026-04-21
module: redox_electrolyser
component: regulation-loop
tags: [esphome, regulation, hysteresis, noise-filtering, dead-code, control-loop, functional-safety, pool-chemistry, asymmetric-control]
related_commits: [40156a6]
related_todos: ["003"]
problem_type: logic_error
---

## Problem

`packages/redox_electrolyser.yaml` regulated the chlorine electrolyser through three parallel paths that contradicted each other. The `sensor.pool_redox.on_value_range` block contained a `below: setpoint-30 → turn_on` trigger that fired immediately on any threshold crossing, bypassing the `redox_stable_minutes >= 30` gate enforced by the `interval: 1min` regulator. The stability counter was therefore effectively dead code despite being the author's apparent intent. Safety implication: the chlorine generator reacted to transient ORP noise (sensor jitter, water agitation, short dips), risking over-chlorination — the worst failure mode for a pool.

## Root cause

The three paths each had a legitimate-looking purpose, which is why the contradiction hid. `select.electrolyser_mode.on_value` handles user-initiated mode transitions (Off/Auto/Forcé) — this is necessary and not part of the conflict. The real conflict was between `on_value_range`, which fires on threshold *crossings* (immediate, edge-triggered), and `interval: 1min`, which polls *current state* with a 30-min stability gate (delayed, level-triggered). They were written to cover different scenarios — crossing vs. sustained state — but since any sustained dip must cross the threshold first, the edge trigger *always* fires before the poll can accumulate stable minutes. The gate was unreachable.

Chemistry context justifies the asymmetric fix: chlorine kinetics are slow (a 30-min delay on recovery is harmless; electrolyser output ramps over tens of minutes anyway), while overdose is hard to reverse and health-relevant. A real pool ORP-consumption event (swimmer load, sun, algae) lasts hours, not seconds, so the 30-min filter trades minor recovery lag for significant noise immunity.

## Solution

Asymmetric policy: fast OFF (overdose protection) via edge trigger, slow ON (noise filter) via the stability-gated interval. The `below: setpoint-30 → turn_on` edge trigger is deleted; the interval's OFF block is kept as a backstop for no-crossing cases (e.g. Off→Auto while ORP is already above setpoint).

Head comment added to `packages/redox_electrolyser.yaml` to document the policy:

```yaml
# Politique de régulation asymétrique :
#   OFF rapide (protection sur-chloration) : on_value_range above setpoint
#     → l'électrolyseur se coupe dès le franchissement supérieur (réaction en secondes).
#   ON lent (filtre bruit capteur) : interval 1min + redox_stable_minutes >= 30
#     → l'électrolyseur ne démarre qu'après 30 min de tendance Redox non-montante
#       (redox_trend_state <= 0) avec ORP < setpoint - 30 mV. Les dips transitoires
#       (bruit, agitation) sont ignorés.
# Le bloc OFF de l'interval sert de filet pour les cas sans franchissement
# (ex. passage Off → Auto alors qu'ORP est déjà au-dessus du setpoint).
```

Before — `sensor.pool_redox` extension had two triggers, one of them bypassing the gate:

```yaml
sensor:
  - id: !extend pool_redox
    on_value_range:
      - above: !lambda return id(redox_setpoint).state;
        then:
          - lambda: |-
              if (id(electrolyser_mode).state == "Auto") {
                id(electrolyser).turn_off();
              }
      - below: !lambda return id(redox_setpoint).state - 30;   # DELETED
        then:                                                   # DELETED
          - lambda: |-                                          # DELETED
              if (id(electrolyser_mode).state == "Auto") {      # DELETED
                if (id(redox_trend_state) != 1) {               # DELETED
                  id(electrolyser).turn_on();                   # DELETED
                }                                               # DELETED
              }                                                 # DELETED
```

After — single edge trigger for fast OFF; ON authority moves entirely to the gated interval:

```yaml
sensor:
  - id: !extend pool_redox
    on_value_range:
      - above: !lambda return id(redox_setpoint).state;
        then:
          - lambda: |-
              if (id(electrolyser_mode).state == "Auto") {
                id(electrolyser).turn_off();
              }
```

The `interval: 1min` block is unchanged: it increments `redox_stable_minutes` when `redox_trend_state <= 0`, then calls `turn_on()` only once `stable_minutes >= 30` and ORP is still below `setpoint-30`. Its `turn_off()` branch remains as the backstop for the Off→Auto-with-high-ORP case where no crossing event exists to trigger the fast-OFF path.

## Prevention

### Design rules

- **Name the authoritative handler per direction.** When multiple automations (`select.on_value`, `sensor.on_value_range`, `interval`) write to the same actuator, explicitly document which path owns ON and which owns OFF. Concurrent writers without a direction contract produce dead code or race conditions.
- **Grep all writers before trusting a gate.** A stability/cooldown condition is only as strong as the loosest writer to the same target. Before adding or "simplifying" a gate, search for every `switch.turn_on` / `switch.turn_off` targeting that entity and confirm none bypass the guard.
- **Asymmetric policy for safety-critical loops.** The direction with the worse failure mode (here: `turn_on` → chlorine release → over-chlorination) must require stronger evidence (30 min stability) than the safer direction (`turn_off` → fast, unconditional). Encode the asymmetry; don't average it away.
- **Document the asymmetry at the file head.** A short comment block explaining "fast OFF via range / slow ON via interval-gated stability" prevents well-intentioned refactors from collapsing it back into the simpler (and broken) symmetric form.

### Review checklist

1. Does the PR add/modify any trigger that writes to `electrolyser`? If so, which direction does it own?
2. Are all `turn_on` paths gated by `redox_stable_minutes >= 30` (or an equivalent debouncer)?
3. Are `turn_off` paths kept fast and unconditional (no stability gate on the safer direction)?
4. Does `on_value_range` have both `above` and `below` branches, or only the safe-direction one?
5. Is the mode-transition backstop (interval re-evaluates on `Off → Auto`) preserved?

### Bench scenarios

- Inject ORP dip for 15 min, restore: electrolyser stays OFF.
- Hold ORP below setpoint for > 30 min: electrolyser activates on next interval tick.
- ORP spike above setpoint: electrolyser OFF within one range-trigger cycle (seconds).
- Switch mode Off → Auto with ORP already above setpoint: electrolyser remains OFF; interval confirms within one poll.
- Toggle mode Auto → Off mid-stability-window: `redox_stable_minutes` resets cleanly.

## Related

- [docs/brainstorms/2026-04-21-redox-regulation-policy-requirements.md](../../brainstorms/2026-04-21-redox-regulation-policy-requirements.md) — Requirements doc for the asymmetric OFF-fast / ON-slow policy.
- [todos/003-completed-p1-redox-triple-regulation-loop-contradicts-itself.md](../../../todos/003-completed-p1-redox-triple-regulation-loop-contradicts-itself.md) — Original P1 issue writeup.
- Prior commit `b4849a0` — `refactor(redox): replace min/max thresholds with single setpoint`; unified the two thresholds that had previously masked the contradiction.
- Fix commit `40156a6` — `fix(redox): asymmetric regulation policy — fast OFF, slow ON`.
- `README.md` line 164 — user-facing redox setpoint description; wording "s'active à -30 mV et se coupe à la consigne" remains accurate in intent but may warrant a clarifying sentence about the 30-min stability gate for future reads.
