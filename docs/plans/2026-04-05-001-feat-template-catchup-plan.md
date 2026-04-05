---
title: "feat: Rattrapage template ESPHome — API updates, smart electrolyser, Redox trend"
type: feat
status: completed
date: 2026-04-05
origin: docs/brainstorms/2026-04-05-template-catchup-requirements.md
---

# feat: Rattrapage template ESPHome — API updates, smart electrolyser, Redox trend

## Overview

Mettre à jour `template/frangipool.yaml.tmpl` pour le synchroniser avec le fichier personnel `../local/esphome/frangipool.yaml`, qui a évolué de façon autonome. Le travail touche un seul fichier source — toutes les modifications se propagent automatiquement aux 8 variants générés via `go generate ./...`.

## Problem Frame

Trois catégories de décalage entre le template partagé et le fichier local :
1. **Syntaxe ESPHome cassante** — l'API a évolué (`dallas` → `one_wire`, `homeassistant.service` → `homeassistant.action`, etc.) et le template actuel produit des configs qui ne compilent plus.
2. **Logique améliorée** — la détection antigel, le suivi de l'uptime pompe, et le contrôle de l'électrolyseur ont été profondément retravaillés localement.
3. **Nouvelles fonctionnalités** — contrôle électrolyseur Off/Auto/Forcé avec délai de stabilité, et suivi de la tendance Redox.

(voir origin : `docs/brainstorms/2026-04-05-template-catchup-requirements.md`)

## Requirements Trace

- R1–R4 : Mises à jour API ESPHome (syntaxe cassante, tous les variants)
- R5 : `pump_uptime` en minutes
- R6 : Réécriture complète de la logique antigel avec hystérésis
- R7 : Intervalle 30s maintien pompe en antigel
- R8 : Global `effective_electrolysis_minutes` (bloc `Electrolyser`)
- R9–R13 : Select `Mode Electrolyseur` (Off/Auto/Forcé), logique Auto, globals associés
- R14–R17 : Tendance Redox (globals, intervalle 5min, text_sensor)
- R18 : Conserver pH/Booster, corriger bug indentation `realtime_ph`

## Scope Boundaries

- `template/main.go` et `template/config.yaml` ne sont pas modifiés (pas de nouveau variant, pas de nouveau flag Go struct)
- Les credentials wifi et les adresses Dallas restent hors template
- La logique `Mode Filtration` (Auto/On 24h/Off/Hiver) est **supprimée**
- `frangipool_*.yaml` et `README.md` ne sont jamais édités directement

## Context & Research

### Relevant Code and Patterns

- Fichier source unique : `template/frangipool.yaml.tmpl`
- Struct Go passé au template : `deviceConfig` (Name, Electrolyser, Redox, PH, Booster) — aucun champ à ajouter
- Syntaxe template existante : `{{ if .Redox }}`, `{{- if and (.Redox) (.Electrolyser) }}`, `{{ if or .Redox .PH }}`
- Conventions whitespace : `{{-` (trim) à l'intérieur de blocs YAML indentés ; `{{` (no trim) aux frontières de sections de haut niveau
- Régénération : `go generate ./...` depuis la racine du dépôt
- CI auto-commit les `frangipool_*.yaml` sur branches non-main (pas le README.md)

### Institutional Learnings

- Aucun `docs/solutions/` — ce plan est le premier artefact de planification structuré

### External References

- ESPHome : deux capteurs `dallas_temp` avec la même adresse physique et des `id` distincts sont supportés (confirmé sur la version utilisée)
- ESPHome `homeassistant.action` : clé externe = `homeassistant.action:`, clé interne = `action:` (remplace `service:`). Pour messages dynamiques, utiliser `data_template:` avec Jinja2 côté HA (ex : `{{ states('sensor.xxx') }}`). L'ancien `homeassistant.service` reste fonctionnel mais est déprécié (2024.6+).

## Key Technical Decisions

