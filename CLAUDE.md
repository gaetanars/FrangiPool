# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

FrangiPool is an ESPHome configuration for salt water pool automation systems based on ESP32. Multiple hardware variants (electrolyzer, booster pump, Redox sensor, pH sensor) are composed from modular YAML packages.

## Architecture

```
packages/
  base.yaml              ← Hardware commun (toujours inclus) : pompe, température, antigel, API/OTA
  i2c_ads1115.yaml       ← Bus I2C + ADS1115 (inclus si redox ou pH)
  electrolyser.yaml      ← Relais électrolyseur GPIO27, compteur minutes
  booster.yaml           ← Relais surpresseur GPIO26, Mode select
  redox.yaml             ← Capteur Redox via ADS1115, calibration, tendance
  ph.yaml                ← Capteur pH via ADS1115, calibration
  redox_electrolyser.yaml ← Auto-régulation électrolyseur basée sur Redox

salt_full.yaml           ← Preset : base+i2c+elec+redox+ph+redox_elec
salt_wo_ph.yaml          ← Preset : base+i2c+elec+redox+redox_elec
salt_wo_redox.yaml       ← Preset : base+i2c+elec+ph
salt_minimal.yaml        ← Preset : base+elec
salt_booster_full.yaml   ← Preset : base+i2c+elec+boost+redox+ph+redox_elec
salt_booster_wo_ph.yaml  ← Preset : base+i2c+elec+boost+redox+redox_elec
salt_booster_wo_redox.yaml ← Preset : base+i2c+elec+boost+ph
salt_booster_minimal.yaml  ← Preset : base+elec+boost

frangipool_redox.yaml    ← Config standalone Redox (profil matériel distinct, hors série presets)

docs/brainstorms/        ← Documents de requirements
docs/plans/              ← Plans d'implémentation
docs/solutions/          ← Solutions documentées (bugs, best practices), YAML frontmatter
```

**Pas de génération de code.** Tous les fichiers YAML sont la source de vérité directement éditable.

### Package composition

ESPHome fusionne les packages de façon additive : les listes (`sensor:`, `switch:`, `globals:`, `interval:`) sont concaténées. Les IDs déclarés dans un package sont accessibles globalement depuis tous les autres packages inclus dans le même preset.

### Hardware fixe (tous presets)

- Board : `nodemcu-32s` (ESP32, framework esp-idf)
- GPIO25 : pompe filtration
- GPIO23 : sondes Dallas DS18B20 (1-wire)
- GPIO2 : LED statut (inversée)
- GPIO21/22 : I2C SDA/SCL pour ADS1115 (quand redox ou pH activé)
- GPIO27 : électrolyseur (inverted false, RESTORE_DEFAULT_ON)
- GPIO26 : surpresseur (inverted true, RESTORE_DEFAULT_OFF)
- Home Assistant API, OTA, captive portal, Improv serial toujours présents

## Adding a New Preset

1. Créer un fichier `<name>.yaml` à la racine avec `substitutions:`, `esphome:`, `dashboard_import:`, et `packages:` listant les packages voulus
2. Ajouter l'URL dans le README

## Adding a New Feature

1. Créer ou modifier le(s) package(s) concerné(s) dans `packages/`
2. Si la feature introduit un nouveau package, l'ajouter dans les presets qui le nécessitent
3. Mettre à jour le README (tableau des presets si pertinent)

## Key Conventions

- Les `substitutions:` sont définies dans les presets (pas dans les packages). Les packages peuvent définir des valeurs par défaut qui seront écrasées par les presets.
- Chaque package qui stocke une valeur périodiquement définit son propre `interval: 1min` avec la condition de garde `pump on && pump_uptime >= pump_uptime_delay`. C'est une convention délibérée pour garder les packages indépendants.
- `redox_electrolyser.yaml` utilise `!extend pool_redox` pour ajouter `on_value_range` au sensor défini dans `redox.yaml`.
- Les presets `@main` reçoivent toujours la dernière version des packages dès le push sur main.
