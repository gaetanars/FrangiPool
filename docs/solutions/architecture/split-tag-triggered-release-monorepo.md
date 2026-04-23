---
title: Splitting a tag-triggered release workflow in a monorepo — seed-tag anchoring, prev-tag by name, and shared concurrency
category: architecture
date: 2026-04-23
module: ci-release
component: tooling
problem_type: architecture_pattern
severity: high
related_components: [development_workflow, documentation]
tags: [github-actions, release-workflow, monorepo, split-release, seed-tag, squash-merge, changelog-range, concurrency]
related_commits: [a85ced5, b5573bb]
applies_when:
  - "You are splitting a single tag-triggered release workflow into N mirror workflows keyed by tag prefix (e.g. `v*.*.*` for firmware, `pcb-*.*.*` for hardware)"
  - "Each stream writes its own CHANGELOG back to `main` via `stefanzweifel/git-auto-commit-action`"
  - "The component tracked by one of the streams was imported into the monorepo through a squash-merged PR"
  - "Users may push more than one tag-stream in a single `git push` (e.g. `git push origin main v0.2.0 pcb-0.1.1`)"
  - "You are moving from `git describe --tags` / `head -n2 | tail -n1` to `requarks/changelog-action` in `fromTag`/`toTag` mode"
---

# Splitting a tag-triggered release workflow in a monorepo — seed-tag anchoring, prev-tag by name, and shared concurrency

## Context

FrangiPool's firmware and PCB share one repo but have different release cadences — a Gerber export changes on hardware revisions; firmware ships continuously. The original single-workflow shape ([docs/solutions/architecture/tag-triggered-release-workflow-hardening.md](tag-triggered-release-workflow-hardening.md)) triggered on `v*.*.*` only, bundled `gerber.zip` on every release, and carried a conditional "PCB inchangé depuis X" note. That design coupled two release streams with different velocities: every firmware release shipped a full Gerber bundle, and the PCB could never have its own release notes.

The refactor (commit `a85ced5`) split it into two mirror workflows — [release-firmware.yml](../../../.github/workflows/release-firmware.yml) on `v*.*.*`, [release-pcb.yml](../../../.github/workflows/release-pcb.yml) on `pcb-*.*.*` — each writing to its own CHANGELOG. Four pitfalls surfaced during implementation and the code-review pass that are not obvious from reading the final workflows alone. This doc captures them as a pattern so the next split-release author doesn't rediscover them.

## Guidance

### 1. Seed-baseline tag must anchor on the squash-merge commit on `main`, not the import commit

When you split a workflow and point it at a new tag prefix (e.g. `pcb-*.*.*`), the first release in that stream needs a **prior tag** to compute its changelog range against. Teams typically push a baseline tag — `pcb-0.1.0` in this case — onto the last commit that represents the component's prior state.

The trap: if the component was imported into the monorepo through a **squash-merged PR**, the commit you visually think of as "the import" (the one on the feature branch) is not reachable from `main`. `git merge-base <tag> HEAD` will silently walk back to whatever the tag's commit *is* reachable from — usually a pre-import commit that contains none of the component.

The `pcb-0.1.0` seed was initially pushed to the feature-branch import commit `7ea5eab`. PR #7 squash-merged, producing commit `b5573bb` on `main`. Result:

```bash
$ git merge-base pcb-0.1.0 HEAD
c73abbf                          # a pre-merge commit on main
$ git log --oneline c73abbf..HEAD -- pcb/
b5573bb feat: fusionner frangipool/pcb dans le monorepo + release workflow (#7)
# ... plus every non-PCB commit that landed after the squash-merge
```

The next `pcb-0.1.1` release would have pulled the entire monorepo-fusion squash commit (thousands of lines) plus 5 unrelated commits (docs, gitignore, CI split itself) into its release notes. Silent failure — the release would publish successfully, just with garbage content.

**Pattern — verify the baseline via `git merge-base <tag> HEAD`**. The correct answer is the tag's own commit (the squash-merge commit `b5573bb`), not any ancestor. If the output differs from the tag's SHA, you're anchored wrong.