- **`pipe_temp_raw` comme second `dallas_temp` sur la même adresse** : L'approche du fichier local est valide — deux `platform: dallas_temp` déclarant la même `address:` avec des `id:` distincts fonctionnent sans erreur dans la version ESPHome utilisée. `pipe_temp_raw` est un capteur `dallas_temp` (internal: true, sans filtre) co-déclaré avec `pipe_temp`. La lambda antigel lit `pipe_temp_raw.state`. (voir origin : R6 Deferred to Planning — résolu)
- **Notifications antigel avec `{{ states(...) }}`** : Le fichier local utilise un template Jinja2 évalué côté HA (`{{ states('sensor.temperature_canalisation') }}`) dans `data_template:`, sans `variables:`. Cette approche est plus simple et évite de passer les valeurs C++ côté ESPHome.
- **`redox_stable_minutes` avec `restore_value: true`** : La valeur est conservée à travers les redémarrages. Au premier flash, `initial_value: 0` — le compteur peut autoriser l'électrolyseur après 30 min même si la tendance Redox est en hausse (car `redox_trend_state` démarre à 0 = stable). Comportement accepté (voir origin : Deferred to Planning R10/R17).
- **Suppression de `Mode Filtration` select** : Aucun ID ni référence lambda ne pointe vers cet entité dans le template actuel — la suppression est sans risque de régression.

## Open Questions

### Resolved During Planning

- **Dual-address Dallas** : Deux `dallas_temp` avec la même adresse et des `id` distincts fonctionnent sans erreur dans la version ESPHome utilisée — utiliser directement la même approche que le fichier local (`pipe_temp` filtré + `pipe_temp_raw` interne non filtré). (voir Key Technical Decisions)
- **Syntaxe notifications dynamiques** : `data_template:` avec `{{ states(...) }}` côté HA, pas de `variables:` C++ nécessaire.
- **`effective_electrolysis_minutes` placement** : Incrémenté dans une branche conditionnelle indépendante de l'intervalle 1min, gated sur `pump.state && electrolyser.state` — sans dépendance au délai `pump_uptime_delay`.

### Deferred to Implementation

- **`pipe_temp` `update_interval` explicite** : Le template actuel n'a pas d'`update_interval` sur le capteur `dallas` — confirmer que `one_wire` utilise l'`update_interval` déclaré sur chaque capteur `dallas_temp` individuel (valeur cible : 10s).

## High-Level Technical Design

> *Ce tableau illustre l'approche générale et est un guide de direction, pas une spécification d'implémentation.*

### Changements par section du template

| Section | Avant | Après |
|---|---|---|
| Hardware bus temp | `dallas: - pin: GPIO23` | `one_wire: - platform: gpio / pin: GPIO23` |
| Capteur pipe_temp | `platform: dallas` + filtres | `platform: dallas_temp` + filtres |
| OTA | `ota:` | `ota: - platform: esphome` |
| ESP32 framework | *(absent)* | `framework: type: esp-idf` |
| Capteur `pipe_temp_raw` | *(absent)* | `dallas_temp` interne, même adresse que `pipe_temp`, sans filtre |
| Globals électrolyseur | *(absent)* | `electrolyser_last_turn_on`, `effective_electrolysis_minutes`, `redox_stable_minutes` (dans `{{ if .Electrolyser }}`) |
| Globals Redox | `store_pool_redox`, `redox_offset` | + `last_redox_trend_value`, `redox_trend_state` (dans `{{ if .Redox }}`) |
| Select filtration | `Mode Filtration` (toujours présent) | **Supprimé** |
| Select électrolyseur | *(absent)* | `Mode Electrolyseur` (Off/Auto/Forcé) (dans `{{ if .Electrolyser }}`) |
| Intervalle 30s | *(absent)* | Maintien pompe si antigel actif |
| Intervalle 1min | Stocke temp/redox/pH si pompe ON | + compteur `effective_electrolysis_minutes` + logique Auto électrolyseur |
| Intervalle 5min | *(absent)* | Calcul tendance Redox (dans `{{ if .Redox }}`) |
| Binary sensor antigel | `lambda` basique + `on_value_range` sur `pipe_temp` | Lambda hystérésis statique lisant `pipe_temp_raw.state` + `delayed_on/off` + callbacks HA |
| pool_redox `on_value_range` | Commande directe `electrolyser.turn_on/off` | Conditionné au mode Auto via lambda |
| Text sensor | *(absent)* | `Tendance Redox` (dans `{{ if .Redox }}`) |
| Notifications HA | `homeassistant.service` + `service:` | `homeassistant.action` + `action:` + `data_template:` avec Jinja2 HA |
| pH `realtime_ph` | `filters:` à 5 espaces (bug) | `filters:` à 4 espaces (fix) |

