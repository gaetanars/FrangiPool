---
sidebar_position: 3
title: Mise en service
description: Premier démarrage, identification des sondes Dallas, renommage dans Home Assistant et import du dashboard.
---

# Mise en service

## Premier démarrage et synchronisation de l'heure

Au premier boot, FrangiPool attend la synchronisation NTP via Home Assistant pour démarrer la filtration planifiée. Si HA est indisponible, la pompe reste à l'arrêt jusqu'à la synchronisation — **seule la protection antigel fonctionne sans heure valide**.

Une fois l'heure synchronisée, le planning est calculé et la filtration démarre selon le mode configuré (défaut : **Auto**).

## Identifier les sondes de température

FrangiPool utilise deux sondes **Dallas DS18B20** sur le bus 1-Wire. Elles sont détectées automatiquement par index (0 et 1) — **aucune adresse à configurer**.

Par défaut :
- **Index 0** → *Température Local* (ambiance interne du boîtier)
- **Index 1** → *Température Canalisation* (tuyau retour piscine)

Pour vérifier l'assignation physique :

1. Connectez l'ESP32 par USB.
2. Ouvrez les logs ESPHome : `esphome logs frangipool-<preset>.yaml` ou via ESPHome Dashboard.
3. Au boot, le bus 1-Wire affiche les deux sondes avec leurs températures.
4. Comparez avec les températures réelles pour confirmer quelle sonde est quelle.

Si les sondes sont inversées physiquement, utilisez l'action `swap_dallas_probes` depuis Home Assistant (voir [Sondes de température](../configuration/sondes-temperature)).

## Renommer le device dans Home Assistant

FrangiPool utilise `name_add_mac_suffix: true` — le nom du device dans HA prend la forme **`frangipool-XXXX`** (XXXX = 4 derniers octets du MAC). Les entity IDs générés par HA ont alors le préfixe `sensor.frangipool_xxxx_*`.

Le **dashboard Lovelace** fourni dans le projet utilise le préfixe court `frangipool_*`. Pour que les entity IDs correspondent, renommez le device dans HA :

1. Ouvrez **Paramètres → Appareils & Services → ESPHome**.
2. Cliquez sur le device `frangipool-XXXX`.
3. Cliquez sur l'icône **crayon** (modifier).
4. Changez le nom en `frangipool`.
5. Enregistrez — HA régénère automatiquement tous les entity IDs.

Après ce renommage, les entités sont accessibles comme `sensor.frangipool_temperature_piscine`, `switch.frangipool_filtration`, etc.

:::info Dashboard et entity IDs
Si vous n'utilisez pas le dashboard fourni, le renommage est facultatif — les entités fonctionnent identiquement quel que soit le préfixe.
:::

## Importer le dashboard Home Assistant

Un dashboard Lovelace complet est disponible dans le repo : [`homeassistant/dashboard/frangipool.yaml`](https://github.com/gaetanars/FrangiPool/blob/main/homeassistant/dashboard/frangipool.yaml).

**Prérequis :**
- [HACS](https://hacs.xyz/) installé
- Carte [apexcharts-card](https://github.com/RomRider/apexcharts-card) installée via HACS

**Import :**
1. Copiez le contenu de `homeassistant/dashboard/frangipool.yaml`.
2. Dans HA : **Paramètres → Tableaux de bord → Ajouter un tableau de bord**.
3. Sélectionnez **À partir d'une configuration YAML** (éditeur brut).
4. Collez le contenu et enregistrez.

Le dashboard s'adapte automatiquement au preset installé : les sections pH, Redox, Surpresseur et Calibration sont masquées si les entités correspondantes sont absentes.

## Vérifications initiales recommandées

| Vérification | Où vérifier |
|---|---|
| Heure synchronisée | `sensor.frangipool_*` → valeurs mises à jour |
| Température piscine affichée | Attend que la pompe tourne ≥ 20 min (délai configurable) |
| Mode filtration actif | `select.frangipool_mode_filtration` → **Auto** par défaut |
| Antigel configuré | `number.frangipool_consigne_antigel` → **0 °C** par défaut |
| Phase courante | `text_sensor.frangipool_phase_filtration` → Cycle matin / Pause / Cycle soir |
