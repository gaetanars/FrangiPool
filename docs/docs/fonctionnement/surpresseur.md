---
sidebar_position: 7
title: Surpresseur (Booster)
description: Contrôle du relais booster pour les configurations avec pompe surpresseur.
---

# Surpresseur (Booster)

Le module surpresseur gère un relais de **pompe booster** (GPIO26), disponible uniquement sur les presets avec le flag **B** : `be`, `ber`, `bep`, `berp`.

## Modes de fonctionnement

| Mode | Comportement |
|------|-------------|
| **Off** | Surpresseur toujours éteint |
| **Auto** | Le surpresseur suit l'état de la pompe de filtration principale |
| **Forcé** | Surpresseur toujours allumé |

Le mode par défaut est **Off**.

En mode **Auto**, le surpresseur démarre en même temps que la pompe principale et s'arrête avec elle. Ce mode est adapté aux installations où la pompe booster ne doit fonctionner que pendant la filtration.

## Entités associées

| Entité | Type | Description |
|--------|------|-------------|
| `switch.frangipool_surpresseur` | Interrupteur | État actuel du relais booster |
| `select.frangipool_mode_surpresseur` | Sélecteur | Off / Auto / Forcé |

## Notes techniques

- Le relais GPIO26 est **active-LOW** avec `inverted: true` : le surpresseur est éteint quand la broche est à l'état haut (état de repos au boot ESP32).
- Contrairement à l'électrolyseur, le surpresseur ne dispose pas de compteur de durée intégré.
