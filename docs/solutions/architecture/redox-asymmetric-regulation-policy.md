---
title: Asymmetric ORP regulation policy — fast OFF, gated ON (eliminate parallel control paths)
category: architecture
date: 2026-04-21
last_updated: 2026-04-21
module: redox_electrolyser
component: regulation-loop
tags: [esphome, regulation, hysteresis, noise-filtering, dead-code, control-loop, functional-safety, pool-chemistry, asymmetric-control]
related_commits: [40156a6, 4358410]
related_todos: ["003"]
problem_type: logic_error
---

## Problem

`packages/redox_electrolyser.yaml` regulated the chlorine electrolyser through three parallel paths that contradicted each other. The `sensor.pool_redox.on_value_range` block contained a `below: setpoint-30 → turn_on` trigger that fired immediately on any threshold crossing, bypassing the `redox_stable_minutes >= 30` gate enforced by the `interval: 1min` regulator. The stability counter was therefore effectively dead code despite being the author's apparent intent. Safety implication: the chlorine generator reacted to transient ORP noise (sensor jitter, water agitation, short dips), risking over-chlorination — the worst failure mode for a pool.

## Root cause

The parallel paths each had a legitimate-looking purpose, which is why the contradiction hid. Initially two writers to `turn_on` were identified: `on_value_range` (which fires on threshold *crossings* — immediate, edge-triggered) and `interval: 1min` (which polls *current state* with a 30-min stability gate — delayed, level-triggered). They were written to cover different scenarios — crossing vs. sustained state — but since any sustained dip must cross the threshold first, the edge trigger *always* fires before the poll can accumulate stable minutes. The gate was unreachable.

