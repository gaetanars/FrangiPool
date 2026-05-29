---
sidebar_position: 2
title: Composition avancée (packages)
description: Créez une configuration ESPHome personnalisée en combinant directement les packages FrangiPool.
---

# Composition avancée (packages)

Pour les utilisateurs souhaitant composer une configuration sur-mesure, les packages FrangiPool peuvent être importés directement dans un fichier YAML personnalisé.

## Packages disponibles

| Package | Responsabilité |
|---------|---------------|
| `packages/base.yaml` | Toujours inclus. WiFi/AP, API chiffrée, OTA, captive portal, bus 1-Wire GPIO23, relais pompe GPIO25, antigel, entités diagnostic. |
| `packages/filtration.yaml` | Planificateur autonome : modes Off/Hiver/Courbe/Auto, deux cycles journaliers, mode forcé, actions API. |
| `packages/i2c_ads1115.yaml` | Bus I²C GPIO21/22 + ADS1115 @ `0x48`. Requis par `redox` et `ph`. |
| `packages/electrolyser.yaml` | Relais électrolyseur GPIO27, compteur de minutes d'électrolyse. |
| `packages/booster.yaml` | Relais booster GPIO26, modes Off/Auto/Forcé. |
| `packages/redox.yaml` | Sonde Redox/ORP (ADS1115 A0), calibration (225/475 mV / reset), action offset manuel. |
| `packages/ph.yaml` | Sonde pH (ADS1115 A1), calibration two-points pH 7+pH 4, entités diagnostic. |
| `packages/redox_electrolyser.yaml` | Régulation Redox de l'électrolyseur par hystérésis, sélecteur mode, consigne Redox. |

## Exemple de configuration personnalisée

```yaml
# ma-piscine.yaml
esphome:
  project:
    name: frangipool.custom
    version: "0.5.0"

packages:
  base:               github://gaetanars/FrangiPool/packages/base.yaml@main
  filtration:         github://gaetanars/FrangiPool/packages/filtration.yaml@main
  i2c_ads1115:        github://gaetanars/FrangiPool/packages/i2c_ads1115.yaml@main
  electrolyser:       github://gaetanars/FrangiPool/packages/electrolyser.yaml@main
  redox:              github://gaetanars/FrangiPool/packages/redox.yaml@main
  redox_electrolyser: github://gaetanars/FrangiPool/packages/redox_electrolyser.yaml@main
```

Compilez et flashez :

```bash
esphome run ma-piscine.yaml
```

## Épingler une version

Pour garantir la reproductibilité, remplacez `@main` par un tag de release :

```yaml
packages:
  base: github://gaetanars/FrangiPool/packages/base.yaml@0.5.0
  filtration: github://gaetanars/FrangiPool/packages/filtration.yaml@0.5.0
```

## Valider localement

```bash
# Valider la configuration (Python ESPHome CLI requis)
esphome config ma-piscine.yaml

# Compiler le firmware
esphome compile ma-piscine.yaml
```

:::note Version ESPHome
Le firmware est développé et testé avec ESPHome `≥ 2024.6.0` (requis pour la plateforme `datetime:`). La version épinglée en CI est indiquée dans [`.github/workflows/validate.yml`](https://github.com/gaetanars/FrangiPool/blob/main/.github/workflows/validate.yml).
:::

## Substitutions disponibles

La seule substitution définie dans `base.yaml` est `preset_slug`, utilisée en interne pour construire l'URL du manifest OTA. Elle est surchargée par chaque preset — vous n'avez pas à la modifier dans une configuration personnalisée.

Les sondes Dallas n'utilisent plus d'adresse hexadécimale : elles sont détectées par index (0 et 1). L'assignation se gère via l'action `swap_dallas_probes` (voir [Sondes de température](../configuration/sondes-temperature.md)).
