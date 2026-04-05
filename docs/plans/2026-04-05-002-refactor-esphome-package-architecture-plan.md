---
title: "refactor: Migrate to native ESPHome package architecture"
type: refactor
status: active
date: 2026-04-05
origin: docs/brainstorms/2026-04-05-esphome-package-architecture-requirements.md
---

# refactor: Migrate to native ESPHome package architecture

## Overview

Le projet remplace son générateur Go (`go generate`) par l'architecture native de packages ESPHome. Les 8 variantes générées (+ 1 fichier legacy `frangipool_redox.yaml` non généré) sont décomposées en 7 packages modulaires (`packages/`) et 8 fichiers presets à la racine. Chaque preset est directement importable via ESPHome Dashboard sans cloner le repo.

## Problem Frame

Le générateur Go produit 8 fichiers `frangipool_*.yaml` à partir d'un template. Ajouter une feature implique : toucher le template, relancer la génération, committer les fichiers générés. Pour l'utilisateur final, identifier la bonne variante parmi 8 est peu ergonomique.

ESPHome supporte nativement les `packages` — des fragments YAML composables. Les listes (`sensor:`, `switch:`, `globals:`, `interval:`) sont fusionnées additivement entre packages (vérifié : ESPHome PR #3555). Les IDs définis dans un package sont accessibles globalement après merge (vérifié : ESPHome issue #3354).

Contrainte confirmée : `dashboard_import.package_import_url` ne fonctionne pas en sous-dossier (ESPHome issue #4887 ouverte). **Les presets doivent donc être à la racine du repo.** Les packages eux-mêmes peuvent être dans `packages/`.

(see origin: docs/brainstorms/2026-04-05-esphome-package-architecture-requirements.md)

## Requirements Trace

- R1. Configuration découpée en 7 packages indépendants sous `packages/`
- R2. Packages composables — inclusion additive par ESPHome
- R3. Bus I2C et ADS1115 définis une seule fois dans `packages/i2c_ads1115.yaml`
- R4. Presets à la racine du repo (contrainte ESPHome issue #4887)
- R5. 8 presets couvrant les 8 variantes matérielles actuelles
- R6. Chaque preset contient `dashboard_import` avec son URL GitHub
- R7. Chaque preset contient `substitutions` avec valeurs par défaut
- R8-R11. Suppression complète du générateur Go et des fichiers générés
- R12-R13. Documentation mise à jour

## Scope Boundaries

- Pas de changement à la logique métier (seuils Redox, calculs pH, antigel, etc.)
- Pas de nouveau composant matériel
- Pas de CI de validation ESPHome (hors scope pour cette itération)
- `frangipool_redox.yaml` (fichier non généré, profil matériel distinct sans pompe/temp/antigel) est hors scope — conservé tel quel

## Context & Research

### Packages ESPHome — comportements clés

- **Merge additif :** chaque package contribue ses entrées aux listes (`sensor:`, `switch:`, `globals:`, `interval:`). Les scalaires sont last-write-wins.
- **IDs globaux :** un ID déclaré dans un package (`id: bus_a`) est référençable depuis n'importe quel autre package du preset.
- **`!extend <id>` :** permet à un package d'ajouter des champs à un composant déclaré dans un autre package. Utilisé pour `redox_electrolyser.yaml` → ajouter `on_value_range` au sensor `pool_redox` défini dans `redox.yaml`.
- **`substitutions:` :** fusionnées avec priorité au fichier preset (first-writer-wins par rapport aux packages).
- **Packages imbriqués :** non supportés — un package ne peut pas lui-même déclarer des `packages:`.

### Fichiers sources à décomposer

- `template/frangipool.yaml.tmpl` — source de vérité pour tout le contenu YAML
- `template/config.yaml` — 8 variantes avec 4 flags booléens (electrolyser, booster, redox, ph)
- `frangipool_*.yaml` — 9 fichiers générés/legacy à supprimer
- `.github/workflows/go-generated.yaml` — CI de génération à supprimer
- `main.go`, `go.mod`, `go.sum`, `mise.toml` — artifacts Go à supprimer

### Matrice de composition des presets

| Preset | base | i2c | elec | boost | redox | ph | redox_elec |
|--------|------|-----|------|-------|-------|----|------------|
| `salt_full.yaml` | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `salt_wo_ph.yaml` | ✓ | ✓ | ✓ | — | ✓ | — | ✓ |
| `salt_wo_redox.yaml` | ✓ | ✓ | ✓ | — | — | ✓ | — |
| `salt_minimal.yaml` | ✓ | — | ✓ | — | — | — | — |
| `salt_booster_full.yaml` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `salt_booster_wo_ph.yaml` | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| `salt_booster_wo_redox.yaml` | ✓ | ✓ | ✓ | ✓ | — | ✓ | — |
| `salt_booster_minimal.yaml` | ✓ | — | ✓ | ✓ | — | — | — |

**Note :** `redox_electrolyser` est inclus dans tous les presets qui ont à la fois electrolyser ET redox — y compris `salt_wo_ph` et `salt_booster_wo_ph`. Cela préserve le comportement existant : `frangipool_salt_wo_ph.yaml` inclut déjà Mode Electrolyseur et `on_value_range` via le template `{{ if and .Electrolyser .Redox }}`.

### Institutional Learnings

- `docs/brainstorms/2026-04-05-template-catchup-requirements.md` — le brainstorm précédent documente les décisions métier (modes électrolyseur, tendance Redox, antigel) qui restent inchangées.

## Key Technical Decisions

- **Presets à la racine (pas dans `presets/`)** : ESPHome issue #4887 — `dashboard_import` échoue silencieusement depuis un sous-dossier. (see origin)
- **`@main` comme ref pour les packages** : le projet est early-stage, peu d'utilisateurs, les mises à jour doivent se propager automatiquement. Pas de version pinning pour l'instant.
- **`i2c_ads1115.yaml` package séparé** : base.yaml fonctionne sans I2C pour les presets minimaux. Les presets qui ont redox ou pH incluent explicitement ce package.
- **`redox_electrolyser.yaml` utilise `!extend pool_redox`** : pour ajouter `on_value_range` au sensor défini dans `redox.yaml` sans dupliquer la déclaration.
- **Mode Electrolyseur (Off/Auto/Forcé) dans `redox_electrolyser.yaml`** : ce mode n'a de sens qu'avec un Redox. Tous les presets electrolyser+redox (y compris `salt_wo_ph` et `salt_booster_wo_ph`) incluent `redox_electrolyser.yaml` — comportement fidèle au template `{{ if and .Electrolyser .Redox }}`. Sans Redox (`salt_minimal`, `salt_wo_redox`), l'électrolyseur est un switch on/off sans Mode select.
- **Chaque package gère ses propres `interval:`** : plutôt que d'étendre l'interval central de base.yaml, chaque package (redox, ph, electrolyser) définit son propre interval 1min avec la même condition de garde (pompe active + uptime >= délai). Duplication légère mais packages indépendants.
- **go.mod/go.sum supprimables** : seul `gopkg.in/yaml.v3` est déclaré, uniquement utilisé par le générateur. La CI n'utilise Go que pour `go generate`. Suppression sans risque. `mise.toml` est aussi à supprimer ou mettre à jour.

## Open Questions

### Resolved During Planning

- **ESPHome merge additif confirmé ?** → Oui, PR #3555, listes concaténées (see origin).
- **IDs cross-packages fonctionnent ?** → Oui, issue #3354 corrigée (see origin).
- **dashboard_import depuis sous-dossier ?** → Non fiable (issue #4887) → presets à la racine (see origin).
- **go.mod/go.sum supprimables ?** → Oui, seul le générateur les utilise.
- **Tag ou branche pour les URLs packages ?** → `@main` pour l'instant.
- **`frangipool_redox.yaml` (fichier non généré) ?** → Hors scope — conservé tel quel. Profil matériel distinct (Redox standalone sans pompe/temp/antigel) à traiter dans une itération future.

### Deferred to Implementation

- **Valeur sentinelle pour les adresses Dallas** : choisir entre `"0x0000000000000000"` ou une adresse commentée — l'implémenteur décidera au moment d'écrire les presets.
- **ESPHome packages imbriqués** : non supportés — ne pas essayer de faire référencer des packages entre eux.
- **`mise.toml` : supprimer ou mettre à jour ?** : si d'autres outils sont ajoutés plus tard à mise, mettre à jour. Pour l'instant, supprimer.

## High-Level Technical Design

> *Ce diagramme illustre l'approche visée — guidance directionnelle pour la révision, pas une spécification d'implémentation.*

```
Repo root
├── packages/
│   ├── base.yaml          ← Hardware commun (toujours inclus)
│   ├── i2c_ads1115.yaml   ← Bus I2C + ADS1115 (inclus si redox ou pH)
│   ├── electrolyser.yaml  ← Relais GPIO27, timing globals
│   ├── booster.yaml       ← Relais GPIO26, Mode select
│   ├── redox.yaml         ← Capteur Redox, calibration, tendance
│   ├── ph.yaml            ← Capteur pH, calibration
│   └── redox_electrolyser.yaml ← Auto-régulation (Mode select, !extend pool_redox)
│
├── salt_full.yaml         ← Preset: base+i2c+elec+redox+ph+redox_elec
├── salt_wo_ph.yaml        ← Preset: base+i2c+elec+redox+redox_elec
├── salt_wo_redox.yaml     ← Preset: base+i2c+elec+ph
├── salt_minimal.yaml      ← Preset: base+elec
├── salt_booster_full.yaml ← Preset: base+i2c+elec+boost+redox+ph+redox_elec
├── salt_booster_wo_ph.yaml
├── salt_booster_wo_redox.yaml
└── salt_booster_minimal.yaml

Chaque preset contient :
  substitutions:  ← valeurs par défaut (nom, adresses Dallas)
  esphome:        ← project.name, version
  dashboard_import: ← github://frangipool/esphome-config/<preset>.yaml@main
  packages:       ← liste des packages github://…/packages/<pkg>.yaml@main
```

**Flux de merge ESPHome** : le firmware est compilé en une seule passe après merge de tous les packages. Les listes sont concaténées, les IDs résolus globalement. Un package peut référencer un ID déclaré dans un autre.

## Implementation Units

- [ ] **Unit 1: packages/base.yaml — Package matériel de base**

**Goal:** Créer `packages/base.yaml` avec toute la configuration commune à toutes les variantes.

**Requirements:** R1, R2

**Dependencies:** Aucune

**Files:**
- Create: `packages/base.yaml`

**Approach:**
- Inclure : `wifi` (ap uniquement), `esp32` (nodemcu-32s, esp-idf), `logger`, `api`, `ota`, `improv_serial`, `esp32_improv`, `captive_portal`
- Inclure : `time` (homeassistant, Europe/Paris), `one_wire` (GPIO23)
- Inclure : `globals` pump_last_turn_on, store_pool_temp
- Inclure : `number` max_antifreeze_temp (step 0.2, range -2..2, initial 0.0) et pump_uptime_delay (step 5, range 5..30, initial 10)
- Inclure : `sensor` Dallas local_temp (GPIO23, avec sliding average), Dallas pipe_temp, Dallas pipe_temp_raw (internal), pool_temp template (lambda store_pool_temp), pump_uptime (internal template, minutes since pump_last_turn_on), uptime, rssi/wifi_signal
- Inclure : `sensor` min_antifreeze_temp (internal template : max_antifreeze_temp - 1)
- Inclure : `binary_sensor` antifreeze (hystérésis template, delayed_on 120s, delayed_off 300s, avec notifications HA on_press/on_release), status
- Inclure : `switch` pump GPIO25 (on_turn_on : globals.set pump_last_turn_on)
- Inclure : `button` restart
- Inclure : `status_led` GPIO2 inverted
- Inclure : `interval` 30s → antifreeze check (turn_on pump si antifreeze actif)
- Inclure : `interval` 1min → if pump on && pump_uptime >= pump_uptime_delay : store pool_temp
- **Ne pas inclure** : `substitutions` (dans presets), `esphome.project`, `dashboard_import` (dans presets)
- La section `substitutions:` dans base.yaml peut définir des valeurs par défaut (name: frangipool, friendly_name: FrangiPool) — elles seront écrasées par les presets

**Patterns to follow:**
- `template/frangipool.yaml.tmpl` — source exacte pour tous les valeurs (GPIOs, seuils, adresses, formules)

**Test scenarios:**
- Happy path: YAML parseable sans erreur (`yamllint packages/base.yaml`)
- Happy path: composé seul avec un preset minimal (salt_minimal), produit des sections valides pour pump, temperature, antifreeze
- Edge case: aucun ID dupliqué entre base.yaml et lui-même (pas de redéfinition interne)
- Integration: le preset salt_minimal (base + electrolyser uniquement) doit compiler sans références manquantes vers des IDs I2C ou Redox

**Verification:**
- Le fichier est valide YAML
- Comparé au contenu correspondant dans `frangipool_salt_wo_ph_wo_redox.yaml` (variant le plus proche de base seul), les sections communes sont identiques

---

- [ ] **Unit 2: Packages capteurs ADC — i2c_ads1115.yaml, redox.yaml, ph.yaml**

**Goal:** Créer les trois packages liés aux capteurs ADS1115.

**Requirements:** R1, R2, R3

**Dependencies:** Unit 1 (les packages référencent des IDs de base.yaml)

**Files:**
- Create: `packages/i2c_ads1115.yaml`
- Create: `packages/redox.yaml`
- Create: `packages/ph.yaml`

**Approach:**

*`packages/i2c_ads1115.yaml` :*
- Définit `i2c:` (sda 21, scl 22, scan true, id: bus_a)
- Définit `ads1115:` (address 0x48)
- Ce package est inclus par les presets qui ont redox OU ph (ou les deux)

*`packages/redox.yaml` :*
- `globals:` store_pool_redox, redox_offset, last_redox_trend_value, redox_trend_state
- `number:` redox_manual_offset (manual calibration)
- `sensor:` ads1115_a0 (internal, multiply 1000), realtime_redox template (formula avec redox_manual_offset et redox_offset), pool_redox template (store_pool_redox, pas d'on_value_range ici — dans redox_electrolyser), redox_offset_sensor template
- `text_sensor:` Tendance Redox (En montée / Stable / En descente selon redox_trend_state)
- `button:` Redox Calibration 225mV, Redox Calibration 475mV, Redox Calibration Reset
- `interval:` 1min → if pump on && uptime >= delay : store pool_redox
- `interval:` 5min → calculate redox trend (diff avec last_redox_trend_value, set redox_trend_state)
- **Ne pas inclure** : `on_value_range` sur pool_redox (dans redox_electrolyser.yaml via `!extend`)

*`packages/ph.yaml` :*
- `globals:` store_pool_ph, ph_offset
- `sensor:` ads1115_a1 (internal), realtime_ph template (formula : 3.56 * ads1115_a1 - 1.889 + ph_offset, avec sliding average), pool_ph template (store_pool_ph), ph_offset_sensor template
- `button:` pH Calibration 7.00
- `interval:` 1min → if pump on && uptime >= delay : store pool_ph

**Technical design:**
> Directional — les packages redox et ph référencent bus_a et l'ADS1115 par leur ID global après merge. Exemple directional pour redox.yaml :
> ```
> sensor:
>   - platform: ads1115
>     id: ads1115_a0
>     internal: true
>     multiplexer: 'A0_GND'
>     ...
> ```
> Ils ne redéfinissent pas `i2c:` ni `ads1115:` — ces blocs viennent de i2c_ads1115.yaml.

**Patterns to follow:**
- `template/frangipool.yaml.tmpl` lignes correspondantes aux blocs `{{ if .Redox }}` et `{{ if .PH }}`

**Test scenarios:**
- Happy path: chaque package est YAML valide individuellement
- Integration: salt_full.yaml (inclut les trois) — aucun ID dupliqué entre i2c_ads1115, redox et ph
- Integration: salt_wo_ph.yaml (i2c + redox sans ph) — pool_redox présent, pool_ph absent, ads1115_a1 absent
- Edge case: salt_wo_redox.yaml (i2c + ph sans redox) — pool_ph présent, ads1115_a0 et realtime_redox absents
- Verification: `redox.yaml` ne contient aucune définition `i2c:` ni `ads1115:` (vérification textuelle)

**Verification:**
- Comparaison des sections sensor/button/text_sensor générées avec `frangipool_salt.yaml` (variant full) — valeurs et formules identiques
- `ph.yaml` seul (combiné avec base + i2c_ads1115) produit les sensors pH attendus

---

- [ ] **Unit 3: Packages contrôle — electrolyser.yaml, booster.yaml, redox_electrolyser.yaml**

**Goal:** Créer les packages pour les relais et la logique d'auto-régulation électrolyseur.

**Requirements:** R1, R2

**Dependencies:** Unit 1 (references pump, esptime IDs), Unit 2 (redox_electrolyser réf. redox IDs)

**Files:**
- Create: `packages/electrolyser.yaml`
- Create: `packages/booster.yaml`
- Create: `packages/redox_electrolyser.yaml`

**Approach:**

*`packages/electrolyser.yaml` :*
- `globals:` electrolyser_last_turn_on, effective_electrolysis_minutes
- `switch:` electrolyser GPIO27 (inverted false, restore RESTORE_DEFAULT_ON, on_turn_on : set electrolyser_last_turn_on, on_turn_off : reset effective_electrolysis_minutes)
- `interval:` 1min → if pump on && electrolyser on : increment effective_electrolysis_minutes
- **Note :** pas de Mode select (Off/Auto/Forcé) ici — ce mode n'a de sens qu'avec Redox, il est dans redox_electrolyser.yaml

*`packages/booster.yaml` :*
- `select:` Mode Surpresseur (Off/Auto/Forcé, optimistic)
- `switch:` booster GPIO26 (inverted true, restore RESTORE_DEFAULT_OFF)

*`packages/redox_electrolyser.yaml` :*
- `globals:` redox_stable_minutes
- `select:` Mode Electrolyseur (Off/Auto/Forcé, optimistic, on_value : lambda contrôlant electrolyser selon mode et pool_redox)
- `number:` Consigne Redox Max (min 670, max 750, step 10, initial 740), Consigne Redox Min (min 650, max 730, step 10, initial 710)
- `sensor:` `id: !extend pool_redox` → ajoute `on_value_range` (above max → turn_off si Auto, below min → turn_on si Auto && trend != montée)
- `interval:` 1min → auto-regulation lambda (vérif mode Auto, pump active, uptime >= delay, compare redox vs min/max, gérer redox_stable_minutes)

**Technical design:**
> Directional — le `!extend` pour pool_redox :
> ```
> sensor:
>   - id: !extend pool_redox
>     on_value_range:
>       - above: ...
>         then: ...
> ```
> Ceci requiert que pool_redox soit déclaré avec `id: pool_redox` dans redox.yaml, ce qui est le cas.

**Patterns to follow:**
- `template/frangipool.yaml.tmpl` blocs `{{ if .Electrolyser }}`, `{{ if .Booster }}`, `{{ if and .Redox .Electrolyser }}`
- Le système-reminder documente les modifications récentes du template (on_turn_on/off, on_value_range avec redox_trend_state)

**Test scenarios:**
- Happy path: chaque package YAML valide individuellement
- Integration: salt_full.yaml inclut les trois + redox → Mode Electrolyseur présent, on_value_range sur pool_redox présent
- Integration: salt_wo_ph.yaml (elec + redox + redox_electrolyser, sans ph) → électrolyseur switch présent, Mode Electrolyseur présent, on_value_range sur pool_redox présent
- Integration: salt_minimal.yaml (elec sans redox) → switch electrolyser présent, pas de Mode select, pas de globals Redox
- Edge case: salt_booster_minimal.yaml — booster ET electrolyser présents, Mode Surpresseur présent, Mode Electrolyseur absent (pas de redox_electrolyser)
- Verification: la logique auto-régulation dans l'interval de redox_electrolyser.yaml est identique au template corrigé (system-reminder : on_value_range avec redox_trend_state != 1)

**Verification:**
- Comparaison avec `frangipool_salt.yaml` pour les sections électrolyseur avec auto-régulation
- `redox_electrolyser.yaml` seul ne contient aucune déclaration `switch: electrolyser` ni `sensor: pool_redox` complète (juste le `!extend`)

---

- [ ] **Unit 4: 8 fichiers presets à la racine**

**Goal:** Créer les 8 fichiers presets qui composent les packages et permettent l'import Dashboard.

**Requirements:** R4, R5, R6, R7

**Dependencies:** Units 1-3 (les packages doivent exister pour que les URLs soient valides)

**Files:**
- Create: `salt_full.yaml`
- Create: `salt_wo_ph.yaml`
- Create: `salt_wo_redox.yaml`
- Create: `salt_minimal.yaml`
- Create: `salt_booster_full.yaml`
- Create: `salt_booster_wo_ph.yaml`
- Create: `salt_booster_wo_redox.yaml`
- Create: `salt_booster_minimal.yaml`

**Approach:**
Chaque preset suit ce schéma :
```
substitutions:
  name: frangipool
  friendly_name: FrangiPool
  local_temp_address: "0x0000000000000000"  # Remplacer par l'adresse de votre sonde locale
  temp_address: "0x0000000000000000"  # Remplacer par l'adresse de votre sonde canalisation

esphome:
  name: ${name}
  name_add_mac_suffix: false
  friendly_name: ${friendly_name}
  project:
    name: frangipool.<preset_name>
    version: "2.0.0"

dashboard_import:
  package_import_url: github://frangipool/esphome-config/<preset_name>.yaml@main

packages:
  base: github://frangipool/esphome-config/packages/base.yaml@main
  # + packages selon la matrice de composition
```

La valeur sentinelle `"0x0000000000000000"` est choisie pour être clairement un placeholder invalide visible par l'utilisateur. Un commentaire explicite est ajouté sur chaque ligne.

**Patterns to follow:**
- Les URLs `github://user/repo/path@ref` sont le format standard ESPHome pour les remote packages
- Voir la matrice de composition dans Key Technical Decisions pour la liste de packages par preset

**Test scenarios:**
- Happy path: chaque preset est YAML valide
- Happy path: le champ `dashboard_import.package_import_url` contient le bon nom de fichier pour chaque preset (pas de copier-coller depuis un autre preset)
- Happy path: `esphome.project.name` est unique par preset (frangipool.salt_full, frangipool.salt_wo_ph, etc.)
- Edge case: salt_minimal.yaml ne liste pas i2c_ads1115 dans ses packages
- Edge case: salt_full.yaml liste tous les 7 packages dans le bon ordre (base, i2c_ads1115, electrolyser, redox, ph, redox_electrolyser)
- Integration: l'URL `@main` est cohérente dans tous les presets (pas de `@master` ou tag hardcodé)

**Verification:**
- 8 fichiers YAML valides à la racine
- Chaque preset charge uniquement les packages correspondant à sa variante matérielle

---

- [ ] **Unit 5: Suppression des artifacts générateur et mise à jour CI**

**Goal:** Supprimer tous les artifacts du générateur Go et désactiver la CI de génération.

**Requirements:** R8, R9, R10, R11

**Dependencies:** Units 1-4 (les presets doivent exister avant de supprimer les anciens fichiers)

**Files:**
- Delete: `template/frangipool.yaml.tmpl`
- Delete: `template/config.yaml`
- Delete: `template/README.md.tmpl`
- Delete: `template/main.go`
- Delete: `main.go`
- Delete: `go.mod`
- Delete: `go.sum`
- Delete: `mise.toml`
- Delete: `frangipool_salt.yaml`
- Delete: `frangipool_salt_wo_ph.yaml`
- Delete: `frangipool_salt_wo_redox.yaml`
- Delete: `frangipool_salt_wo_ph_wo_redox.yaml`
- Delete: `frangipool_salt_booster.yaml`
- Delete: `frangipool_salt_booster_wo_ph.yaml`
- Delete: `frangipool_salt_booster_wo_redox.yaml`
- Delete: `frangipool_salt_booster_wo_ph_wo_redox.yaml`
- Delete: `.github/workflows/go-generated.yaml`
- **Conserver :** `frangipool_redox.yaml` (hors scope — profil matériel distinct)

**Approach:**
- Supprimer tous les fichiers listés
- Le dossier `template/` sera vide après suppression de ses 4 fichiers, le supprimer aussi
- La suppression de `mise.toml` retire la configuration d'outil Go du projet
- Aucun fichier de remplacement CI n'est créé dans cette itération (hors scope R10)

**Test scenarios:**
- Test expectation: none — suppression pure, pas de comportement à valider
- Vérification : `git status` montre uniquement des suppressions, aucun fichier non suivi
- Vérification : aucun fichier `frangipool_*.yaml` ne reste à la racine
- Vérification : `git ls-files template/` retourne vide

**Verification:**
- La racine du repo ne contient plus de fichiers Go (main.go, go.mod, go.sum)
- Le dossier `template/` est absent
- `.github/workflows/` ne contient plus `go-generated.yaml`

---

- [ ] **Unit 6: Documentation — README.md et CLAUDE.md**

**Goal:** Réécrire README.md et mettre à jour CLAUDE.md pour la nouvelle architecture.

**Requirements:** R12, R13

**Dependencies:** Units 1-5 (la structure finale doit être en place)

**Files:**
- Modify: `README.md` (réécriture complète)
- Modify: `CLAUDE.md`

**Approach:**

*`README.md` :*
- Introduction courte sur FrangiPool (automation piscine sel, ESP32)
- **Section "Import rapide"** : instructions pas à pas pour ESPHome Dashboard → New Device → Use a project → coller l'URL du preset
- **Tableau des presets** : colonnes Preset | Électrolyseur | Redox | pH | Surpresseur | Auto-régulation, avec URL dashboard_import pour chaque ligne
- **Section "Packages disponibles"** : liste des 7 packages avec description brève
- **Section "Configuration avancée"** : comment créer son propre fichier YAML avec des packages à la carte
- **Section "Substitutions"** : expliquer les 4 substitutions (name, friendly_name, local_temp_address, temp_address) et comment les trouver (ESPHome logger au démarrage pour les adresses Dallas)
- Supprimer toutes les références au générateur Go et aux variantes `frangipool_*`

*`CLAUDE.md` :*
- Mettre à jour la section "Code Generation" : remplacer `go generate ./...` par "pas de génération — les fichiers YAML sont la source de vérité directe"
- Mettre à jour la section "Architecture" : refléter `packages/`, presets à la racine
- Mettre à jour "Adding a New Feature" : éditer directement les packages concernés, pas de template à modifier
- Supprimer les références à `template/`, `main.go`, `go.mod`

**Test scenarios:**
- Happy path: README.md contient les 8 URLs `dashboard_import` correctes (correspondant aux 8 presets créés en Unit 4)
- Happy path: chaque URL dans README pointe vers un fichier qui existe réellement dans le repo
- Happy path: CLAUDE.md ne contient plus de référence à `go generate`, `template/`, ni `frangipool_*.yaml`
- Edge case: les adresses Dallas dans le README mentionnent la méthode pour les trouver (ESPHome logger)

**Verification:**
- `grep -r "go generate" CLAUDE.md` retourne vide
- `grep -r "frangipool_" README.md` retourne vide (sauf éventuellement dans une section de migration)
- Les 8 URLs de preset dans README correspondent aux 8 fichiers créés en Unit 4

## System-Wide Impact

- **Fichiers supprimés (breaking) :** les URLs `dashboard_import` des anciens `frangipool_*.yaml` ne fonctionneront plus. Tout appareil déployé avec ces URLs cessera de recevoir les mises à jour. Accepté : projet early-stage, base d'utilisateurs limitée (see origin).
- **Nouveaux points d'entrée :** 8 fichiers YAML à la racine remplacent les 8 anciens. Les URLs changent de `github://frangipool/esphome-config/frangipool_salt.yaml@main` vers `github://frangipool/esphome-config/salt_full.yaml@main`.
- **Aucun changement comportemental firmware :** la logique Redox, pH, antigel, et les GPIOs restent identiques. Les formules, seuils et timings sont copiés à l'identique depuis le template.
- **Invariants maintenus :** GPIOs (pump GPIO25, electrolyser GPIO27, booster GPIO26, LED GPIO2, one-wire GPIO23, I2C SDA/SCL 21/22), intervalles (30s antifreeze, 1min store, 5min redox trend), formules de calibration (Redox et pH), comportement antigel avec hystérésis.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `!extend pool_redox` ne fonctionne pas comme attendu | Tester la composition salt_full avec `esphome config` avant de conclure |
| Duplication de la condition pompe dans chaque interval → désynchronisation future | Documenter ce pattern dans CLAUDE.md comme convention délibérée |
| Les presets `@main` reçoivent des updates breaking dès le push | Acceptable pour l'instant ; noter dans README que l'URL pointe toujours vers la dernière version |
| `frangipool_redox.yaml` est un appareil réel (formule différente, filtre median, pas de pompe/temp/antigel) | Décision explicite requise : créer un preset dédié ou documenter la perte de configuration dans le commit de suppression |
| Adresses Dallas `0x0000000000000000` → user flashe sans les changer | Le commentaire dans le preset doit être très explicite ; ESPHome logger affichera les vraies adresses au premier démarrage |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-05-esphome-package-architecture-requirements.md](docs/brainstorms/2026-04-05-esphome-package-architecture-requirements.md)
- Source template: `template/frangipool.yaml.tmpl`
- Config variantes: `template/config.yaml`
- ESPHome packages docs: https://esphome.io/components/packages/
- ESPHome issue #4887 (dashboard_import subdirectory bug): https://github.com/esphome/issues/issues/4887
- ESPHome PR #3555 (additive merge): https://github.com/esphome/esphome/pull/3555
