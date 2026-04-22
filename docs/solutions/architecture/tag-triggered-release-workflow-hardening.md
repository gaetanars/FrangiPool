---
title: Tag-triggered GitHub Actions release workflow — eight failure modes and the patterns that mitigate them
category: architecture
date: 2026-04-22
module: ci-release
component: tooling
tags: [github-actions, release-workflow, ci-hardening, heredoc-injection, step-ordering, tag-replay, artifact-validation, changelog-automation]
related_commits: [b5573bb, cf1d2c3]
related_todos: []
problem_type: architecture_pattern
severity: high
applies_when:
  - "You are authoring or reviewing a GitHub Actions workflow triggered by `on: push: tags:`"
  - "The workflow zips artifacts, auto-generates a changelog body, publishes a GitHub Release, and auto-commits CHANGELOG back to the default branch"
  - "The workflow runs with a `contents: write` token scope"
  - "You are adding `allowUpdates: true` or `makeLatest: true` to an `ncipollo/release-action` step"
  - "You are writing a multi-line value into `$GITHUB_OUTPUT` using an `echo` heredoc delimiter"
---

# Tag-triggered GitHub Actions release workflow — eight failure modes and the patterns that mitigate them

## Context

A tag-triggered release workflow for `gaetanars/FrangiPool` was introduced to automate PCB Gerber bundling, changelog generation, and GitHub Release creation on every `v*.*.*` tag push (see [.github/workflows/release.yml](../../../.github/workflows/release.yml) on commit `b5573bb`). A 9-reviewer code review on PR #7 identified 17 structural hazards in the initial 84-line draft. Eight were applied as hardening fixes in commit `cf1d2c3`, producing the 116-line version now on `main`.

The hazards cluster around four failure modes that are non-obvious until they bite in production:

1. silent data truncation from heredoc delimiter collisions (and a runner command-injection path),
2. partial-success states that leave public artifacts out of sync with the default branch,
3. silent asset corruption that ships a broken archive to users,
4. static strings that become lies as the repo ages.

This learning captures the patterns that mitigate all eight applied fixes, plus the residual risks left intentionally open. The failure modes are not FrangiPool-specific — the checklist transfers to any Python/Go/Node/embedded project using `requarks/changelog-action` + `ncipollo/release-action` + `stefanzweifel/git-auto-commit-action` (or functional equivalents).

## Guidance

### 1. Heredoc delimiter must be collision-resistant

A fixed delimiter like `BODY_EOF` will be silently terminated early if any conventional-commit message happens to contain that exact string on its own line. With `contents: write` in scope, a crafted commit message that terminates the heredoc and injects further `>> $GITHUB_OUTPUT` lines constitutes a runner command-injection vector.

Anti-pattern:

```yaml
run: |
  echo 'body<<BODY_EOF' >> $GITHUB_OUTPUT
  echo "$CHANGELOG_BODY" >> $GITHUB_OUTPUT
  echo 'BODY_EOF' >> $GITHUB_OUTPUT
```

Pattern — generate a 16-byte random suffix per run:

```yaml
run: |
  delimiter="BODY_$(openssl rand -hex 16)"
  {
    echo "body<<${delimiter}"
    printf '%s\n' "$CHANGELOG_BODY"
    echo "${delimiter}"
  } >> "$GITHUB_OUTPUT"
```

`printf '%s\n'` is also safer than `echo "$var"` for multi-line bodies — `echo` interprets escape sequences on some shells.

### 2. Commit CHANGELOG to main BEFORE publishing the release

Publishing the release first and then auto-committing the CHANGELOG creates a window where a public tagged release exists but `main` carries no corresponding CHANGELOG entry. If the auto-commit step fails (network, merge conflict, branch protection), the release is already visible and the inconsistency requires manual repair.

Anti-pattern (original ordering):

```yaml
- uses: ncipollo/release-action@...        # publish first
- uses: stefanzweifel/git-auto-commit-action@...   # commit after
```

Pattern — commit CHANGELOG first, publish last. If the commit step fails, nothing is externally visible; the operator fixes and retags.

```yaml
- name: Commit CHANGELOG.md update
  uses: stefanzweifel/git-auto-commit-action@04702edda442b2e678b25b537cec683a1493fcb9  # v7.1.0
  with:
    branch: main
    commit_message: 'docs(changelog): update CHANGELOG.md for ${{ github.ref_name }} [skip ci]'
    file_pattern: CHANGELOG.md

- name: Create or update GitHub Release
  uses: ncipollo/release-action@339a81892b84b4eeb0f6e744e4574d79d0d9b8dd  # v1.21.0
  with:
    artifacts: gerber.zip
    token: ${{ secrets.GITHUB_TOKEN }}
```

