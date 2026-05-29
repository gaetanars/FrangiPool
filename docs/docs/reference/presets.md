---
sidebar_position: 1
title: Matrice des presets
description: Composition détaillée des 8 presets FrangiPool — packages inclus et URL d'import ESPHome Dashboard.
---

# Matrice des presets

## Packages inclus par preset

| Preset | base | filtration | i2c_ads1115 | electrolyser | redox | ph | redox_electrolyser | booster |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `frangipool-e`    | ✓ | ✓ | — | ✓ | — | — | — | — |
| `frangipool-er`   | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | — |
| `frangipool-ep`   | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — |
| `frangipool-erp`  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `frangipool-be`   | ✓ | ✓ | — | ✓ | — | — | — | ✓ |
| `frangipool-ber`  | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| `frangipool-bep`  | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | ✓ |
| `frangipool-berp` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## URLs d'import ESPHome Dashboard

Pour utiliser FrangiPool directement depuis ESPHome Dashboard (Nouveau périphérique → Utiliser un projet) :

| Preset | URL |
|--------|-----|
| `frangipool-erp`  | `github://gaetanars/FrangiPool/frangipool-erp.yaml@main` |
| `frangipool-er`   | `github://gaetanars/FrangiPool/frangipool-er.yaml@main` |
| `frangipool-ep`   | `github://gaetanars/FrangiPool/frangipool-ep.yaml@main` |
| `frangipool-e`    | `github://gaetanars/FrangiPool/frangipool-e.yaml@main` |
| `frangipool-berp` | `github://gaetanars/FrangiPool/frangipool-berp.yaml@main` |
| `frangipool-ber`  | `github://gaetanars/FrangiPool/frangipool-ber.yaml@main` |
| `frangipool-bep`  | `github://gaetanars/FrangiPool/frangipool-bep.yaml@main` |
| `frangipool-be`   | `github://gaetanars/FrangiPool/frangipool-be.yaml@main` |

Pour épingler une version spécifique, remplacez `@main` par un tag de release (ex. `@0.5.0`).

## Nomenclature

Les flags du nom de preset suivent un ordre fixe : **B → E → R → P**

| Flag | Module | GPIO | Prérequis |
|------|--------|------|-----------|
| **B** | Booster / surpresseur | GPIO26 | — |
| **E** | Électrolyseur | GPIO27 | — |
| **R** | Redox / ORP | ADS1115 A0 | i2c_ads1115 |
| **P** | pH | ADS1115 A1 | i2c_ads1115 |

L'**auto-régulation Redox** (module `redox_electrolyser`) est incluse automatiquement sur les presets combinant E + R.
