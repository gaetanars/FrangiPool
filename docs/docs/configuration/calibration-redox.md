---
sidebar_position: 4
title: Calibration Redox
description: Deux méthodes de calibration Redox mutuellement exclusives — solution tampon ou offset manuel via API.
---

# Calibration Redox

La sonde Redox peut être calibrée par deux méthodes **mutuellement exclusives** :

1. **Calibration par solution tampon** — référence physique avec une solution étalon 225 mV ou 475 mV.
2. **Offset manuel via API** — ajustement fin sans solution étalon, pour corriger une dérive légère.

L'entité `sensor.frangipool_redox_offset` indique en permanence l'offset effectivement utilisé dans le calcul.

:::info Priorité
Si un offset manuel est défini (valeur ≠ 0), il **prend la priorité** sur l'offset de calibration tampon. Pour réactiver la calibration tampon, mettez le manuel à 0.
:::

## Méthode 1 — Calibration par solution tampon

Recommandée après l'installation ou le remplacement de la sonde. Établit l'offset de référence à partir d'une valeur connue.

### Matériel nécessaire
- Solution tampon Redox **225 mV** ou **475 mV** (fioles commerciales)
- Eau déminéralisée pour le rinçage

### Procédure

1. **Sortir la sonde** du circuit de la piscine.
2. **Rincer à l'eau déminéralisée** — éliminer les résidus de chlore.
3. **Immerger dans la solution tampon** (225 mV ou 475 mV). Attendre **1 minute** de stabilisation.
4. Dans Home Assistant, appuyer sur le bouton **Redox Calibration 225mV** ou **Redox Calibration 475mV**.
5. Le firmware attend **3 minutes**, capture la tension et calcule l'offset.
6. Une notification HA confirme la calibration. L'entité `sensor.frangipool_redox_offset` affiche la nouvelle valeur.
7. Remettre la sonde dans le circuit.

### Réinitialiser la calibration

Le bouton **Redox Calibration Reset** efface les deux offsets (tampon et manuel). La sonde revient en lecture brute sans correction.

## Méthode 2 — Offset manuel via action API

Pour ajuster finement la lecture sans refaire une calibration complète. Typiquement utile après :
- Un **changement d'ESP** (la mémoire NVS est vierge — l'offset tampon est perdu)
- Une **légère dérive** de sonde entre deux calibrations

```yaml
# Depuis Home Assistant — Developer Tools → Actions
action: esphome.frangipool_set_redox_manual_offset
data:
  offset: 45   # en mV — négatif pour abaisser, positif pour monter, 0 pour désactiver
```

Plage : −300 mV à +300 mV. Mettre à 0 désactive l'offset manuel et réactive l'offset de calibration tampon.

:::warning Après remplacement d'ESP
L'offset de calibration est stocké dans la **mémoire NVS** de la puce ESP32. Lors d'un remplacement d'ESP, la NVS est vierge : l'offset repart à 0. Re-saisir la valeur connue via l'offset manuel, ou refaire une calibration tampon complète.
:::

## Entités associées

| Entité | Type | Description |
|--------|------|-------------|
| `sensor.frangipool_redox` | Capteur | Valeur Redox corrigée (échantillonnée) |
| `sensor.frangipool_redox_offset` | Capteur (diagnostic) | Offset effectivement utilisé dans le calcul |
| `button.frangipool_redox_calibration_225mv` | Bouton | Lance la calibration 225 mV |
| `button.frangipool_redox_calibration_475mv` | Bouton | Lance la calibration 475 mV |
| `button.frangipool_redox_calibration_reset` | Bouton | Efface tous les offsets |
