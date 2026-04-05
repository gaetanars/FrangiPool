# FrangiPool

ESPHome configuration for salt water pool automation on ESP32. Supports electrolyzer control, Redox/ORP sensing, pH sensing, booster pump, and antifreeze protection.

You can find [the PCB here](https://github.com/frangipool/pcb).

## Quick Import

1. Open ESPHome Dashboard → **New Device** → **Use a project**
2. Paste the URL of the preset that matches your hardware
3. Adapt the substitutions (device name, Dallas sensor addresses)
4. Flash → Done

## Presets

Choose the preset that matches your hardware:

| Preset | Électrolyseur | Redox | pH | Auto-régulation | Surpresseur | URL Dashboard |
|--------|:---:|:---:|:---:|:---:|:---:|---|
| `salt_full` | ✓ | ✓ | ✓ | ✓ | — | `github://frangipool/esphome-config/salt_full.yaml@main` |
| `salt_wo_ph` | ✓ | ✓ | — | ✓ | — | `github://frangipool/esphome-config/salt_wo_ph.yaml@main` |
| `salt_wo_redox` | ✓ | — | ✓ | — | — | `github://frangipool/esphome-config/salt_wo_redox.yaml@main` |
| `salt_minimal` | ✓ | — | — | — | — | `github://frangipool/esphome-config/salt_minimal.yaml@main` |
| `salt_booster_full` | ✓ | ✓ | ✓ | ✓ | ✓ | `github://frangipool/esphome-config/salt_booster_full.yaml@main` |
| `salt_booster_wo_ph` | ✓ | ✓ | — | ✓ | ✓ | `github://frangipool/esphome-config/salt_booster_wo_ph.yaml@main` |
| `salt_booster_wo_redox` | ✓ | — | ✓ | — | ✓ | `github://frangipool/esphome-config/salt_booster_wo_redox.yaml@main` |
| `salt_booster_minimal` | ✓ | — | — | — | ✓ | `github://frangipool/esphome-config/salt_booster_minimal.yaml@main` |

**Auto-régulation** : automatic electrolyzer control based on Redox setpoints (requires electrolyzer + Redox).

## Substitutions

Each preset defines four substitutions to adapt before flashing:

```yaml
substitutions:
  name: frangipool                          # ESPHome device name (hostname)
  friendly_name: FrangiPool                 # Display name in Home Assistant
  local_temp_address: "0x0000000000000000"  # Dallas address: local/indoor probe
  temp_address: "0x0000000000000000"        # Dallas address: pipe/pool probe
```

**Finding Dallas addresses:** Flash with the placeholder `0x0000000000000000` addresses, connect via USB, and open the ESPHome log. The 1-Wire bus scan prints discovered addresses at startup. Copy them into your substitutions and reflash.

## Configuration in Home Assistant

Once your FrangiPool device is registered in Home Assistant, you have access to configuration entities (may vary depending on your preset):

- **Consigne Antigel** : antifreeze temperature setpoint. Pump activates 1°C below the setpoint and stops at the setpoint. Uses the pipe temperature sensor.
- **Consigne Redox Max / Min** : Redox thresholds (mV) for electrolyzer auto-regulation
- **Délais Filtration** : minimum pump runtime (minutes) before recording pool temperature and Redox values
- **Mode Electrolyseur** : Off / Auto / Forcé
- **Mode Surpresseur** : Off / Auto / Forcé
- **Redox Calibration 225mV / 475mV** : calibrate the Redox probe in reference solution
- **Redox Calibration Reset** : reset calibration offset to 0
- **pH Calibration 7.00** : calibrate the pH probe in pH 7.00 buffer
- **Reboot** : restart the ESP

## Available Packages

For advanced users composing a custom configuration:

| Package | Description |
|---------|-------------|
| `packages/base.yaml` | Pump (GPIO25), Dallas temperature sensors (GPIO23), antifreeze, API/OTA/Improv, status LED |
| `packages/i2c_ads1115.yaml` | I2C bus (GPIO21/22) and ADS1115 ADC at 0x48 |
| `packages/electrolyser.yaml` | Electrolyzer relay (GPIO27), electrolysis minute counter |
| `packages/booster.yaml` | Booster pump relay (GPIO26), Mode Off/Auto/Forcé |
| `packages/redox.yaml` | Redox/ORP sensor (ADS1115 A0), calibration buttons, trend sensor |
| `packages/ph.yaml` | pH sensor (ADS1115 A1), calibration button |
| `packages/redox_electrolyser.yaml` | Redox-based electrolyzer auto-regulation, Mode Off/Auto/Forcé, Redox setpoints |

## Advanced Configuration

Create your own `my-pool.yaml` and compose packages directly:

```yaml
substitutions:
  name: my-pool
  friendly_name: My Pool
  local_temp_address: "0xABCDEF0123456789"
  temp_address: "0x0123456789ABCDEF"

esphome:
  name: ${name}
  friendly_name: ${friendly_name}

packages:
  base: github://frangipool/esphome-config/packages/base.yaml@main
  i2c_ads1115: github://frangipool/esphome-config/packages/i2c_ads1115.yaml@main
  electrolyser: github://frangipool/esphome-config/packages/electrolyser.yaml@main
  redox: github://frangipool/esphome-config/packages/redox.yaml@main
  redox_electrolyser: github://frangipool/esphome-config/packages/redox_electrolyser.yaml@main
```

All packages are fetched directly from GitHub at compile time. Pin to a specific version by replacing `@main` with a branch name or a tag (e.g. `@v2.0.0`).
