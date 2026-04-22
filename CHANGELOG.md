# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## Pre-monorepo history

Avant v0.2.0, firmware (`gaetanars/FrangiPool`) et PCB (`frangipool/pcb`) vivaient dans deux dépôts séparés avec des tags indépendants — chacun possédait son propre `v0.1.0`. Les entrées ci-dessous préservent ces releases historiques.

### firmware v0.1.0 - 2026-04-06

Première release du firmware ESPHome — configuration pour l'automatisation d'une piscine à sel sur ESP32.

**Inclus :**

- **Pompe** (GPIO25, relais active-low), capteurs Dallas (GPIO23), protection antigel
- **Électrolyseur** (GPIO27), compteur de minutes d'électrolyse
- **Surpresseur** (GPIO26), mode Off/Auto/Forcé
- **Redox/ORP** (ADS1115 A0), calibration, tendance
- **pH** (ADS1115 A1), calibration
- **Auto-régulation Redox** de l'électrolyseur
- Interface web locale port 80
- 8 presets prêts à flasher via ESPHome dashboard

La gestion autonome de la filtration (sans automatisation Home Assistant) a été livrée dans une version ultérieure.

### pcb v0.1.0 - 2023-06-08

Première release du PCB — carte 5V pour ESP32 avec ADS1115, bus 1-Wire, connecteur Nextion.

- First PCB release ([`0704aa1`](https://github.com/frangipool/pcb/commit/0704aa11305ced475346eaf1935a6a9688d9d717) par [@gaetanars](https://github.com/gaetanars))

Imported from [frangipool/pcb](https://github.com/frangipool/pcb) @ `cfd2e9f` (voir aussi [pcb/CHANGELOG.md](pcb/CHANGELOG.md) pour l'archive originale).