## Implementation Units

- [ ] **Unit 1: Migrations API globales + fix pH**

**Goal:** Mettre à jour la syntaxe ESPHome cassante sur tout le template et corriger le bug d'indentation pH. Crée une base stable avant toute modification logique.

**Requirements:** R1, R2, R3, R4, R18

**Dependencies:** Aucune

**Files:**
- Modify: `template/frangipool.yaml.tmpl`

**Approach:**
- **R1** : Remplacer le bloc `dallas:` (lignes 45–47) par `one_wire: - platform: gpio / pin: GPIO23`. Changer `platform: dallas` → `platform: dallas_temp` sur les deux sensors de température (lignes ~202, ~214). Ajouter `update_interval: 10s` si absent sur chaque `dallas_temp`.
- **R2** : Remplacer `ota:` seul par `ota: - platform: esphome`.
- **R3** : Remplacer toutes les occurrences de `homeassistant.service:` par `homeassistant.action:` et le champ `service:` imbriqué par `action:`. Les messages sans valeur dynamique utilisent `data:` ; les notifications antigel (ajoutées dans Unit 2) utiliseront `data_template:`.
- **R4** : Ajouter `framework: type: esp-idf` sous la clé `esp32:`.
- **R18** : Corriger l'indentation de `filters:` dans `realtime_ph` (ligne ~339 du template) : 5 espaces → 4 espaces.

**Patterns to follow:**
- Syntaxe `one_wire:` de `../local/esphome/frangipool.yaml` (lignes 49–51)
- Syntaxe `homeassistant.action:` du fichier local (lignes ~418–436)

**Test scenarios:**
- Happy path : `go generate ./...` s'exécute sans erreur après ces changements seuls
- Happy path : `frangipool_salt.yaml` généré contient `one_wire:` et non `dallas:` en tête de fichier
- Happy path : `frangipool_salt.yaml` contient `ota: - platform: esphome`
- Happy path : `frangipool_salt.yaml` contient `framework: type: esp-idf` sous `esp32:`
- Happy path : `frangipool_salt.yaml` et `frangipool_salt_booster.yaml` contiennent `homeassistant.action:` sans occurrence de `homeassistant.service:`
- Happy path : Dans `frangipool_salt.yaml`, la section `realtime_ph` a `filters:` indenté à 4 espaces (PH=true variants)
- Edge case : `frangipool_salt_wo_ph_wo_redox.yaml` (variant minimal) contient `one_wire:`, `esp-idf`, `ota: - platform: esphome` — les migrations s'appliquent à tous les variants

**Verification:**
- `go generate ./...` complète sans erreur
- Aucune occurrence de `dallas:` ou `homeassistant.service:` dans les fichiers générés

---

- [ ] **Unit 2: Core logic — pump_uptime, antigel, intervalle 30s**

**Goal:** Corriger le calcul d'uptime pompe en minutes, réécrire la logique antigel avec hystérésis et filtres temporels, ajouter l'intervalle de maintien pompe.

**Requirements:** R5, R6, R7

**Dependencies:** Unit 1

**Files:**
- Modify: `template/frangipool.yaml.tmpl`

