# FrangiPool

[![ESPHome](https://img.shields.io/badge/ESPHome-ESP32-blue?logo=esphome&logoColor=white)](https://esphome.io)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.6%2B-41BDF5?logo=home-assistant&logoColor=white)](https://www.home-assistant.io)
[![GitHub release](https://img.shields.io/github/v/release/gaetanars/FrangiPool?label=derni%C3%A8re%20version&color=brightgreen)](https://github.com/gaetanars/FrangiPool/releases)
[![GitHub stars](https://img.shields.io/github/stars/gaetanars/FrangiPool?style=social)](https://github.com/gaetanars/FrangiPool/stargazers)

Firmware ESP32 open-source pour l'automatisation d'une piscine à sel. La filtration est gérée directement par l'ESP — calcul des horaires, démarrage et arrêt de la pompe — sans aucune automatisation Home Assistant requise.

## 📖 Documentation

**[gaetanars.github.io/FrangiPool](https://gaetanars.github.io/FrangiPool/)** — documentation complète, sélecteur de preset et installeur en un clic.

## Fonctionnalités

- **Filtration autonome** — calcul des horaires selon la température (modes Off / Hiver / Courbe / Auto), deux cycles par jour, protection antigel
- **Électrolyseur** — contrôle par relais, régulation automatique par seuil Redox
- **Redox / ORP** — mesure continue, calibration par solution tampon ou offset API
- **pH** — mesure continue, calibration two-points (pH 7 + pH 4)
- **Booster** — relais surpresseur optionnel synchronisé avec la pompe principale
- **8 presets** pour couvrir tous les matériels courants

## Installation rapide

1. Connectez l'ESP32 par USB (Chrome ou Edge requis).
2. Rendez-vous sur **[gaetanars.github.io/FrangiPool](https://gaetanars.github.io/FrangiPool/)**.
3. Sélectionnez le preset correspondant à votre matériel et cliquez **Installer FrangiPool**.
4. Configurez le WiFi, adoptez dans ESPHome Dashboard → terminé.

## PCB

Le PCB est disponible sous [pcb/](pcb/). Les Gerbers sont publiés en tant qu'asset `gerber.zip` sur les [releases PCB](https://github.com/gaetanars/FrangiPool/releases) (tags `pcb-*.*.*`).
