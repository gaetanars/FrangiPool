# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.2] - 2026-05-28
### :sparkles: New Features
- [`09c6ee2`](https://github.com/gaetanars/FrangiPool/commit/09c6ee299d3eecfbf683b3a6253c7225d9891a45) - **dallas**: replace address substitutions with index-based swap action *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`b8caf42`](https://github.com/gaetanars/FrangiPool/commit/b8caf42faed4347c64c8c1bb3849d5b1a63016d6) - **ci**: add workflow_dispatch to release-firmware, extract version from preflight *(commit by [@gaetanars](https://github.com/gaetanars))*

### :bug: Bug Fixes
- [`41e3b72`](https://github.com/gaetanars/FrangiPool/commit/41e3b722d8c975e9f70f6be9160705e76859f85d) - use device name for AP SSID *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`0a2ce25`](https://github.com/gaetanars/FrangiPool/commit/0a2ce25aaab91347fa4b326cd5d4c84474c22ed2) - **ci**: serve factory binaries from Pages to fix CORS on web installer *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`b977b79`](https://github.com/gaetanars/FrangiPool/commit/b977b79385bd5d04bbd66e660ad6c703d8a2378d) - **ci**: restore hardcoded BUILD_DIR for firmware binary collection *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`f4d6372`](https://github.com/gaetanars/FrangiPool/commit/f4d6372f949e8f075a1039f77436ee79f991cf31) - **ci**: upload firmware via gh cli, fix deploy-pages version resolution *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`8336815`](https://github.com/gaetanars/FrangiPool/commit/8336815e9511e5973aec68e3382bbaa04076ca25) - **ci**: use draft→upload→publish pattern for immutable releases *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`3b9e656`](https://github.com/gaetanars/FrangiPool/commit/3b9e656cb485fd153fb66dcb3909b8f19656fe89) - **ci**: remove broken preset table from release body *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`8119411`](https://github.com/gaetanars/FrangiPool/commit/8119411b2178895a474ae30d62c44a4c6e3be335) - **ci**: use ncipollo immutableCreate for immutable-safe release *(commit by [@gaetanars](https://github.com/gaetanars))*

### :memo: Documentation Changes
- [`1ac08fb`](https://github.com/gaetanars/FrangiPool/commit/1ac08fb9f167d62aeb5f83c36a998b9c9e631c00) - update temperature section to reflect index-based Dallas probes *(commit by [@gaetanars](https://github.com/gaetanars))*


## [0.4.1] - 2026-05-28
### :sparkles: New Features
- [`09c6ee2`](https://github.com/gaetanars/FrangiPool/commit/09c6ee299d3eecfbf683b3a6253c7225d9891a45) - **dallas**: replace address substitutions with index-based swap action *(commit by [@gaetanars](https://github.com/gaetanars))*

### :bug: Bug Fixes
- [`41e3b72`](https://github.com/gaetanars/FrangiPool/commit/41e3b722d8c975e9f70f6be9160705e76859f85d) - use device name for AP SSID *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`0a2ce25`](https://github.com/gaetanars/FrangiPool/commit/0a2ce25aaab91347fa4b326cd5d4c84474c22ed2) - **ci**: serve factory binaries from Pages to fix CORS on web installer *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`b977b79`](https://github.com/gaetanars/FrangiPool/commit/b977b79385bd5d04bbd66e660ad6c703d8a2378d) - **ci**: restore hardcoded BUILD_DIR for firmware binary collection *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`f4d6372`](https://github.com/gaetanars/FrangiPool/commit/f4d6372f949e8f075a1039f77436ee79f991cf31) - **ci**: upload firmware via gh cli, fix deploy-pages version resolution *(commit by [@gaetanars](https://github.com/gaetanars))*

### :memo: Documentation Changes
- [`1ac08fb`](https://github.com/gaetanars/FrangiPool/commit/1ac08fb9f167d62aeb5f83c36a998b9c9e631c00) - update temperature section to reflect index-based Dallas probes *(commit by [@gaetanars](https://github.com/gaetanars))*


## [v0.3.0] - 2026-05-27
### :sparkles: New Features
- [`fd06856`](https://github.com/gaetanars/FrangiPool/commit/fd06856ad6d78880538e687ba4a1343598f8ff56) - **base**: remove secrets dependency for zero-config distribution *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`fe6d767`](https://github.com/gaetanars/FrangiPool/commit/fe6d7677609497c43c4df7521ecaca157e2258cf) - **distribution**: add web installer, CI firmware compilation, and GitHub Pages *(commit by [@gaetanars](https://github.com/gaetanars))*

### :bug: Bug Fixes
- [`3d146b0`](https://github.com/gaetanars/FrangiPool/commit/3d146b0ab8e4b5593bdfffec71e81b1e165f0318) - **base**: use http_request platform for OTA instead of esphome *(commit by [@gaetanars](https://github.com/gaetanars))*
- [`2c8524c`](https://github.com/gaetanars/FrangiPool/commit/2c8524c66efff61a949d277367ae16939727d777) - **presets**: use !include for packages, keep @main for dashboard import only *(commit by [@gaetanars](https://github.com/gaetanars))*

### :memo: Documentation Changes


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
[v0.3.0]: https://github.com/gaetanars/FrangiPool/compare/v0.2.0...v0.3.0
[0.4.1]: https://github.com/gaetanars/FrangiPool/compare/0.3.0...0.4.1
[0.4.2]: https://github.com/gaetanars/FrangiPool/compare/0.3.0...0.4.2
