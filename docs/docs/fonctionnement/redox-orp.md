---
sidebar_position: 5
title: Redox / ORP et régulation
description: Mesure du potentiel d'oxydoréduction et régulation automatique de l'électrolyseur par hystérésis.
---

# Redox / ORP et régulation

Le module Redox mesure le **potentiel d'oxydoréduction (ORP)** de l'eau en millivolts. Cette valeur est le meilleur indicateur du pouvoir désinfectant de l'eau : plus elle est élevée, plus l'eau est désinfectée.

Valeurs typiques pour une piscine à sel bien équilibrée : **650–750 mV**.

## Mesure : temps réel vs échantillonnée

Deux valeurs sont disponibles :

| Entité | Mise à jour | Usage |
|--------|-------------|-------|
| `sensor.frangipool_redox_temps_reel` | Continue (toutes les 60 s) | Diagnostic, suivi en direct |
| `sensor.frangipool_redox` | Seulement quand la pompe tourne ≥ délai de mesure | Régulation, historique fiable |

La valeur **échantillonnée** (`pool_redox`) est utilisée pour la régulation. Elle n'est mise à jour que lorsque la pompe a tourné au moins `Délai mesures` minutes (défaut 20 min), ce qui garantit que l'eau circulante est représentative de l'ensemble du bassin — et non de l'eau stagnante dans les tuyaux.

## Régulation automatique de l'électrolyseur

Lorsque le mode électrolyseur est réglé sur **Auto**, FrangiPool régule la production de chlore en agissant sur le relais électrolyseur selon un modèle d'**hystérésis**.

### Condition préalable : gate pompe

La régulation ne s'active que si :
- La pompe est en cours de fonctionnement **ET**
- Le temps de pompage depuis le dernier démarrage est ≥ `Délai mesures` (défaut 20 min)

Sans cette condition, l'électrolyseur reste dans son état courant. Cela évite de réguler sur une mesure non représentative.

### Logique d'hystérésis

| Condition | Action |
|-----------|--------|
| `Redox > Consigne` | Électrolyseur **OFF** |
| `Redox < Consigne − 30 mV` | Électrolyseur **ON** |
| Entre les deux seuils | **État conservé** (pas de changement) |

Exemple avec Consigne = 730 mV :
- Redox > 730 mV → électrolyseur OFF
- Redox < 700 mV → électrolyseur ON
- 700–730 mV → état inchangé

La régulation est réévaluée toutes les **60 secondes**.

### Sécurité sur-chloration

Un mécanisme de sécurité désactive l'électrolyseur immédiatement (< 1 s) si `pool_redox > Consigne`, indépendamment du cycle de régulation principal. Ce mécanisme n'allume jamais l'électrolyseur — il est uniquement un filet de sécurité en cas de sur-chloration rapide.

## Consigne Redox

Configurable via `number.frangipool_consigne_redox` :
- Plage : 680–760 mV
- Défaut : **730 mV**

## Entités associées

| Entité | Type | Description |
|--------|------|-------------|
| `sensor.frangipool_redox` | Capteur | Valeur échantillonnée (mV) — utilisée pour la régulation |
| `sensor.frangipool_redox_temps_reel` | Capteur | Valeur temps réel (mV) — diagnostic |
| `sensor.frangipool_redox_offset` | Capteur | Offset de calibration effectivement appliqué |
| `select.frangipool_mode_electrolyseur` | Sélecteur | Off / Auto / Forcé |
| `number.frangipool_consigne_redox` | Nombre | Seuil cible (680–760 mV, défaut 730 mV) |

Pour la calibration de la sonde Redox, voir [Calibration Redox](../configuration/calibration-redox).