```bash
$ git rev-parse pcb-0.1.0            # retargeted to b5573bb
b5573bb...
$ git merge-base pcb-0.1.0 HEAD       # must equal the tag's SHA
b5573bb...                            # ✓ correct
```

Retag procedure when you find you've anchored wrong:

```bash
git tag -d pcb-0.1.0
git push origin :refs/tags/pcb-0.1.0
git tag -a pcb-0.1.0 <squash-merge-sha> -m "baseline — first main commit containing pcb/"
git push origin pcb-0.1.0
```

Document the baseline anchor in the README release runbook, naming the squash-merge commit explicitly and forbidding retags/deletion. Seed-tag semantics are "an immutable anchor for `git tag --list`", nothing more.

### 2. Compute `prev_tag` by name-skip, not by sort position

The naive approach is "sort tags, take position 2":

```bash
# ANTI-PATTERN: position-based
prev_tag=$(git tag --list 'v*' --sort=-v:refname | head -n2 | tail -n1)
```

This breaks on forward-looking retags. If you retag an older version (e.g. the operator bumps `v0.1.5` forward to pick up a backported fix), the tag's `v:refname` sort order stays at position 6, not position 1. The push of the retag now computes `prev_tag` = whatever happens to be at position 2 in sort order, which is unrelated to the tag being released.

**Pattern — skip the current tag by name**, using `grep -v -Fx`:

```yaml
- name: Compute previous firmware tag
  id: prev
  run: |
    prev_tag=$(git tag --list 'v[0-9][0-9]*.[0-9][0-9]*.[0-9][0-9]*' --sort=-v:refname \
      | grep -v -Fx "${{ github.ref_name }}" \
      | head -n1)
    if [ -z "$prev_tag" ]; then
      echo "::error::No previous v-* tag found. Push a baseline firmware tag first."
      exit 1
    fi
    echo "prev_tag=$prev_tag" >> "$GITHUB_OUTPUT"
```

Three things are non-obvious:

- `grep -F` forces fixed-string matching (a tag containing `.` is a valid regex meta, and a dot-free exact tag would accidentally match dot-variants without `-F`).
- `grep -x` requires full-line match (prevents `v0.1.2` from shadowing `v0.1.20` as a prefix match).
- The `if [ -z "$prev_tag" ]` guard turns a silent empty-range failure into a loud CI error. The default behaviour of `requarks/changelog-action` with an empty `toTag` is to walk to the first commit of the repo, producing a "release notes" that cover everything ever committed.

### 3. Glob patterns in `git tag --list` must match the trigger regex's quantifier

The workflow triggers on `v[0-9]+.[0-9]+.[0-9]+` — one-or-more digits each segment. A glob like `v[0-9]*` in `git tag --list 'v[0-9]*'` is **strictly more permissive** than the trigger regex: it matches `v1`, `v.0.0`, `v1.` — tags that could exist historically or be created by a typo.

If such a malformed tag is the highest in `v:refname` sort (e.g. `v9999.whatever`), it silently becomes `prev_tag`, the changelog range evaluates to an empty or broken range, and the release publishes with nothing or everything.

**Pattern — mirror the trigger's quantifier in the glob**:

```yaml
# trigger:     v[0-9]+.[0-9]+.[0-9]+
# glob:        v[0-9][0-9]*.[0-9][0-9]*.[0-9][0-9]*
#              ↑ at least one digit, then zero-or-more — matches the '+' quantifier
```

Same rule for the `pcb-` stream: `pcb-[0-9][0-9]*.[0-9][0-9]*.[0-9][0-9]*`. A `pcb-2026-04-23` date-tag or a bare `pcb-rc1` will now fail the glob match and never be selected.

### 4. Share a `concurrency: group` across mirror workflows

Each stream auto-commits to `main`. A combined push `git push origin main v0.2.0 pcb-0.1.1` fires both workflows at approximately the same wall-clock moment — and both try to `git pull --rebase && git commit && git push` to `main`. Without coordination, one will succeed, the second will fail non-fast-forward (best case) or silently rebase over the first commit's `[skip ci]` marker (worst case).

**Pattern — share one concurrency group across all mirror workflows that touch `main`**:

```yaml
# release-firmware.yml
concurrency:
  group: release-main
  cancel-in-progress: false

# release-pcb.yml
concurrency:
  group: release-main       # same group
  cancel-in-progress: false
```