Companion — emit `$GITHUB_STEP_SUMMARY` lines after each significant step (zip, validate, compose body, commit, release-create). When a run fails mid-way, the summary immediately shows which steps succeeded without requiring the operator to expand each collapsed log:

```yaml
- name: Log CHANGELOG commit to step summary
  run: echo "- CHANGELOG committed to main for ${{ github.ref_name }}" >> $GITHUB_STEP_SUMMARY
```

### 3. Fail fast if the release already exists

`allowUpdates: true` in `ncipollo/release-action` silently replaces all assets on an existing release when an operator force-retags. The destruction is implicit and leaves no audit trail in the step log.

Pattern — add an explicit pre-check that aborts with `::error::` if the release exists. A force-retag now requires an explicit `gh release delete` first, making the destructive intent auditable:

```yaml
- name: Fail fast if release already exists
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    if gh release view "${{ github.ref_name }}" --repo "${{ github.repository }}" >/dev/null 2>&1; then
      echo "::error::Release ${{ github.ref_name }} already exists. Delete it explicitly (gh release delete ${{ github.ref_name }} --yes) before retagging."
      exit 1
    fi
```

### 4. Never hardcode version strings that shadow a dynamic condition

A note inserted conditionally based on `git log` output must not hardcode the previous tag as a literal string. The condition re-evaluates dynamically on every run, but a hardcoded value is frozen at what was true when the workflow was written — the note becomes a lie after the first update that flips the condition.

Anti-pattern:

```bash
pcb_note="> PCB inchangé depuis v0.1.0 (2023-06-08). ..."
```

Pattern — interpolate the runtime value:

```bash
prev_tag=$(git describe --tags --abbrev=0 "${{ github.ref_name }}^" 2>/dev/null || echo "")
if [ -n "$prev_tag" ] && [ -z "$(git log --name-only "${prev_tag}..${{ github.sha }}" -- pcb/ | grep .)" ]; then
  pcb_note="> **Note matérielle** : PCB inchangé depuis ${prev_tag}. Le \`gerber.zip\` attaché est identique à celui du précédent release."$'\n\n'
fi
```

After the first release that does touch `pcb/`, `prev_tag` updates automatically and the note reflects the correct baseline.

### 5. `makeLatest: legacy` over `makeLatest: true` for multi-tag projects

`makeLatest: true` unconditionally promotes the pushed tag to the repository's "Latest release" badge. Any backport tag (e.g. `v1.2.4` pushed after `v2.0.0` is already published) silently displaces the newer tag.

```yaml
# APRÈS — GitHub décide selon semver
- uses: ncipollo/release-action@...
  with:
    makeLatest: legacy
```

`legacy` delegates to GitHub's own semver comparison, which keeps the semantically newest tag as latest regardless of push order.

### 6. Always set `timeout-minutes:` on release jobs

Default is 6 hours on `ubuntu-latest`. A hung third-party action (upload stall, API throttle, `git-auto-commit-action` network timeout) holds the runner and shows "in progress" for hours with no alert.

```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 15   # 3× normal observed (~5 min)
```

Set the value to approximately 3× the longest observed successful run. 15 minutes is a safe ceiling for asset-upload workflows touching a few MB.

### 7. Validate asset content before publishing (do not trust the zip exit code)

`zip -r gerber.zip .` against an accidentally empty directory exits `0` and produces a syntactically valid archive with zero entries. `ncipollo/release-action` uploads it without complaint; users download a useless asset.

Pattern — after zipping, assert that at least one file matching the expected extension set is present. Fail loudly before the asset reaches users:

```yaml
- name: Validate gerber.zip contents
  run: |
    # Garde C12 : refuse de publier un asset vide.
    if ! unzip -l gerber.zip | grep -qE '\.(GTL|GBL|GKO|GBS|GTO|GTS|DRL)$'; then
      echo "::error::gerber.zip is missing Gerber/DRL files — refusing to publish."
      exit 1
    fi
    echo "- Validated gerber.zip has Gerber/DRL entries" >> $GITHUB_STEP_SUMMARY
```

Adapt the `grep -qE` pattern to the mandatory extensions for your artifact type (`\.(whl|tar\.gz)` for Python, `\.(bin|uf2)` for embedded, `\.(jar|war)` for JVM, etc.).

### 8. Release runbook belongs in README, not in plan documents

Operators cutting a release should not need to locate a plan document or architectural note. A "Couper une release" / "Cutting a release" section in `README.md` is the authoritative, always-visible location. It should cover:

