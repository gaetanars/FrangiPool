---
sidebar_position: 3
title: Protection antigel
description: La pompe démarre automatiquement si la température du tuyau passe sous le seuil antigel, quel que soit le mode.
---

# Protection antigel

La protection antigel est **indépendante du planning de filtration**. Si la **Température Canalisation** (sonde tuyau) descend sous le seuil configuré, la pompe démarre immédiatement — **quel que soit le mode de filtration, même Off**.

## Fonctionnement

- **Seuil** : configurable via `number.frangipool_consigne_antigel` (plage -2 °C à 2 °C, défaut **0 °C**).
- **Hystérésis de 1 °C** : la pompe s'active lorsque la température passe **sous la consigne**, et s'arrête lorsqu'elle remonte **au-dessus de la consigne + 1 °C**. Cela évite les démarrages/arrêts répétés autour du seuil.
- L'antigel a la **priorité absolue** sur tous les autres modes, y compris le mode forcé.
- L'antigel **fonctionne sans synchronisation NTP** — la sonde est surveillée en continu.

## Exemple

Avec une consigne à 0 °C :
- T < 0 °C → pompe démarre
- T > 1 °C → pompe s'arrête (retour au planning normal)

## Notifications Home Assistant

Une notification HA est envoyée :
- À l'**activation** de l'antigel (température sous le seuil)
- À la **désactivation** (retour au-dessus du seuil + hystérésis)

Ces notifications sont de type `persistent_notification.create` et n'apparaissent que si HA est connecté au moment de l'envoi.

## Entités associées

| Entité | Type | Description |
|--------|------|-------------|
| `binary_sensor.frangipool_antigel` | Binaire | Actif si la protection antigel est déclenchée |
| `number.frangipool_consigne_antigel` | Nombre | Seuil de déclenchement (−2 à 2 °C, défaut 0 °C) |
| `sensor.frangipool_temperature_canalisation` | Capteur | Température du tuyau retour (sonde 1-Wire index 1) |

:::warning Sonde tuyau
L'antigel se base sur la **Température Canalisation** (tuyau), pas sur la température ambiante ni sur la température piscine. Assurez-vous que la sonde est bien positionnée sur le tuyau exposé au gel.
:::
