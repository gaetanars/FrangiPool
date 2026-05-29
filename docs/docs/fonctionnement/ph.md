---
sidebar_position: 6
title: pH
description: Mesure du pH en continu avec calibration two-points et suivi de la dérive de sonde.
---

# pH

Le module pH mesure l'**acidité de l'eau** en continu. Un pH bien équilibré pour une piscine se situe entre **7.0 et 7.6**.

:::info Compatibilité sonde
Le module est conçu pour la sonde **Gravity pH Meter v2.0** de DFRobot (non-inversée) : pH 7 ≈ 2.5 V, pH 4 ≈ 1.65 V. Les versions v1.x ou les clones inversés produisent des pentes hors plage et sont rejetées à la calibration.
:::

## Mesure : temps réel vs échantillonnée

| Entité | Mise à jour | Usage |
|--------|-------------|-------|
| `sensor.frangipool_ph_temps_reel` | Continue (fenêtre glissante 180 s) | Diagnostic, suivi en direct |
| `sensor.frangipool_ph` | Seulement quand la pompe tourne ≥ délai de mesure | Historique fiable, dashboard |

Comme pour le Redox, la valeur **échantillonnée** n'est mise à jour que lorsque la pompe a fonctionné assez longtemps pour que l'eau en circulation soit représentative du bassin (délai configurable, défaut 20 min).

## Calcul du pH

FrangiPool applique une calibration **two-points** (deux tampons pH 7 et pH 4) :

```
pH = slope × V + intercept
```

Où `slope` et `intercept` sont recalculés à chaque calibration réussie.

Valeurs d'usine : `slope = 3.56`, `intercept = -1.889`.

## Entités associées

| Entité | Type | Description |
|--------|------|-------------|
| `sensor.frangipool_ph` | Capteur | Valeur échantillonnée |
| `sensor.frangipool_ph_temps_reel` | Capteur | Valeur temps réel |
| `sensor.frangipool_ph_slope` | Capteur (diagnostic) | Pente de calibration (3.56 = valeur d'usine) |
| `sensor.frangipool_ph_intercept` | Capteur (diagnostic) | Intercept de calibration |
| `sensor.frangipool_v_ph7` | Capteur (diagnostic) | Tension capturée lors de la dernière calibration pH 7 |
| `sensor.frangipool_v_ph4` | Capteur (diagnostic) | Tension capturée lors de la dernière calibration pH 4 |
| `text_sensor.frangipool_ph_calibration_last_result` | Texte (diagnostic) | Résultat de la dernière calibration |

Pour la procédure de calibration complète, voir [Calibration pH](../configuration/calibration-ph).

## Limitations

- **Pas de compensation en température** — on suppose 25 °C. Erreur résiduelle ≤ 0.1 pH dans la plage 15–30 °C, acceptable pour une cible 7.0–7.6 ±0.1.
- Le pH n'est pas utilisé pour réguler automatiquement une pompe doseuse — il est en lecture seule. La correction du pH reste manuelle.