`cancel-in-progress: false` is load-bearing — `true` would cancel the first push's auto-commit mid-flight on the second stream's arrival, leaving a half-applied CHANGELOG on main. Explicit serialization is the only safe shape when the push ordering is operator-controlled and cannot be assumed.

### 5. Subsidiary streams must set `makeLatest: false`, not `legacy`

The primary stream (firmware) uses `makeLatest: legacy` so GitHub's semver comparator decides which tag earns the "latest release" badge — correct for backports within one stream.

Across two streams, `legacy` comparison no longer holds: `pcb-0.1.1` has no meaningful semver relationship to `v0.2.0`. If both streams used `legacy`, the most recently pushed tag always wins the badge — meaning every PCB release displaces the firmware latest-release badge, which is the visible indicator of "what to flash".

**Pattern — the *primary* stream owns the "latest" badge**:

```yaml
# release-firmware.yml — owns 'latest'
makeLatest: legacy           # semver-ordered within the v*.*.* stream

# release-pcb.yml — always subsidiary
makeLatest: false            # PCB releases exist but never shadow firmware 'latest'
```

If you have three or more streams, exactly one must be `legacy` / `true`; the rest must be `false`. Choose the stream whose "latest" matters most to users (usually the one users consume through dashboards, auto-update flows, or docs).

### 6. Seed-tag idempotence guard

After the baseline tag is pushed, CI fires for it — because `on: push: tags: - 'pcb-[0-9]+.[0-9]+.[0-9]+'` matches `pcb-0.1.0`. Without a guard, the workflow attempts to compute `prev_tag` for the baseline itself, which returns empty (since `grep -v -Fx` removes the only tag), and fails loudly — which is correct, but leaves a red X in the CI history every time the seed is referenced.

**Pattern — job-level guard against the seed tag's ref name**:

```yaml
jobs:
  release:
    if: github.ref_name != 'pcb-0.1.0'    # idempotent to re-push of the seed
    runs-on: ubuntu-latest
```

The workflow becomes a no-op for the seed tag, and a push of `pcb-0.1.0` from a fresh clone (or re-push after accidental deletion) silently succeeds instead of failing. This is the *only* place where hardcoding the seed tag's literal name is correct — elsewhere it should always be referenced via `${{ github.ref_name }}`.

### 7. Refname-exact tag-on-main guard

The hardening doc's `grep -q 'origin/main$'` suffix-match on `git branch -r` output was flagged as fragile — it matches `evil-origin/main` if a second remote is added. Both split workflows upgrade to refname-exact matching:

```yaml
- name: Verify tag commit is on origin/main
  run: |
    git fetch origin main --quiet
    if ! git branch -r --contains "${{ github.sha }}" --format='%(refname)' \
         | grep -Fxq 'refs/remotes/origin/main'; then
      echo "::error::Tag ${{ github.ref_name }} points to a commit absent from origin/main. Refusing to release."
      exit 1
    fi
```

`--format='%(refname)'` produces the unambiguous canonical ref (`refs/remotes/origin/main`), and `grep -Fxq` fixed-string full-line match kills the suffix-match risk. Copy this shape into any new release workflow — it's the correct upgrade of the prior doc's Residual Risk item, not a one-off fix.

## Why This Matters

The failure modes compound. A wrongly-anchored seed tag combined with a position-based `prev_tag` computation is how you ship a release whose changelog contains the entire monorepo's history the first time the subsidiary stream fires. The stream then ships its first "real" release without the operator ever noticing, because position 2 in sort order for `pcb-0.1.1` is now `pcb-0.1.0` — which works correctly for that run, making the root cause invisible until someone audits the very first `pcb-0.1.1` release notes months later.

Each pitfall individually has a tell: the seed-tag trap is visible via `git merge-base`, the sort-position trap is visible when you manually retag, the glob-quantifier trap is visible only if a malformed historical tag exists, and the concurrency trap only fires on combined pushes. Because the tells are rare, the patterns in this doc are best applied *by default* on split-release setup — waiting for a symptom means the first failure ships to users.

## When to Apply

