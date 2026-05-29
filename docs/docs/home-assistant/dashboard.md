---
sidebar_position: 1
title: Dashboard Home Assistant
description: Import et présentation du dashboard Lovelace FrangiPool — sections, cartes et compatibilité multi-presets.
---

# Dashboard Home Assistant

Un dashboard Lovelace complet est disponible dans le repo : [`homeassistant/dashboard/frangipool.yaml`](https://github.com/gaetanars/FrangiPool/blob/main/homeassistant/dashboard/frangipool.yaml).

## Prérequis

- **[HACS](https://hacs.xyz/)** installé dans Home Assistant
- Carte **[apexcharts-card](https://github.com/RomRider/apexcharts-card)** installée via HACS (pour les graphiques de tendances)
- Device renommé `frangipool` dans HA (voir [Nommage du device](../configuration/nommage-entity-ids))

## Import

1. Copiez le contenu du fichier [`homeassistant/dashboard/frangipool.yaml`](https://github.com/gaetanars/FrangiPool/blob/main/homeassistant/dashboard/frangipool.yaml).
2. Dans HA : **Paramètres → Tableaux de bord → Ajouter un tableau de bord**.
3. Donnez un nom au tableau de bord (ex. `FrangiPool`).
4. Une fois créé, ouvrez-le et activez le **mode édition** (icône crayon).
5. Cliquez sur **⋮ → Éditeur brut**.
6. Remplacez tout le contenu par le YAML copié et enregistrez.

## Structure du dashboard

Le dashboard utilise le layout **Sections view** (HA 2024.3+) — responsive natif : 1 colonne sur mobile, 3 colonnes sur desktop.

### Badges permanents (en tête)

Toujours visibles en haut du dashboard :
- **État pompe** — On/Off
- **Mode filtration** — Off / Hiver / Courbe / Auto
- **Phase courante** — Cycle matin / Pause / Cycle soir
- **Alerte antigel** — apparaît uniquement si l'antigel est actif
- **Mode forcé** — apparaît avec le compte à rebours si actif

### Signes vitaux

Jauges colorées avec plages vert/orange/rouge :
- **pH** — vert 7.0–7.6, orange en dehors, rouge aux extrêmes
- **Redox/ORP** — vert 650–750 mV
- **Température piscine**

### Filtration

- Interrupteur pompe, sélecteur mode, phase courante
- Horaires du jour (format HH:MM–HH:MM / HH:MM–HH:MM)
- Durée planifiée vs durée effective depuis minuit

### Mode forcé

- Compteur de temps restant
- Boutons 2h / 6h / 24h / Stop

### Électrolyseur

- Sélecteur mode (Off / Auto / Forcé)
- Compteur de durée d'électrolyse
- Consigne Redox et état de régulation (presets avec Auto-régulation)

### Surpresseur

Section visible uniquement sur les presets avec le flag **B**.

### Calibration

- Redox : boutons 225 mV / 475 mV / Reset + offset courant
- pH : bouton Démarrer + Reset usine + dernier résultat

### Tendances 7 jours

Graphiques apexcharts avec zones de couleur :
- pH sur 7 jours
- Redox/ORP sur 7 jours
- Température piscine sur 7 jours

### Configuration filtration

Tous les paramètres ajustables directement depuis le dashboard :
- Pivots Courbe et Hiver, pauses, ratio matin, coefficient, mode hiver
- Consigne antigel, délai mesures

### Diagnostics

- Connexion ESP (connected/disconnected)
- RSSI (signal WiFi en dBm)
- Uptime (en secondes — HA ne supporte pas de formatage durée natif pour ce type de capteur)
- Bouton redémarrage

## Adaptation automatique aux presets

Les sections **pH**, **Redox**, **Surpresseur**, **Électrolyseur (régulation)** et **Calibration** sont masquées automatiquement via la visibilité conditionnelle native de HA si les entités correspondantes sont absentes. **Un seul fichier dashboard couvre tous les presets**, du plus simple (`frangipool-e`) au plus complet (`frangipool-berp`).
