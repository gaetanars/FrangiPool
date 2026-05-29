---
sidebar_position: 2
title: Mappage des GPIO
description: Tableau complet des GPIO utilisés par FrangiPool et explication du fonctionnement des relais active-LOW.
---

# Mappage des GPIO

## Tableau des GPIO utilisés

| GPIO | Fonction | Direction | Notes |
|------|----------|-----------|-------|
| **GPIO2** | LED de statut | Sortie | Active-LOW, `inverted: true` |
| **GPIO21** | I²C SDA | Bidirectionnel | Bus I²C pour ADS1115 et autres périphériques |
| **GPIO22** | I²C SCL | Sortie | Bus I²C |
| **GPIO23** | Bus 1-Wire | Bidirectionnel | Sondes Dallas DS18B20 |
| **GPIO25** | Relais pompe filtration | Sortie | Active-LOW, `inverted: true` |
| **GPIO26** | Relais booster (surpresseur) | Sortie | Active-LOW, `inverted: true` |
| **GPIO27** | Relais électrolyseur | Sortie | Active-LOW, `RESTORE_DEFAULT_ON` |

## Fonctionnement des relais Active-LOW

Le PCB FrangiPool utilise des relais à logique **Active-LOW** : le relais se **ferme** (charge activée) quand la broche GPIO est à l'état **bas (LOW)**, et s'ouvre quand elle est à l'état haut (HIGH).

```
GPIO HIGH → Relais ouvert  → Charge éteinte
GPIO LOW  → Relais fermé  → Charge allumée
```

### Sécurité au démarrage

Au boot de l'ESP32, toutes les broches GPIO sont à l'état **HIGH** par défaut. Avec des relais Active-LOW, cela signifie que toutes les charges sont **éteintes au démarrage** — aucun risque d'activation intempestive de la pompe ou de l'électrolyseur pendant la séquence de boot.

### Cas particulier : électrolyseur

L'électrolyseur (GPIO27) utilise `RESTORE_DEFAULT_ON` : au redémarrage, il reprend l'état dans lequel il était avant la coupure. Ce comportement est intentionnel pour éviter d'interrompre un cycle d'électrolyse en cours lors d'un redémarrage OTA.

## GPIO disponibles

Tous les GPIO de l'ESP32 non utilisés par le firmware sont accessibles via les connecteurs dupont du PCB. Ils peuvent être utilisés pour des extensions matérielles futures (capteur de niveau, vanne motorisée, etc.).

## Alimentation des capteurs

Les sondes raccordées sur l'ADS1115 (pH, Redox) fonctionnent en **5 V**. Le PCB intègre un convertisseur de niveau qui adapte les tensions 5 V des sorties analogiques des sondes vers les entrées 3.3 V de l'ADS1115.

Les sondes Dallas DS18B20 sur le bus 1-Wire fonctionnent en **3.3 V** et peuvent être alimentées directement depuis les connecteurs du PCB.