A later code review (PR #6, commit `4358410`) revealed a **third writer** that the initial fix missed: `select.electrolyser_mode.on_value` — the mode-transition handler. Its Auto branch called `electrolyser.turn_on()` immediately whenever ORP was below setpoint at mode-switch time, bypassing the 30-min gate exactly like the deleted `on_value_range below:` trigger did. This writer was harder to spot because its primary job is legitimate (handling Off→Auto→Forcé transitions on user input), so "it handles mode transitions" got coded as "not part of the conflict" — even though its Auto else-branch was doing conditional regulation based on ORP state. The lesson: "grep all writers" must literally mean all `turn_on` / `turn_off` callers across every trigger type, not just the ones that obviously regulate.

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

The `interval: 1min` block is unchanged: it increments `g_redox_stable_minutes` when `g_redox_trend_state <= 0`, then calls `turn_on()` only once `stable_minutes >= 30` and ORP is still below `setpoint-30`. Its `turn_off()` branch remains as the backstop for the Off→Auto-with-high-ORP case where no crossing event exists to trigger the fast-OFF path.

### Second bypass: `select.on_value` Auto branch (fixed in commit `4358410`)

Before — the Auto branch of the mode-transition handler had its own ORP-conditional `turn_on`, which bypassed the 30-min gate identically to the deleted `on_value_range below:` trigger:

```yaml
select:
  - platform: template
    name: Mode Electrolyseur
    id: electrolyser_mode
    on_value:
      - lambda: |-
          if (id(electrolyser_mode).state == "Off") {
            id(electrolyser).turn_off();
          } else if (id(electrolyser_mode).state == "Forcé") {
            id(electrolyser).turn_on();
          } else {
            if (id(pool_redox).state > id(redox_setpoint).state) {
              id(electrolyser).turn_off();
            } else {
              id(electrolyser).turn_on();   # DELETED — second bypass of the 30-min gate
            }
          }
```

After — fast-OFF backstop kept, ON authority fully delegated to the gated interval, and the stability counter reset on every mode transition so the gate starts measuring from the actual Auto-activation moment:

```yaml
select:
  - platform: template
    on_value:
      - lambda: |-
          if (id(electrolyser_mode).state == "Off") {
            id(electrolyser).turn_off();
          } else if (id(electrolyser_mode).state == "Forcé") {
            id(electrolyser).turn_on();
          } else {
            // Mode Auto : laisser l'intervalle régulateur (gate 30 min) décider du turn_on.
            // On coupe si l'ORP est déjà au-dessus du setpoint (filet OFF rapide)
            // et on réinitialise le compteur de stabilité.
            if (id(pool_redox).state > id(redox_setpoint).state) {
              id(electrolyser).turn_off();
            }
            id(g_redox_stable_minutes) = 0;
          }
```

The counter-reset is important: without it, a user toggling Off→Auto could "inherit" stability minutes accumulated while the mode was Off, and the interval would turn the electrolyser on within minutes of mode switch even though no real 30-min window has elapsed since the user's intent became active.

## Prevention

### Design rules

- **Name the authoritative handler per direction.** When multiple automations write to the same actuator, explicitly document which path owns ON and which owns OFF. Concurrent writers without a direction contract produce dead code or race conditions.
- **Enumerate writer *types*, not just trigger instances.** A "grep all writers" rule is only as effective as the list of writer types the reviewer knows to enumerate. For any actuator in this codebase, the writer types are: `on_value_range` triggers (edge), `interval` lambdas (level-triggered polling), `select.on_value` mode-transition handlers (including the else/default Auto branch, which can carry conditional regulation that looks like "just a transition"), `button.on_press` lambdas (including HA-exposed force buttons), and `api.actions` blocks. **Grep all five before trusting any gate.** The first asymmetric-policy fix missed the `select.on_value` Auto branch for exactly this reason (see Second bypass in Solution).
- **Mode-transition handlers must reset state that gates like to assume fresh.** When an on_value Auto branch rejoins a gated loop (like the 30-min `g_redox_stable_minutes` counter), it must reset that counter — otherwise stability accumulated during prior modes carries over and the gate measures the wrong window. Model the mode transition as "start from scratch under new intent."
- **Asymmetric policy for safety-critical loops.** The direction with the worse failure mode (here: `turn_on` → chlorine release → over-chlorination) must require stronger evidence (30 min stability) than the safer direction (`turn_off` → fast, unconditional). Encode the asymmetry; don't average it away.
- **Document the asymmetry at the file head.** A short comment block explaining "fast OFF via range / slow ON via interval-gated stability" prevents well-intentioned refactors from collapsing it back into the simpler (and broken) symmetric form.

### Review checklist

1. Does the PR add or modify any `electrolyser.turn_on` / `turn_off` call? Enumerate the location by writer type:
   - `on_value_range` (sensor threshold crossings)
   - `interval` lambdas (level-triggered polling)
   - `select.on_value` mode handlers (including Auto / else branches that look like "just a transition")
   - `button.on_press` lambdas (including HA-exposed force buttons)
   - `api.actions` (force/recalc callable from HA automations)
2. For each `turn_on` call found above: is it gated by `g_redox_stable_minutes >= 30` (or an equivalent debouncer)? If no gate, is it the explicitly documented Forcé-mode escape hatch? Anything else is a bypass.
3. Are `turn_off` paths kept fast and unconditional (no stability gate on the safer direction)?
4. Does `on_value_range` have both `above` and `below` branches, or only the safe-direction one (this PR: only `above`)?
5. Does every `select.on_value` Auto branch reset `g_redox_stable_minutes` to 0? Without this reset, stability minutes carry over from prior modes and the gate measures the wrong window.
6. Is the mode-transition backstop (interval re-evaluates on `Off → Auto`) preserved?

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
- Fix commit `40156a6` — `fix(redox): asymmetric regulation policy — fast OFF, slow ON` (first bypass: `on_value_range below:` removed).
- Follow-up fix commit `4358410` — `fix(review): apply ce-code-review findings on PR #6` (second bypass: `select.on_value` Auto branch removed; stability-counter reset added).
- [antifreeze-nan-silent-failure.md](antifreeze-nan-silent-failure.md) — sibling architectural learning from the same PR; another single-writer-per-safety-input pattern in this codebase.
- `README.md` line 164 — user-facing redox setpoint description; wording "s'active à -30 mV et se coupe à la consigne" remains accurate in intent but may warrant a clarifying sentence about the 30-min stability gate for future reads.
