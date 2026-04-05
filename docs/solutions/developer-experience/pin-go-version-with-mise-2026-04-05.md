---
title: Pin Go version with mise for reproducible code generation
date: "2026-04-05"
category: developer-experience
module: tooling
problem_type: developer_experience
component: tooling
severity: medium
applies_when:
  - "Multiple contributors or CI environments need to run `go generate ./...`"
  - "Go version differences could cause generated output to diverge between local and CI"
  - "A new tool version manager (mise) is being adopted on the project"
root_cause: incomplete_setup
resolution_type: tooling_addition
tags:
  - go
  - mise
  - toolchain
  - reproducibility
  - code-generation
  - ci
---

# Pin Go version with mise for reproducible code generation

## Context

In a Go project where multiple developers and a CI pipeline independently run `go generate ./...` to regenerate ESPHome YAML configuration files, there was no pinned Go toolchain version. Different environments could silently use different Go versions, leading to potential divergence in generated output — even when the template source files were identical. This is particularly subtle in a code-generation workflow because the generator (`template/main.go`) is not compiled into a binary artifact; it is executed directly via `go run` on each invocation. Without version pinning, the "same" generator could behave differently across machines or over time as Go releases advance.

## Guidance

Add a `mise.toml` file at the project root to pin the Go version used by all contributors and CI:

```toml
[tools]
go = "1.26"
```

mise (a polyglot version manager, similar to asdf/rtx) reads this file and activates the declared Go version automatically in the project directory. This ensures every `go generate ./...` invocation — local or in CI — uses the same toolchain.

Place this file at the repository root alongside `go.mod` and `main.go`. Commit it to version control so the pin travels with the codebase.

## Why This Matters

In code-generation workflows, the generator itself is the build artifact. If the Go version drifts between environments, template rendering or file I/O behavior could differ in ways that produce non-identical output from identical inputs. This defeats the purpose of checking generated files into the repository and auto-committing them from CI — reviewers can no longer trust that a diff in a generated file reflects a template change rather than a toolchain difference.

Pinning via `mise.toml` makes toolchain version a first-class, reviewable project configuration decision rather than an implicit property of whichever developer's machine or CI runner happens to be running the job. It also signals to new contributors exactly which Go version to install without requiring a prose README update.

## When to Apply

- Any Go project that uses `go generate` to produce committed output (YAML, Go code, documentation, etc.) that must remain byte-stable across contributors and CI runs.
- Projects where the Go version is not already pinned via another mechanism (e.g., a `toolchain` directive in `go.mod`, a `.go-version` file, or a `go-setup` GitHub Actions step with a hardcoded version).
- Teams using mise (or willing to adopt it) as their local version manager. If the team uses asdf, the equivalent is `.tool-versions`; if they use Docker, the equivalent is a pinned base image.
- When onboarding friction exists because contributors must manually determine which Go version matches what CI uses.

## Examples

**Before:** No toolchain pin. A developer running Go 1.23 locally and CI running Go 1.26 could produce different whitespace or ordering in generated YAML, causing spurious diffs on every CI run.

**After:** `mise.toml` pins Go to 1.26. Running `mise install` in the project root installs the correct version. `mise exec -- go generate ./...` (or automatic shell integration) guarantees the pinned version is active.

For the CI workflow (`.github/workflows/go-generated.yaml`), pair the `mise.toml` with a mise-aware setup step so the same pin is honoured in the pipeline:

```yaml
- uses: jdx/mise-action@v2   # installs mise and runs `mise install`
```

This single step reads `mise.toml` and provisions exactly Go 1.26, keeping local and CI environments in lockstep without any duplication of the version number.

## Related

- `.github/workflows/go-generated.yaml` — CI workflow that runs `go generate`
- `template/main.go` — the generator executed via `go generate ./...`
