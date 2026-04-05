---
date: 2026-04-05
topic: template-catchup
---

# Rattrapage du template ESPHome

## Problem Frame

Le fichier personnel `/Users/gaetan/workspace/local/esphome/frangipool.yaml` a évolué de façon autonome depuis que le projet partagé a été mis en veille. Le template `template/frangipool.yaml.tmpl` est désormais désynchronisé sur deux plans : la syntaxe ESPHome (API cassante) et la logique métier (fonctionnalités nouvelles ou améliorées).

L'objectif est de rapatrier l'ensemble de ces évolutions dans le template partagé pour que les configs générées redeviennent distribuables et à jour.

---

## Requirements

**Mises à jour API ESPHome (syntaxe cassante — s'applique à tous les variants)**

- R1. Remplacer le bloc `dallas:` par `one_wire: - platform: gpio` et migrer `platform: dallas` → `platform: dallas_temp` pour les deux sondes de température.
- R2. Remplacer `ota:` par `ota: - platform: esphome`.
- R3. Remplacer `homeassistant.service` par `homeassistant.action` (et `data_template` par la syntaxe équivalente actuelle).
- R4. Ajouter `esp32.framework.type: esp-idf` dans la section `esp32:`.

**Corrections logiques core (tous les variants)**

- R5. Modifier uniquement la lambda du sensor `pump_uptime` pour retourner des minutes (÷ 60). La comparaison dans l'intervalle (`pump_uptime.state >= pump_uptime_delay.state`) n'est pas à modifier — `pump_uptime_delay` est déjà en minutes. Les entités `pump_uptime` et `pump_uptime_delay` sont conservées (elles servent au délai d'échantillonnage des mesures après démarrage de la pompe).
- R6. Remplacer la logique antigel par la version améliorée du fichier local :
  - Binary sensor `antifreeze` avec lambda et hystérésis statique (seuils on/off distincts), `update_interval: 10s`,
  - Filtres `delayed_on: 120s` et `delayed_off: 300s`,
  - Ajout d'un capteur interne `pipe_temp_raw` (non filtré) utilisé exclusivement pour la logique antigel (voir question déférée sur la double déclaration Dallas),
  - Actions `on_press` / `on_release` avec notification Home Assistant incluant la température via le champ `variables:` (syntaxe ESPHome 2024.x+, pas `data_template`).
- R7. Ajouter un intervalle de 30s qui maintient la pompe allumée tant que l'antigel est actif.

**Contrôle électrolyseur intelligent (variants avec `Electrolyser: true`)**

- R8. Ajouter le global `effective_electrolysis_minutes` (int, restore_value: true) pour comptabiliser le cumul de minutes pompe+électrolyseur allumés simultanément. Remis à 0 à l'extinction de l'électrolyseur. Ce global est dans le bloc `{{ if .Electrolyser }}`. L'incrément se fait dans l'intervalle 1min dans une branche conditionnelle indépendante : `if (pump.state && electrolyser.state) { effective_electrolysis_minutes += 1; }` — sans dépendance au délai `pump_uptime_delay`.
- R9. Remplacer l'ancien contrôle par `on_value_range` direct par un select `Mode Electrolyseur` (Off / Auto / Forcé) avec `id: electrolyser_mode`.
- R10. Implémenter la logique Auto dans l'intervalle 1min :
  - Extinction immédiate si `pool_redox > max_redox` et électrolyseur allumé,
  - Allumage conditionné à `redox_stable_minutes >= 30` si `pool_redox < min_redox` et électrolyseur éteint.
- R11. Ajouter les globals associés : `electrolyser_last_turn_on` (int), `redox_stable_minutes` (int).
- R12. Ajouter les callbacks `on_turn_on` (stocke timestamp) et `on_turn_off` (reset `effective_electrolysis_minutes`) sur le switch Electrolyseur.
- R13. Conserver les `on_value_range` sur `pool_redox` mais conditionner leurs actions au mode Auto (via lambda).

**Tendance Redox (variants avec `Redox: true` — inclus automatiquement)**

- R14. Ajouter les globals `last_redox_trend_value` (float, restore: true) et `redox_trend_state` (int, restore: no, initial: 0).
- R15. Ajouter un intervalle de 5min qui calcule la tendance (diff vs valeur précédente, seuil ±2 mV) et met à jour `redox_trend_state`.
- R16. Ajouter un `text_sensor` template "Tendance Redox" (entity_category: diagnostic) qui publie "En montée", "En descente" ou "Stable".
- R17. Conditionner l'incrémentation de `redox_stable_minutes` dans l'intervalle 1min à `redox_trend_state <= 0` (remise à 0 sinon).

**Fonctionnalités conservées sans évolution (pH, Booster)**

- R18. Maintenir les blocs pH et Booster existants dans le template ; leur appliquer les mises à jour API (R1–R4) et corriger le bug d'indentation YAML pré-existant sur `realtime_ph` (la clé `filters:` a une indentation incorrecte de 5 espaces au lieu de 4, la rendant invalide en YAML strict).

---

## Success Criteria

- `go generate ./...` produit des configs valides et compilables par ESPHome pour tous les variants existants.
- La config générée `frangipool_salt.yaml` (Electrolyser+Redox) est fonctionnellement équivalente au fichier local `frangipool.yaml` (hors credentials wifi/api et adresses Dallas personnelles).
- Aucune régression sur les variants sans électrolyseur ni Redox.

---

## Scope Boundaries

- Les credentials (wifi, api encryption key) et les adresses Dallas hardcodées restent dans le fichier local et ne sont pas portés dans le template partagé.
- La logique de filtration automatique (`Mode Filtration` : Auto/On 24h/Off/Hiver) présente dans l'ancien template mais absente du fichier local est **supprimée** du template : elle n'est plus maintenue.
- Pas de nouveaux variants dans `template/config.yaml` dans ce cycle.
- Pas de refactoring du générateur Go (`template/main.go`).

---

## Key Decisions

- **Remplacement complet du contrôle électrolyseur** : la nouvelle logique mode Off/Auto/Forcé remplace l'ancien `on_value_range` dans tous les variants `Electrolyser+Redox`. Pas de flag supplémentaire.
- **Tendance Redox bundlée avec Redox** : tout variant avec `Redox: true` inclut automatiquement la tendance. Pas de flag `redox_trend`.
- **pH et Booster conservés** : ces variants restent dans le template pour les autres utilisateurs même si non développés dans le fichier local.

---

## Dependencies / Assumptions

- L'ESP-IDF framework (`esp32.framework.type: esp-idf`) est compatible avec le board `nodemcu-32s` et les composants utilisés (ADS1115, Dallas, etc.).
- La migration `dallas` → `one_wire` + `dallas_temp` est une API ESPHome stable dans la version cible.

---

## Outstanding Questions

### Resolve Before Planning

- **[Affecte R6]** Confirmer que deux sensors `dallas_temp` peuvent déclarer la même adresse physique dans ESPHome (pour `pipe_temp` filtré et `pipe_temp_raw` non filtré). Si ce n'est pas supporté, l'alternative est d'alimenter le binary sensor `antifreeze` directement depuis `pipe_temp` en acceptant un léger délai de filtrage, ou de lire `.raw_state` du capteur filtré.

### Deferred to Planning

- **[Affecte R18]** La logique pH (formule `3.56 * ads1115_a1.state - 1.889 + ph_offset`) et la calibration pH 7.00 n'ont pas évolué localement — vérifier si l'API `ads1115` pour le canal A1 nécessite les mêmes mises à jour de syntaxe que le canal A0.
- **[Affecte R10/R17]** Post-boot : `redox_stable_minutes` (non restauré) démarre à 0, `redox_trend_state` aussi. L'électrolyseur peut s'allumer après 30 min même si le Redox monte réellement. Comportement accepté ou à mitiger (ex: initialiser `redox_stable_minutes` à -30 pour forcer une période d'observation au démarrage).

---

## Next Steps

→ `/ce:plan` pour la planification de l'implémentation