**Approach:**
- **R5** : Dans la lambda du sensor `pump_uptime`, changer le calcul pour retourner des minutes : `(esptime.now().timestamp - pump_last_turn_on) / 60.0`. Ne pas toucher la comparaison `pump_uptime.state >= pump_uptime_delay.state` dans l'intervalle — elle est déjà en minutes.
- **R6 — `pipe_temp_raw`** : Ajouter un second `platform: dallas_temp` avec la même `address: $temp_address`, `id: pipe_temp_raw`, `internal: true`, `update_interval: 10s`, sans filtre. La lambda antigel lit `pipe_temp_raw.state`.
- **R6 — binary sensor antigel** : Remplacer l'antigel existant (basé sur `on_value_range` de `pipe_temp`) par :
  - Lambda avec hystérésis statique lisant `pipe_temp_raw.state` (seuils : on si temp < `max_antifreeze_temp - 1.0`, off si temp >= `max_antifreeze_temp`)
  - Filtres `delayed_on: 120s` et `delayed_off: 300s`
  - Callback `on_press` : notification HA avec `data_template:` incluant `{{ states('sensor.temperature_canalisation') }}`
  - Callback `on_release` : `switch.turn_off: pump` + notification HA similaire
  - Supprimer l'`on_value_range` existant sur `pipe_temp`
- **R7** : Ajouter un bloc `interval:` de 30s : si `binary_sensor.is_on: antifreeze` alors `switch.turn_on: pump`

**Patterns to follow:**
- Implémentation complète du fichier local `../local/esphome/frangipool.yaml` (lignes 393–436 pour antifreeze, 94–102 pour intervalles, 293–319 pour sensors temp)

**Test scenarios:**
- Happy path : Dans `frangipool_salt.yaml`, le sensor `pump_uptime` retourne `/ 60.0` dans sa lambda
- Happy path : Le `binary_sensor antifreeze` dans tous les variants générés contient `delayed_on` et `delayed_off`
- Happy path : L'`on_press` de `antifreeze` contient `homeassistant.action:` avec `data_template:` (message avec température)
- Happy path : L'`on_release` de `antifreeze` contient `switch.turn_off: pump`
- Happy path : Un intervalle de `30s` est présent dans tous les variants générés
- Edge case : Aucune occurrence de `on_value_range` sur `pipe_temp` dans les fichiers générés (la logique est déplacée vers le binary sensor)
- Happy path : `pipe_temp_raw` (dallas_temp, internal, sans filtre) est présent dans tous les variants générés

**Verification:**
- `go generate ./...` sans erreur
- Inspection de `frangipool_salt.yaml` : `pump_uptime` lambda, `antifreeze` binary sensor avec `delayed_on/off`, intervalle 30s

---

- [ ] **Unit 3: Suppression Mode Filtration + Smart electrolyser**

**Goal:** Retirer le select `Mode Filtration` (non maintenu), ajouter le select `Mode Electrolyseur` (Off/Auto/Forcé) avec la logique Auto dans l'intervalle 1min et les callbacks associés.

**Requirements:** R8, R9, R10, R11, R12, R13

**Dependencies:** Unit 2

**Files:**
- Modify: `template/frangipool.yaml.tmpl`

**Approach:**
- **Suppression** : Retirer le bloc `Mode Filtration` select (entité toujours présente, lignes ~110–122). Le bloc `Mode Surpresseur` (`{{ if .Booster }}`) reste intact.
- **R9** : Ajouter dans la section `select:`, sous `{{ if .Electrolyser }}`, le select `Mode Electrolyseur` avec options Off / Auto / Forcé, callback `on_value` qui met à jour l'état de l'électrolyseur selon le mode (voir fichier local lignes 177–202).
- **R8 + R11** : Dans la section `globals`, dans le bloc `{{- if .Electrolyser }}`, ajouter : `electrolyser_last_turn_on` (int, restore: true), `effective_electrolysis_minutes` (int, restore: true, initial: 0), `redox_stable_minutes` (int, restore: true, initial: 0).
- **R10** : Dans l'intervalle 1min, dans un bloc `{{- if .Electrolyser }}` conditionnel, ajouter :
  - Incrément `effective_electrolysis_minutes` si `pump.state && electrolyser.state` (branche indépendante, sans `pump_uptime_delay`)
  - Logique Auto : extinction si `pool_redox > max_redox && electrolyser.state` ; allumage si `pool_redox < min_redox && !electrolyser.state && redox_stable_minutes >= 30`
  - Incrément/reset `redox_stable_minutes` selon `redox_trend_state` (dépend de Unit 4 pour que `redox_trend_state` existe — voir note de séquençage)
