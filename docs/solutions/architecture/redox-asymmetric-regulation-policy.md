---
title: Asymmetric ORP regulation policy — fast OFF, gated ON (eliminate parallel control paths)
category: architecture
date: 2026-04-21
last_updated: 2026-04-26
module: redox_electrolyser
component: regulation-loop
tags: [esphome, regulation, hysteresis, noise-filtering, dead-code, control-loop, functional-safety, pool-chemistry, asymmetric-control, simplification]
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
2. For each `turn_on` call found above: is it inside the hysteresis interval (`pool_redox < setpoint - 30`, gated by mode = Auto, pump on, pump_uptime ≥ pump_uptime_delay) or the explicitly documented Forcé-mode escape hatch? Anything else is a bypass.
3. Are `turn_off` paths kept fast and unconditional (no stability gate on the safer direction, NaN/0 ORP folded into the OFF direction)?
4. Does `on_value_range` have both `above` and `below` branches, or only the safe-direction one (this PR: only `above`)?
5. Is the mode-transition backstop (interval re-evaluates on `Off → Auto`) preserved? Does the `select.on_value` Auto branch fail-safe to OFF on unknown ORP (NaN, 0 mV, or above-setpoint)?

### Bench scenarios (post-2026-04-26 simplification)

- First boot after factory flash with `g_store_pool_redox = 0.0`: electrolyser stays OFF for the full `pump_uptime_delay` window, then the regulator's NaN/0 guard skips until the sampler writes a real value.
- ORP dip shorter than one interval tick (≈ 60 s): electrolyser stays OFF (dip resolves before next regulator tick captures `pool_redox`).
- ORP sustained below `setpoint - 30`: electrolyser activates within ≤ 1 min (one interval tick after pump warm-up).
- ORP above setpoint with electrolyser ON: electrolyser turns OFF within ≤ 1 min — gated by the `pool_redox` template-sensor publish rate, not "sub-seconde". `on_value_range.above` and the interval-OFF have equivalent latency.
- Mode `Off → Auto` with `pool_redox` exactly at setpoint (boundary): electrolyser stays OFF (dead-band hold), no oscillation under ±1 mV jitter.

## Update 2026-04-26: stability gate removed

The 30-min stability counter (`g_redox_stable_minutes`) and the 5-min trend (`g_redox_trend_state`) were removed in [openspec/changes/simplify-redox-regulation/](../../../openspec/changes/simplify-redox-regulation/). The "ON path" is now a plain hysteresis decision in the `interval: 1min` block: `pool_redox > setpoint → turn_off`, `pool_redox < setpoint - 30 → turn_on`. The `on_value_range.above` fast-OFF safety net is **kept** as a single-direction writer (OFF only) — note its latency is ≤ 1 min (bounded by the `pool_redox` template-sensor publish rate), the same as the interval; the value of keeping it is event-style activation on threshold crossing rather than reduced latency. NaN/0 mV inputs are folded into the OFF direction in both the regulator and the `select.on_value` Auto branch (canonical pattern from [antifreeze-nan-silent-failure.md](antifreeze-nan-silent-failure.md)).

**Why**: in practice the pump-uptime sampling already filters the transient noise the 30-min gate was meant to absorb. `pool_redox` is only refreshed when `pump_uptime ≥ pump_uptime_delay` (default 20 min after each pump start), and the underlying `realtime_redox` is itself a 12-sample sliding window. Stacking another temporal debouncer on top made the regulator feel "random" from the user's perspective: a legitimate dip below the low threshold could remain ignored for 30 min, and a brief excursion above the high threshold reset the counter. The new policy is direct: the displayed `pool_redox` value is what the regulator acts on, every minute, after pump warm-up.

**What stays valid from this learning**:

- The "enumerate all five writer types" review checklist (on_value_range / interval / select.on_value / button.on_press / api.actions) — still the correct discipline for any new edit to the electrolyser actuator. There is just one less gate to verify against.
- The "name the authoritative handler per direction" design rule — still encoded in the new code: `interval: 1min` owns ON, OFF is owned by both the interval and the fast-OFF range trigger (single-direction asymmetry is preserved).
- The genealogy of bypass bugs (parallel control paths that look orthogonal but aren't) — kept here as a cautionary tale before reintroducing any debouncer in the future.

**What no longer applies**:

- The `g_redox_stable_minutes >= 30` gate and the requirement to reset it on mode transitions — both globals are gone.
- The "slow ON via stability gate" pattern as actually-implemented in this codebase — only the design rule (asymmetric severity by failure mode) survives; the specific 30-min instance was retired.

## Related

- [docs/brainstorms/2026-04-21-redox-regulation-policy-requirements.md](../../brainstorms/2026-04-21-redox-regulation-policy-requirements.md) — Requirements doc for the asymmetric OFF-fast / ON-slow policy.
- [todos/003-completed-p1-redox-triple-regulation-loop-contradicts-itself.md](../../../todos/003-completed-p1-redox-triple-regulation-loop-contradicts-itself.md) — Original P1 issue writeup.
- Prior commit `b4849a0` — `refactor(redox): replace min/max thresholds with single setpoint`; unified the two thresholds that had previously masked the contradiction.
- Fix commit `40156a6` — `fix(redox): asymmetric regulation policy — fast OFF, slow ON` (first bypass: `on_value_range below:` removed).
- Follow-up fix commit `4358410` — `fix(review): apply ce-code-review findings on PR #6` (second bypass: `select.on_value` Auto branch removed; stability-counter reset added).
- [antifreeze-nan-silent-failure.md](antifreeze-nan-silent-failure.md) — sibling architectural learning from the same PR; another single-writer-per-safety-input pattern in this codebase.
- `README.md` line 164 — user-facing redox setpoint description; wording "s'active à -30 mV et se coupe à la consigne" remains accurate and is now a literal description of the implementation (no caveat about a stability gate needed since 2026-04-26).
- [openspec/changes/simplify-redox-regulation/](../../../openspec/changes/simplify-redox-regulation/) — proposal, design and tasks for the 2026-04-26 simplification.
