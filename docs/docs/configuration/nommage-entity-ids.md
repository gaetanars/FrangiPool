---
sidebar_position: 3
title: Nommage du device et entity IDs
description: Comment le nom du device dans Home Assistant détermine le préfixe des entity IDs, et comment le configurer pour correspondre au dashboard.
---

# Nommage du device et entity IDs

## Le suffixe MAC

FrangiPool utilise `name_add_mac_suffix: true`. Cela signifie que le **nom du device dans ESPHome** prend automatiquement la forme `frangipool-XXXX`, où `XXXX` sont les 4 derniers octets de l'adresse MAC de l'ESP32.

Ce comportement garantit que chaque device sur votre réseau a un nom unique, même si vous avez plusieurs FrangiPool.

## Conséquence dans Home Assistant

Lors de l'adoption dans HA, les **entity IDs** sont générés à partir du nom du device. Avec le suffixe MAC, les entités ont la forme :
```
sensor.frangipool_xxxx_temperature_piscine
switch.frangipool_xxxx_filtration
...
```

## Renommer pour le dashboard

Le **dashboard Lovelace fourni** utilise le préfixe `frangipool_*` (sans suffixe MAC). Pour que les entity IDs correspondent :

1. Ouvrez **Paramètres → Appareils & Services → ESPHome**.
2. Cliquez sur le device `frangipool-XXXX`.
3. Cliquez sur l'icône **crayon** (modifier le nom).
4. Remplacez `frangipool-XXXX` par `frangipool`.
5. Enregistrez.

HA régénère automatiquement tous les entity IDs. Les entités deviennent :
```
sensor.frangipool_temperature_piscine
switch.frangipool_filtration
...
```

Le dashboard fonctionne alors directement sans modification.

:::caution Impact sur les automatisations existantes
Si vous avez des automatisations HA qui référencent les entités avec le suffixe `_xxxx_`, elles cesseront de fonctionner après le renommage. Mettez à jour les entity IDs dans ces automatisations.
:::

## Plusieurs devices FrangiPool

Si vous gérez plusieurs piscines avec plusieurs FrangiPool, conservez le suffixe MAC ou utilisez des noms distinctifs (ex. `frangipool-piscine1`, `frangipool-piscine2`). Le dashboard devra être dupliqué et adapté pour chaque device.
