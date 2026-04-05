# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

FrangiPool generates ESPHome YAML configurations for salt water pool automation systems based on ESP32. Multiple hardware variants (electrolyzer, booster pump, Redox sensor, pH sensor) are supported through a single template rendered into distinct config files.

## Code Generation

All generated files (`frangipool_*.yaml`, `README.md`) must never be edited directly — they are artifacts. Edits go into the source files under `template/`.

To regenerate all configs:
```bash
go generate ./...
```

This runs `template/main.go` (tagged `//go:build ignore`), which:
1. Reads `template/config.yaml` (device variant matrix)
2. Renders `template/frangipool.yaml.tmpl` once per device variant
3. Renders `template/README.md.tmpl` with all variants combined

The CI workflow (`.github/workflows/go-generated.yaml`) runs `go generate` automatically on push to non-main branches when `template/config.yaml` or `template/frangipool.yaml.tmpl` change, then auto-commits the results.

## Architecture

```
template/config.yaml          ← source of truth: which variants exist and their feature flags
template/frangipool.yaml.tmpl ← ESPHome config template with Go template conditionals
template/README.md.tmpl       ← documentation template (feature matrix table)
template/main.go              ← generator (go:build ignore, runs via go generate)
main.go                       ← declares //go:generate, imports yaml.v3 dependency
frangipool_*.yaml             ← generated output, one file per device variant
README.md                     ← generated output
docs/solutions/               ← documented solutions (bugs, best practices, workflow patterns), organized by category with YAML frontmatter (module, tags, problem_type)
```

### Device Variants

Each variant in `template/config.yaml` has four boolean flags:
- `electrolyser` — chlorine electrolyzer control (GPIO27)
- `booster` — booster pump relay (GPIO26)
- `redox` — Redox/ORP sensor via ADS1115 ADC (I2C)
- `ph` — pH sensor via ADS1115 ADC (I2C)

When `redox` or `ph` is true, the I2C bus and ADS1115 sections are included in the generated config. When both are false, those hardware sections are omitted entirely.

### Fixed Hardware (all variants)

- Board: `nodemcu-32s` (ESP32)
- GPIO25: filtration pump switch
- GPIO23: Dallas DS18B20 temperature sensors (1-wire)
- GPIO2: status LED
- GPIO21/22: I2C SDA/SCL for ADS1115 (when sensors enabled)
- Home Assistant API, OTA, captive portal, and Improv serial are always present

## Adding a New Variant

1. Add an entry to `template/config.yaml` with a unique `name` and desired feature flags
2. Run `go generate ./...`
3. The new `frangipool_{name}.yaml` and updated `README.md` are created automatically

## Adding a New Feature

1. Add a boolean field to the `deviceConfig` struct in `template/main.go`
2. Add the corresponding key to `template/config.yaml` for all relevant variants
3. Wrap the new ESPHome configuration blocks in `template/frangipool.yaml.tmpl` with `{{ if .NewFeature }}...{{ end }}`
4. Update `template/README.md.tmpl` to add a column for the new feature
5. Run `go generate ./...`
