# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.2.0] - 2026-05-26
### :sparkles: New Features
- [`afddcb6`](https://github.com/gaetanars/FrangiPool/commit/afddcb68c96275988efe228476a51c95a8a87cbe) - **filtration**: autonomous ESPHome filtration scheduling *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`b5573bb`](https://github.com/gaetanars/FrangiPool/commit/b5573bb0f1b4c63ac795420769e4d56ceec1ac99) - fusionner frangipool/pcb dans le monorepo + release workflow *(PR [#7](https://github.com/gaetanars/FrangiPool/pull/7) by [@gaetanars](https://github.com/gaetanars))*
- [`eb31048`](https://github.com/gaetanars/FrangiPool/commit/eb31048a714b34d8af6e43dc51273f16b85fce66) - **ph**: switch calibration to two-points (Gravity v2.0) *(PR [#9](https://github.com/gaetanars/FrangiPool/pull/9) by [@gaetanars](https://github.com/gaetanars))*
- [`e2b6345`](https://github.com/gaetanars/FrangiPool/commit/e2b634589df1f0713b25b968a0c2e5629d9f754c) - **filtration**: split pivot and pause per submode (courbe/hiver) *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`2b48f12`](https://github.com/gaetanars/FrangiPool/commit/2b48f12b689e90649ff6826974b8e2931b849661) - **dashboard**: redesign with sections view, gauges and calibration *(commit by [@gaetanars](https://github.com/gaetanars))*

### :bug: Bug Fixes
- [`e4249d5`](https://github.com/gaetanars/FrangiPool/commit/e4249d5665bdaa613eb677e194a8fe3cd8fcd1fd) - **redox**: replace sliding window filter with EMA on pool_redox *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`2260859`](https://github.com/gaetanars/FrangiPool/commit/2260859377e61c88208c5ad36b0a79114c9dfbbf) - **select**: replace deprecated .state with .current_option() on select components *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`0ccaa54`](https://github.com/gaetanars/FrangiPool/commit/0ccaa5456f519e98565e0a4f5feed271bc12e03e) - **ci**: correct semver glob pattern to match single-digit version components *(commit by [@gaetanars](https://github.com/gaetanars))*

### :recycle: Refactors
- [`805a310`](https://github.com/gaetanars/FrangiPool/commit/805a3100680837d09d0f183964f9094899f7e9d6) - **redox**: simplify electrolyser regulation to pure hysteresis *(PR [#10](https://github.com/gaetanars/FrangiPool/pull/10) by [@gaetanars](https://github.com/gaetanars))*

### :memo: Documentation Changes
- [`449e258`](https://github.com/gaetanars/FrangiPool/commit/449e258c73cac29d3ab07f205816334952b1b42d) - **solutions**: capture tag-triggered release workflow hardening learning *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`24906df`](https://github.com/gaetanars/FrangiPool/commit/24906df3395832cc475cf9b85bfac82aee76905f) - **solutions**: capture split tag-triggered release monorepo learning *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`5ee385a`](https://github.com/gaetanars/FrangiPool/commit/5ee385a02007e962bb8c9cc1bf79bbbf91c81356) - **solutions**: capture ESPHome string-vs-int restore_value pattern *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`e5bf4b5`](https://github.com/gaetanars/FrangiPool/commit/e5bf4b55a2838facedae470fbb1867a9004c7797) - **claude**: generalize docs/solutions reference to cover all categories *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`ba9af37`](https://github.com/gaetanars/FrangiPool/commit/ba9af37c670493affbdf6b60d4f0f9160b3be571) - sync AI context with current implementation state *(commit by [@gaetanars](https://github.com/gaetanars))*


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
[v0.2.0]: https://github.com/gaetanars/FrangiPool/compare/v0.1.0...v0.2.0