- **R12** : Sur le switch `electrolyser`, ajouter `on_turn_on` (stocke timestamp dans `electrolyser_last_turn_on`) et `on_turn_off` (reset `effective_electrolysis_minutes` à 0).
- **R13** : Sur `pool_redox`, modifier les `on_value_range` existants pour conditionner les actions à `electrolyser_mode.state == "Auto"` via lambda.

**Note de séquençage :** La logique `redox_stable_minutes` dans l'intervalle 1min (R10/R17) référence `redox_trend_state` qui est ajouté dans Unit 4. Deux options pour le développeur : (a) implémenter Units 3 et 4 ensemble, ou (b) implémenter Unit 3 d'abord avec `redox_stable_minutes` incrémenté systématiquement (sans condition sur `redox_trend_state`), puis mettre à jour en Unit 4. Option (a) recommandée.

**Patterns to follow:**
- Fichier local `../local/esphome/frangipool.yaml` : select (lignes 177–202), globals électrolyseur (lignes 65–92), intervalle 1min (lignes 102–162), switch callbacks (lignes 464–474)

**Test scenarios:**
- Happy path : `frangipool_salt.yaml` contient `Mode Electrolyseur` dans `select:` et ne contient pas `Mode Filtration`
- Happy path : `frangipool_salt_wo_ph_wo_redox.yaml` (Electrolyser=true, Booster=false) contient `Mode Electrolyseur` mais pas `Mode Surpresseur`
- Happy path : `frangipool_salt_booster.yaml` contient `Mode Electrolyseur` ET `Mode Surpresseur`
- Happy path : Les globals `electrolyser_last_turn_on`, `effective_electrolysis_minutes`, `redox_stable_minutes` sont présents dans tous les variants Electrolyser=true (tous les 8 actuels)
- Happy path : Le switch `electrolyser` dans les variants appropriés a `on_turn_on` et `on_turn_off`
- Edge case : `pool_redox` `on_value_range` dans `frangipool_salt.yaml` contient une lambda conditionnant l'action au mode Auto

**Verification:**
- `go generate ./...` sans erreur
- `frangipool_salt.yaml` : présence de `Mode Electrolyseur`, absence de `Mode Filtration`, globals électrolyseur présents, logique Auto dans l'intervalle 1min

---

- [ ] **Unit 4: Redox trend tracking**

**Goal:** Ajouter le suivi de tendance Redox — globals, intervalle 5min, text_sensor — dans tous les variants avec `Redox: true`.

**Requirements:** R14, R15, R16, R17

**Dependencies:** Unit 3

**Files:**
- Modify: `template/frangipool.yaml.tmpl`

