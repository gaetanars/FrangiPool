---
id: intro
slug: /
sidebar_position: 0
title: Bienvenue
description: FrangiPool — firmware ESP32 open-source pour l'automatisation d'une piscine à sel.
---

# Bienvenue dans la documentation FrangiPool

**FrangiPool** est un firmware ESP32 open-source pour l'automatisation complète d'une piscine à sel. La filtration est gérée directement par l'ESP — calcul des horaires, démarrage et arrêt de la pompe — sans aucune automatisation Home Assistant requise.

Home Assistant reste utile pour la supervision, les notifications et l'ajustement des paramètres, mais son absence ou son redémarrage n'interrompt jamais la filtration.

## Par où commencer ?

- **Nouveau ?** → [Choisir son preset et flasher](./getting-started/choisir-son-preset.mdx) pour installer FrangiPool en quelques minutes.
- **Device installé ?** → [Mise en service](./getting-started/mise-en-service.md) pour configurer les sondes et le dashboard.
- **Comprendre le fonctionnement ?** → [Filtration autonome](./fonctionnement/filtration-autonome.md) pour les détails du planificateur.
- **Calibrer les sondes ?** → [Calibration Redox](./configuration/calibration-redox.md) et [Calibration pH](./configuration/calibration-ph.md).
- **Construire le PCB ?** → [PCB & Câblage](./pcb-cablage/presentation.md).

## Ce que FrangiPool gère

| Fonctionnalité | Description |
|---|---|
| **Filtration autonome** | Calcul des horaires selon la température, deux cycles par jour, protection antigel |
| **Mode forcé** | Pompe en marche pendant 2h / 6h / 24h pour les traitements ponctuels |
| **Électrolyseur** | Contrôle par relais, régulation automatique par seuil Redox |
| **Redox / ORP** | Mesure continue, calibration par solution tampon ou offset API |
| **pH** | Mesure continue, calibration two-points (pH 7 + pH 4) |
| **Booster** | Relais surpresseur optionnel synchronisé avec la pompe principale |

## Prérequis matériels

- ESP32 (module DevKit standard)
- [PCB FrangiPool](./pcb-cablage/presentation.md) (ou câblage équivalent)
- Home Assistant ≥ 2024.6 (pour la synchronisation de l'heure et les notifications)
- ESPHome ≥ 2024.6 (pour les mises à jour OTA via Dashboard)
