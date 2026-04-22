---
title: ESPHome script modes — `queued` + `max_runs: 1` drops triggers, does not coalesce
category: architecture
date: 2026-04-21
module: filtration
component: _calcul_filtration
tags: [esphome, script-modes, debouncing, coalescing, slider-drag, pure-computation, home-assistant]
related_commits: [223c9b8]
related_todos: ["017"]
problem_type: logic_error
---

## Problem

`_calcul_filtration` in `packages/filtration.yaml` is a pure recalc script triggered by every config entity's `on_value` (7 triggers total: mode select, coefficient, pause, ratio, hiver min, diviseur, pivot datetime), plus `on_time_sync`, midnight cron, and end-of-cycle from the 30 s interval. It was declared with `mode: queued` + `max_runs: 1` and a 4-line comment claiming the combination "absorbs bursts of simultaneous triggers into a single execution".

The claim is wrong. ESPHome's `mode: queued` means *at most `max_runs` executions are queued in addition to the currently running one*. With `max_runs: 1`, a rapid series of triggers produces: 1 running + 1 queued + **N dropped with a warning** — the last trigger is not guaranteed to be the one that wins. A Home Assistant slider drag of 25 steps (e.g. `Durée Pause` 0 → 12 h) yields 1 running + 1 queued + 23 dropped, and the final `g_h_debut*` / `g_h_fin*` can reflect an intermediate slider value, silently out of sync with what the user actually set.

## Root cause

The author's mental model was "queue up the triggers so I don't miss any". The real ESPHome semantics are: `queued` + `max_runs: N` keeps at most `N+1` runs scheduled; the rest go to the floor. For debouncing a burst down to one final run, `queued` + `max_runs: 1` is the worst of both worlds — you neither get single-run semantics nor coalesce-to-latest. `mode: single` silently drops all triggers during an in-flight run (same as the queued case but clearer). `mode: restart` cancels the in-flight run and restarts with current state, which is exactly the semantics the comment wanted.

`restart` is only safe when the script is *pure* — reads current entity state, writes globals + publishes sensors at the end, no partial-effect mid-flight side effects. `_calcul_filtration` meets this: the lambda does its full computation, then the `component.update:` actions fire *after* the lambda returns. Cancelling mid-lambda leaves no half-written state.

## Solution

Switch `_calcul_filtration` to `mode: restart` and drop `max_runs`. Replace the 4-line justification with a one-liner explaining why `restart` is safe here.

```yaml
# mode: restart — chaque nouveau trigger annule le calcul en cours ; le script est
# pur (écrit les globals + component.update en queue de lambda), donc l'annulation
# est sûre.
- id: _calcul_filtration
  mode: restart
  then:
    - lambda: |-
        # … computes g_h_debut*, g_h_fin*, etc. from current entity state …
    - component.update: filtration_duree_totale
    - component.update: filtration_horaires
    - component.update: filtration_auto_mode_actif
    - component.update: filtration_phase
```

Observed behaviour after the switch: a Home Assistant slider drag produces one final recalc matching the released slider value, no `dropped` warnings in the ESPHome log.

## Decision rule for future ESPHome scripts

| Script character | Correct `mode` |
|---|---|
| Pure computation — re-reads current state, writes at end (recalc, aggregation, decorator) | `restart` |
| One-shot side effect — notification, single network call, HA action fire-and-forget | `single` |
| Sequential pipeline — step A must complete before step B (e.g. timed servo choreography, multi-step calibration) | `queued` with `max_runs` ≥ expected burst depth |
| Long-running, independent instances permitted | `parallel` |

`queued` + `max_runs: 1` is almost always a mistake — it's behaviourally equivalent to `single` with extra warnings on dropped triggers. Prefer `single` if that's what you actually want; prefer `restart` if the script is pure and you want coalesce-to-latest.

## Prevention

- When writing or reviewing any ESPHome `script:` with `mode: queued`, ask: "what's the `max_runs` covering?" If the answer is "I want to absorb bursts into one run", it's the wrong mode — switch to `restart` (pure scripts) or `single` (one-shot).
- If a script has more than 3 trigger sources, `restart` is almost certainly right. Enumerate the trigger sources before picking the mode.
- Watch the ESPHome log during UI testing for `script X is already running, discarding triggers` — it's the tell that `max_runs` is being hit.
- If you land on `queued` with `max_runs > 1`, document the *burst depth justification* in the comment — otherwise future readers (or the next author adding a trigger) won't know whether bumping the value further is safe.

## Related

- `packages/filtration.yaml:306-314` — post-fix state.
- `docs/solutions/architecture/redox-asymmetric-regulation-policy.md` — sibling architectural policy doc in the same repo.
- ESPHome script modes reference: https://esphome.io/components/script.html#script-modes