**Approach:**
- **R14** : Dans le bloc `{{- if .Redox }}` des globals, ajouter : `last_redox_trend_value` (float, restore: true, initial: 0.0) et `redox_trend_state` (int, restore: no, initial: 0).
- **R15** : Ajouter un bloc `interval:` de 5min (dans `{{ if .Redox }}`). Calcule `diff = realtime_redox.state - last_redox_trend_value` ; si `diff > 2` → `redox_trend_state = 1` ; si `diff < -2` → `redox_trend_state = -1` ; sinon → `0`. Met à jour `last_redox_trend_value`.
- **R16** : Ajouter dans la section `text_sensor:` (à créer si elle n'existe pas) un `platform: template` "Tendance Redox" (entity_category: diagnostic), dans `{{ if .Redox }}`, avec lambda retournant "En montée", "En descente" ou "Stable".
- **R17** : Dans l'intervalle 1min du bloc `{{- if .Electrolyser }}`, ajouter la logique `redox_stable_minutes` : si `redox_trend_state <= 0` → incrémenter ; sinon → remettre à 0. Ce bloc doit lui-même être conditionnel sur `Redox && Electrolyser` (les deux).

**Patterns to follow:**
- Fichier local `../local/esphome/frangipool.yaml` : globals tendance (lignes 77–92), intervalles (lignes 162–175), text_sensor (lignes 533–544)

**Test scenarios:**
- Happy path : `frangipool_salt.yaml` (Redox=true) contient `last_redox_trend_value`, `redox_trend_state`, l'intervalle 5min, et `text_sensor` "Tendance Redox"
- Happy path : `frangipool_salt_wo_redox.yaml` (Redox=false) ne contient PAS ces éléments — isolation conditionnelle correcte
- Happy path : `frangipool_salt_wo_ph.yaml` (Redox=true, PH=false) contient les éléments Redox trend — indépendant du flag pH
- Edge case : `frangipool_salt_wo_redox.yaml` (Redox=false, Electrolyser=true) : `redox_stable_minutes` absent ou non incrémenté (R17 est `Redox && Electrolyser`)
- Edge case : `frangipool_salt_booster.yaml` contient les éléments Redox trend — le flag Booster n'interfère pas

**Verification:**
- `go generate ./...` sans erreur
- Inspection de `frangipool_salt.yaml` vs `frangipool_salt_wo_redox.yaml` : présence/absence des éléments Redox trend selon le flag
- Aucun `text_sensor:` dans les variants sans Redox

## System-Wide Impact

- **Fichiers modifiés** : `template/frangipool.yaml.tmpl` uniquement (Go struct inchangé)
- **Artifacts régénérés** : 8 fichiers `frangipool_*.yaml` + `README.md`
- **CI** : Le workflow `.github/workflows/go-generated.yaml` auto-commet les `frangipool_*.yaml` sur push de branche — travailler sur une feature branch
- **`frangipool_redox.yaml`** : Fichier orphelin à la racine (non généré, non dans `config.yaml`). Non concerné par ce plan, mais son existence peut surprendre — il représente une ancienne version manuelle.
- **Invariants préservés** : Toutes les fonctionnalités pH (blocs ADS1115 A1, calibration, offset) et Booster (switch, select) restent inchangées sauf les migrations API R1-R4.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Whitespace template incorrect → YAML invalide généré | Tester `go generate ./...` après chaque unit ; valider l'indentation dans les fichiers générés |
| Deux `dallas_temp` même adresse rejetés sur certaines versions ESPHome | Confirmé fonctionnel ; fallback : lire `pipe_temp.state` dans la lambda antigel si nécessaire |
| Logique Auto électrolyseur `redox_stable_minutes` références à `redox_trend_state` avant Unit 4 | Implémenter Units 3 et 4 ensemble (séquençage recommandé) |
| `text_sensor:` section absente du template actuel → erreur syntaxe YAML si ajoutée à mauvais endroit | Ajouter après la section `button:` ou avant `status_led:` en suivant la structure du fichier local |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-05-template-catchup-requirements.md](docs/brainstorms/2026-04-05-template-catchup-requirements.md)
- Référence implémentation locale : `../local/esphome/frangipool.yaml` (non versionné dans ce dépôt)
- Template actuel : `template/frangipool.yaml.tmpl`
- Variants actuels : `template/config.yaml`
- [ESPHome `dallas_temp`](https://esphome.io/components/sensor/dallas_temp.html)
- [ESPHome `homeassistant.action`](https://esphome.io/components/api.html#homeassistant-action)
