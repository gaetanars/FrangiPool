---
sidebar_position: 2
title: Sondes de température
description: Deux sondes Dallas sur le bus 1-Wire, détectées par index, échangeables sans recompiler le firmware.
---

# Sondes de température

FrangiPool utilise deux sondes **Dallas DS18B20** sur le bus 1-Wire (GPIO23). Elles sont détectées automatiquement par **index** (0 et 1) — **aucune adresse hexadécimale à configurer**.

## Assignation par défaut

| Index | Entité HA | Rôle |
|-------|-----------|------|
| 0 | `sensor.frangipool_temperature_local` | Température ambiante locale (intérieur du boîtier) |
| 1 | `sensor.frangipool_temperature_canalisation` | Température du tuyau retour piscine |

Deux entités diagnostics indiquent l'assignation active en permanence :
- `text_sensor.frangipool_sonde_temperature_local` → `Sonde 0` ou `Sonde 1`
- `text_sensor.frangipool_sonde_temperature_canalisation` → `Sonde 0` ou `Sonde 1`

## Température Piscine (valeur échantillonnée)

L'entité `sensor.frangipool_temperature_piscine` est une valeur **échantillonnée** : elle n'est mise à jour que lorsque la pompe a tourné au moins `Délai Mesures` minutes depuis son dernier démarrage (défaut 20 min).

Cette précaution évite de capturer la température de l'eau stagnante dans les tuyaux, qui ne reflète pas la température réelle du bassin.

## Inverser les sondes (sans recompiler)

Si les sondes sont physiquement inversées lors du câblage, il n'est pas nécessaire de modifier le firmware. L'action API `swap_dallas_probes` échange les assignations de manière persistante :

```yaml
# Depuis Home Assistant — Developer Tools → Actions
action: esphome.frangipool_swap_dallas_probes
```

L'échange est persisté dans la mémoire NVS de l'ESP. Il survit aux redémarrages et aux mises à jour OTA. Les entités diagnostics se mettent à jour immédiatement après l'appel.

:::tip Identifier les sondes
Pour identifier quelle sonde correspond à quelle mesure, ouvrez les logs ESPHome au démarrage. Le bus 1-Wire affiche les deux sondes avec leurs températures actuelles. Comparez avec la réalité (main sur le tuyau vs température ambiante) pour confirmer l'assignation.
:::

## Lors d'un remplacement de sonde

Après le remplacement physique d'une sonde, les index peuvent changer selon l'ordre de détection du bus 1-Wire. Vérifiez l'assignation via les entités diagnostics et utilisez `swap_dallas_probes` si nécessaire.