Apply the full pattern set — seed-baseline verification, name-skip `prev_tag`, glob↔regex pairing, shared concurrency, subsidiary `makeLatest: false`, seed-tag idempotence guard, refname-exact tag-on-main guard — whenever you:

- split one tag-triggered release workflow into two or more mirror streams keyed by tag prefix in a single repo;
- introduce a release workflow for a component imported via squash-merge;
- migrate from `head -n2 | tail -n1` / `git describe --tags` to `requarks/changelog-action` `fromTag`/`toTag` mode;
- add a second auto-committing workflow targeting the same branch that another release workflow already touches.

The sub-patterns transfer independently: the name-skip `prev_tag` computation and glob-to-regex pairing are worth applying even to a single-stream workflow. The squash-merge seed-tag trap applies to any tag that anchors a range computation where the anchored commit lives on a feature branch.

## Examples

### Full name-skip `prev_tag` step, copyable

```yaml
- name: Compute previous PCB tag
  id: prev
  run: |
    prev_tag=$(git tag --list 'pcb-[0-9][0-9]*.[0-9][0-9]*.[0-9][0-9]*' --sort=-v:refname \
      | grep -v -Fx "${{ github.ref_name }}" \
      | head -n1)
    if [ -z "$prev_tag" ]; then
      echo "::error::No previous pcb-* tag found. The pcb-0.1.0 seed baseline tag must exist — see README 'Couper une release PCB'."
      exit 1
    fi
    echo "prev_tag=$prev_tag" >> "$GITHUB_OUTPUT"
    echo "- Previous PCB tag: $prev_tag" >> "$GITHUB_STEP_SUMMARY"

- name: Generate release notes + update pcb/CHANGELOG.md
  uses: requarks/changelog-action@b78a3354a01f4a1affb484b9264b506a815c46b1  # v1.10.3
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    fromTag: ${{ github.ref_name }}
    toTag: ${{ steps.prev.outputs.prev_tag }}
    changelogFilePath: pcb/CHANGELOG.md
    excludeTypes: chore,style,build
    excludeScopes: changelog
```

### README runbook entry for a baseline tag

The seed-tag semantics must be documented where release operators will find them — not in a plan doc, not in a commit message. Minimal runbook text, adapted from [README.md](../../../README.md):

> **Seed baseline: `pcb-0.1.0` is anchored on `b5573bb` (the squash-merge commit of PR #7, the first commit on `main` containing `pcb/`). This tag is an immutable baseline for `git tag --list 'pcb-*'` range computation — never delete, move, or retag it. All PCB releases starting from `pcb-0.1.1` compute their changelog range against this anchor.**

The commit-SHA reference and the "why b5573bb specifically" justification are both load-bearing: without the SHA, the next operator who needs to recreate the tag won't know which commit to pick; without the justification, a well-meaning cleanup pass might retarget it to "looks more like the import commit".

## Related

- [tag-triggered-release-workflow-hardening.md](tag-triggered-release-workflow-hardening.md) — prior learning on hardening a single-stream workflow. Five of its eight items (heredoc collision, commit-before-publish, fail-fast on existing release, `$GITHUB_STEP_SUMMARY` progress, `timeout-minutes`) apply unchanged to each mirror workflow; the Residual Risk items are partially closed here (refname-exact guard, concurrency group) and partially open (no `workflow_dispatch` dry-run, no throwaway-tag E2E).
- [.github/workflows/release-firmware.yml](../../../.github/workflows/release-firmware.yml) — the canonical firmware-stream implementation on commit `a85ced5`.
- [.github/workflows/release-pcb.yml](../../../.github/workflows/release-pcb.yml) — the canonical subsidiary-stream implementation, with seed-tag idempotence guard and `makeLatest: false`.
- [docs/brainstorms/2026-04-23-001-split-release-tags-requirements.md](../../brainstorms/2026-04-23-001-split-release-tags-requirements.md) — requirements decisions leading to the split.
- [docs/plans/2026-04-23-001-refactor-split-release-tags-plan.md](../../plans/2026-04-23-001-refactor-split-release-tags-plan.md) — implementation units; note the "fromTag/toTag with precomputed prev_tag" decision is documented before the code-review pass discovered the baseline-anchor bug.
