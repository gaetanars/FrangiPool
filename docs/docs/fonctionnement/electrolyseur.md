---
sidebar_position: 4
title: Électrolyseur
description: Contrôle du relais électrolyseur avec trois modes de fonctionnement et un compteur de durée d'électrolyse.
---

# Électrolyseur

Le relais électrolyseur est connecté sur **GPIO27**. Il contrôle la mise sous tension de l'électrolyseur à sel.

## Modes de fonctionnement

| Mode | Comportement |
|------|-------------|
| **Off** | Électrolyseur toujours éteint |
| **Auto** | Régulation automatique par seuil Redox (nécessite le module Redox) |
| **Forcé** | Électrolyseur toujours allumé (sans limitation) |

Le mode par défaut est **Off**.

:::info Auto-régulation Redox
Le mode Auto est disponible uniquement sur les presets incluant à la fois l'électrolyseur et la sonde Redox (presets `er`, `erp`, `ber`, `berp`). Sur les presets sans Redox, seuls Off et Forcé sont disponibles.

Voir [Redox/ORP et régulation](./redox-orp) pour les détails du fonctionnement en mode Auto.
:::

## Compteur de durée d'électrolyse

L'entité `sensor.frangipool_duree_electrolyse` comptabilise le **total des minutes d'électrolyse** depuis la dernière réinitialisation. Cette valeur est de type `total_increasing` — elle s'incrémente chaque minute où l'électrolyseur est actif.

Ce capteur est utile pour suivre l'usure des cellules d'électrolyse et planifier leur remplacement.

## Entités associées

| Entité | Type | Description |
|--------|------|-------------|
| `switch.frangipool_electrolyseur` | Interrupteur | État actuel du relais (lecture seule dans les presets avec Redox) |
| `select.frangipool_mode_electrolyseur` | Sélecteur | Off / Auto / Forcé |
| `sensor.frangipool_duree_electrolyse` | Capteur | Total de minutes d'électrolyse |

## Notes techniques

- Le relais GPIO27 est **active-LOW avec RESTORE_DEFAULT_ON** : au démarrage de l'ESP, l'électrolyseur reste dans l'état dans lequel il était avant le redémarrage.
- Le contrôle direct du switch depuis HA est possible mais déconseillé en mode Auto — le régulateur reprend le contrôle à l'interval suivant (1 min).