1. Checkout `main`, verify all intended commits are present.
2. Confirm commit messages follow Conventional Commits — the changelog action parses these.
3. Tag and push simultaneously: `git tag v1.2.3 && git push origin main v1.2.3` — avoids triggering the workflow on an intermediate state.
4. Verify the GH Release page shows the expected asset and changelog body.

Also document:

- the tag regex accepted by the workflow (`v[0-9]+.[0-9]+.[0-9]+` — no pre-release suffixes trigger),
- the retag procedure: `gh release delete <tag> --yes && git tag -d <tag> && git push origin :refs/tags/<tag>`, then retag from step 3.

## Why This Matters

Each hazard in isolation looks minor; the interactions cause incidents.

- **Heredoc injection** is the highest-severity item. `contents: write` combined with `$GITHUB_OUTPUT` injection allows arbitrary manipulation of subsequent step inputs. It is also the hardest to notice in a post-mortem — the truncation is silent and the release body simply looks shorter than expected.
- **Commit-before-publish ordering** matters because GitHub Releases are immediately public. A failed CHANGELOG commit after a published release requires a hotfix commit to `main` with no corresponding release event — exactly the kind of drift that accumulates silently in solo projects.
- **Static strings in dynamic contexts** and **zip content validation** are both silent-success failure modes: the workflow exits `0`, the release is created, but the artifact or note is wrong. Hardest bugs to catch in a post-release audit.
- **Timeout and `makeLatest`** are environmental hardening: they protect against edge cases (runner stalls, backport tags) that are rare but disproportionately disruptive when they occur.

## When to Apply

Apply this whole checklist to any workflow that meets all of:

- triggered by tag push (not branch push or `workflow_dispatch` alone),
- creates or updates a GitHub Release with one or more uploaded assets,
- auto-commits a generated file (changelog, lockfile, version bump) back to a long-lived branch using the workflow's own `GITHUB_TOKEN`.

The hardening transfers across ecosystems — the failure modes described here are not language-specific:

- heredoc injection exists in any workflow that writes a conventional-commit changelog to `$GITHUB_OUTPUT`;
- the ordering hazard (publish before commit) applies identically to Python wheels, Go binaries, Node packages, or firmware zips;
- the empty-asset guard applies to any workflow that zips or tarballs a directory that could be accidentally empty;
- the three third-party actions referenced here are popular enough that this exact checklist applies verbatim to many projects.

## Accepted Residual Risks

The review identified five further items that were intentionally deferred on this pass. Readers should not treat this document as an exhaustive hardening checklist — these gaps remain open:

- **No `concurrency:` group** to serialize simultaneous tag pushes. Acceptable under single-contributor projects where two simultaneous tag pushes are operationally impossible; should be added before multi-contributor workflows adopt this pattern.
- **Detached-HEAD / TOCTOU on auto-commit**: if `main` advances between `actions/checkout` and `git-auto-commit-action`, the commit may fail non-fast-forward or silently rebase. Interaction with branch-protection rules on `main` is untested.
- **`grep -q 'origin/main$'` whitespace and suffix fragility**: the tag-on-main guard matches the suffix `origin/main` in `git branch -r` output. Correct for a single-remote setup but would match `evil-origin/main` if a second remote were added.
- **No `workflow_dispatch` dry-run path**: nothing short of pushing a real tag exercises the workflow. A `workflow_dispatch` input (`dry_run: true`) that skips release-create and auto-commit would allow pre-flight validation without publishing.
- **No throwaway-tag E2E test performed**: the workflow has never been run against a synthetic `v0.0.0-test`-style tag (matching the regex) in a branch-protection-disabled environment. End-to-end behaviour of the auto-commit step under various branch-protection configurations is inferred, not observed.

## Related

- [.github/workflows/release.yml](../../../.github/workflows/release.yml) — the hardened workflow as shipped on `main` (commit `b5573bb`).
- [.github/workflows/validate.yml](../../../.github/workflows/validate.yml) — CI hardening reference (SHA-pinned actions, minimal permissions) from commit `fe9a302`.
- [docs/plans/2026-04-22-001-feat-monorepo-pcb-plan.md](../../plans/2026-04-22-001-feat-monorepo-pcb-plan.md) — the plan that anticipated this learning; "Q-F4" and "Q-A1" remain the open operational questions.
- Code review artifacts: `.context/compound-engineering/ce-code-review/20260422-155046-c84bd7a9/` (9 reviewer JSON files + run metadata) — source of the 17 original findings.
