---
title: "feat: Calibration pH two-points (Gravity v2.0)"
type: feat
status: completed
date: 2026-04-25
deepened: 2026-04-26
origin: docs/brainstorms/2026-04-25-001-ph-two-point-calibration-requirements.md
---

# feat: Calibration pH two-points (Gravity v2.0)

## Overview

Réécrire [packages/ph.yaml](../../packages/ph.yaml) pour passer d'une calibration single-point pH 7 (offset additif) à une **calibration two-points pH 7 + pH 4** qui recalcule la pente *et* l'intercept de la droite de Nernst-board. Cible matériel : Gravity pH Meter v2.0 (DFRobot SEN0161-V2) sur ADS1115 A1. La séquence est orchestrée par un script ESPHome `mode: single` déclenché par un bouton HA unique. Les anciennes valeurs `(3.56, -1.889)` deviennent les valeurs d'usine appliquées par défaut, donc le firmware reste fonctionnel sans calibration explicite.

---

## Problem Frame

Voir l'origine ([docs/brainstorms/2026-04-25-001-ph-two-point-calibration-requirements.md](../brainstorms/2026-04-25-001-ph-two-point-calibration-requirements.md)) : le module pH actuel n'ajuste qu'un offset additif au pH 7. La pente de la sonde est figée à la valeur d'usine du Gravity v2.0 (3.56 pH/V), donc le vieillissement de la sonde produit un pH silencieusement faux que l'opérateur ne peut corriger qu'en bidouillant l'offset — masquant le vrai problème de pente. Une calibration two-points est la procédure standard du fabricant et un prérequis pour fiabiliser toute régulation pH+ future.

---

## Requirements Trace

- R1. `pH = g_ph_slope × V + g_ph_intercept` appliqué dans le lambda de `realtime_ph` *(see origin: requirements R1)*
- R2. À chaque calibration acceptée : `g_ph_slope = 3.0 / (V_pH7 − V_pH4)` et `g_ph_intercept = 7.0 − g_ph_slope × V_pH7` *(see origin: R2)*
- R3. Valeurs d'usine `g_ph_slope = 3.56`, `g_ph_intercept = -1.889` (parité avec l'existant en l'absence de calibration) *(see origin: R3)*
- R4. Rejet si `V_pH7 ≤ V_pH4` *(see origin: R4)*
- R5. Rejet si `slope ∉ [2.5, 5.0]` pH/V *(see origin: R5)*
- R6. Sur rejet : globals inchangés + notif HA explicite + V_pH7/V_pH4 conservés en diagnostic *(see origin: R6)*
- R7. Bouton HA "Démarrer calibration pH" déclenchant la séquence atomique pH 7 → pH 4 *(see origin: R7)*
- R8. Notification `homeassistant.action: persistent_notification.create` à chaque étape, wrappée dans `api.connected:` *(see origin: R8)*
- R9. Bouton HA "Reset calibration pH usine" → ramène slope/intercept aux valeurs d'usine *(see origin: R9)*
- R10. `g_ph_slope`, `g_ph_intercept`, `g_v_ph7`, `g_v_ph4` persistés (`restore_value: true`) *(see origin: R10)*
- R11. 4 sondes diagnostic exposées : `pH Slope`, `pH Intercept`, `V_pH7`, `V_pH4` *(see origin: R11)*

**Derived requirements (issus de la doc-review du 2026-04-26)** — ces R-IDs n'existent pas dans l'origine et ont été identifiés pendant le confidence check / adversarial review.

- R12. **NaN guard sur capture** : tout lambda lisant `id(ads1115_a1).state` pendant la calibration applique `std::isnan(v)` avant tout usage. Sur NaN détecté, abort sans écrire de global. *Source : [docs/solutions/architecture/antifreeze-nan-silent-failure.md](../solutions/architecture/antifreeze-nan-silent-failure.md), traçabilité C5.*
- R13. **Verrou anti-race reset-vs-calibration** : un global `g_ph_calibration_in_progress` (non-restored) est `true` pendant l'exécution du script de calibration. Le bouton `Reset calibration pH usine` vérifie ce flag et notifie "Calibration en cours, reset ignoré" sans modifier slope/intercept si la calib tourne. *Source : adversarial F1.*
- R14. **Capture multi-échantillon avec spread check** : à la fin de chaque fenêtre de stabilisation 180 s, on capture 3 échantillons espacés de 5 s (T+180, T+185, T+190). Si `max − min > 50 mV`, abort + notif "Capture instable". Sinon, V_pHx = moyenne des 3 échantillons. Couvre les staleness I²C qu'un guard NaN seul ne détecte pas. *Source : adversarial F3.*
- R15. **Gating de l'échantillonnage `pool_ph` pendant la calibration** : le bloc `interval: 1min` qui latche `g_store_pool_ph` doit être conditionné sur `!id(g_ph_calibration_in_progress)`. Évite que des lectures de bains tampons fuient dans `pool_ph` quand la pompe tournait déjà depuis ≥ `pump_uptime_delay`. *Source : adversarial F4.*
- R16. **Canal de recovery résilient à la déconnexion HA** : un `text_sensor "pH Calibration Last Result"` exposé en diagnostic, alimenté par un global `g_ph_last_result_code` (int, `restore_value: true`, codes 0-8). Le script et le bouton reset écrivent ce code à chaque issue ; le lambda du `text_sensor` mappe le code vers une chaîne française (succès = format dynamique avec slope/intercept, rejet = raison spécifique, etc.) — survit aux déconnexions WiFi/HA, lisible après reconnexion. *Source : adversarial F2.* **Note implémentation (2026-04-26)** : la version brainstorm/plan initiale spécifiait un global `g_ph_last_result` de type `std::string` ; l'implémentation a opté pour un global `g_ph_last_result_code` de type `int` + lookup lambda dans le `text_sensor`, parce que `restore_value: true` n'est pas fiable sur les `std::string` globals en ESPHome (le mécanisme de préférences travaille mal avec les types de taille variable). Comportement utilisateur identique. Codes : 0=jamais calibré, 1=OK, 2=rejet bains inversés, 3=rejet pente hors plage, 4=NaN pH 7, 5=NaN pH 4, 6=spread pH 7, 7=spread pH 4, 8=reset usine.

**Origin flows:** F1 (Calibration two-point pH 7 → pH 4)
**Origin acceptance examples:** AE1 (couvre R1, R2 — calcul nominal), AE2 (couvre R4 — bains inversés), AE3 (couvre R5 — sonde HS)

---

## Scope Boundaries

- Aucune compensation en température (assume 25 °C) — limitation documentée dans le README *(see origin: Scope Boundaries)*
- Aucun offset manuel additif (anti-pattern qui masquerait la dérive)
- Aucune calibration trois points (pH 4+7+10) — la zone piscine est encadrée par les deux points
- Aucun support multi-cartes : cible exclusive Gravity pH Meter v2.0 non-inversé
- Aucune migration in-place de l'ancien `g_ph_offset` : à l'OTA, l'ancienne calibration est invalidée et le firmware redémarre sur les valeurs d'usine. L'opérateur doit refaire une calibration two-points

---

## Context & Research

### Relevant Code and Patterns

- [packages/ph.yaml](../../packages/ph.yaml) — fichier cible, dont le bloc d'échantillonnage `pool_ph` (lignes 58-69, gating sur `pump_uptime ≥ pump_uptime_delay`) doit être préservé
- [packages/redox.yaml:91-110](../../packages/redox.yaml) — pattern canonique du bouton de calibration : `delay: 180s` + `globals.set` lambda + `component.update` + `homeassistant.action`
- [packages/redox.yaml:133-142](../../packages/redox.yaml) — pattern de bouton reset (sans délai)
- [packages/filtration.yaml:309-321](../../packages/filtration.yaml) — `_ntp_alert_once` : pattern `script: mode: single` + `if condition: api.connected: then: homeassistant.action`. Référence forte parce que c'est le seul script du repo qui combine notification HA + verrouillage de séquence
- [packages/filtration.yaml:326-338](../../packages/filtration.yaml) — `_invalid_window_alert_once` : second exemple du même pattern
- [packages/redox.yaml:1-15](../../packages/redox.yaml) — pattern globals avec `restore_value` sélectif

### Institutional Learnings

- [docs/solutions/architecture/esphome-script-mode-queued-vs-restart.md](../solutions/architecture/esphome-script-mode-queued-vs-restart.md). **Résumé** : ce learning compare `restart` et `queued` sur des scripts à lambda pure et conclut que `queued max_runs:1` drop silencieusement les triggers en burst (warnings ESPHome "script already running, discarding trigger"), tandis que `restart` est sûr quand la lambda est *pure* (sans état partiel persisté). Il n'aborde pas explicitement `mode: single`. **Application au plan** : par déduction logique, notre script de calibration n'est *pas* à lambda pure (capture pH7 puis pH4 avec écritures partielles à `g_v_ph7`), donc ni `restart` ni `queued` ne conviennent. `mode: single` est la solution résiduelle qui ignore les re-presses en cours de séquence — comportement souhaité.
- [docs/solutions/architecture/antifreeze-nan-silent-failure.md](../solutions/architecture/antifreeze-nan-silent-failure.md). **Résumé** : un lambda template_binary_sensor lisant un Dallas avec `if (val < threshold) return true; else return false;` retourne `false` silencieusement quand `val` est NaN (NaN compare `false` à tout) — l'antigel se verrouille OFF en cas de probe HS. Le fix canonique du repo est `if (std::isnan(val)) return last_state;` (préserver l'état connu) avant tout calcul. **Application au plan** : tout lambda du chemin de calibration qui lit `id(ads1115_a1).state` ajoute `std::isnan(v)` *avant* tout usage. Si NaN détecté, on abort la calibration sans écrire aucun global et on notifie. Sinon NaN se propagerait dans `g_ph_slope`/`g_ph_intercept` et corromperait durablement la calibration restaurée.
- [docs/solutions/architecture/redox-asymmetric-regulation-policy.md](../solutions/architecture/redox-asymmetric-regulation-policy.md). **Résumé** : la régulation Redox a 5 writers de `electrolyser.turn_on/off` (sensor on_value_range, interval, select.on_value, button.on_press, api.actions). Le doc impose une checklist de revue qui énumère tous les writers à chaque modification, parce que des écritures concurrentes silencieuses sont la principale source de régression sur ce module. **Application au plan** : nos globals `g_ph_slope` / `g_ph_intercept` ont 2 writers (script `_ph_calibration` étape de validation, bouton `reset_calibration_ph_usine`). On documente cette liste en tête du fichier YAML, et toute future addition de writer (action API, etc.) doit mettre la liste à jour.

### CI / Validation

- ESPHome pinné à `esphome==2026.3.3` ([.github/workflows/validate.yml:41](../../.github/workflows/validate.yml))
- 6 des 8 presets incluent `packages/ph.yaml` : `salt_full.yaml`, `salt_minimal.yaml`, `salt_wo_redox.yaml`, `salt_booster_full.yaml`, `salt_booster_minimal.yaml`, `salt_booster_wo_redox.yaml`. Les `*_wo_ph.yaml` ne le chargent pas mais sont quand même validés en CI
- CI `sed`-rewrite des URLs `github://` vers des `!include` locaux avant `esphome config` — local repro via le snippet `sed -i ''` du CLAUDE.md

---

## Key Technical Decisions

- **Slope + intercept stockés directement** (pas slope + offset additif) : on remplace complètement `(3.56, -1.889)` à chaque calibration acceptée. Single source of truth, pas de mode "calibration partielle ambiguë". *(see origin: Key Decisions)*
- **`mode: single`** pour le script de calibration. Le learning [esphome-script-mode-queued-vs-restart.md](../solutions/architecture/esphome-script-mode-queued-vs-restart.md) ne tranche que `restart` vs `queued` pour des lambdas pures ; il ne mentionne pas explicitement `single`. La déduction logique pour notre cas : la séquence a un état partiel persisté (`g_v_ph7` écrit avant la 2ᵉ capture), donc `restart` annulerait avec un état partiellement consistant ; `queued max_runs:1` drop silencieusement les triggers (warnings ESPHome). Reste `single` : ignore le re-press, la séquence en cours se termine proprement. C'est le bon comportement utilisateur — un opérateur qui reclique pendant la calib ne veut pas la perdre.
- **R12 — `std::isnan` guard sur chaque capture** : garde-fou matériel pour les coupures momentanées. Couvre uniquement les NaN explicites publiés par ESPHome ; ne couvre PAS les lectures stales d'un bus I²C figé (un float valide mais pas frais). Cette dernière classe est mitigée par R14 (multi-capture spread check).
- **R13 — Verrou anti-race `g_ph_calibration_in_progress`** : `mode: single` empêche le script de re-rentrer dans lui-même mais ne protège pas contre des écritures concurrentes du bouton reset (qui touche les mêmes globals). Le flag bloque le reset pendant la séquence et ferme cette race. Il est aussi réutilisé pour gater l'`interval: 1min` (R15) — un seul mécanisme, deux usages.
- **R14 — Capture 3 échantillons avec spread check** (au lieu d'un snapshot unique) : le délai 180 s puis 3 prises espacées de 5 s permettent (a) de détecter la staleness I²C invisible au NaN guard, (b) de réduire le bruit haute fréquence par moyennage. Le seuil 50 mV correspond à ~0.18 pH avec une pente saine — au-delà, la sonde n'est pas stabilisée. Cette décision **résout aussi la deferred Q "moyennage"** de l'origine.
- **R15 — Gating de `pool_ph` pendant la calibration** : la claim antérieure que `pump_uptime_delay` protégeait suffisamment était fausse — si la pompe tournait déjà depuis > `pump_uptime_delay` quand l'opérateur démarre la calib, le gate n'arrête rien et `pool_ph` se polluerait avec des bains tampons. Le flag R13 résout ça atomiquement, sans coût supplémentaire.
- **R16 — `text_sensor` Calibration Last Result avec `restore_value`** : les notifs HA via `api.connected` peuvent être silencieusement perdues sur déconnexion WiFi/HA pendant la calib (snapshot à l'envoi, pas garantie de delivery). Un text_sensor persistant est le canal résilient ; les 4 sondes diagnostic numériques restent le double-check chiffré.
- **Garde-fous appliqués *avant* l'écriture des globals** (R4, R5) : la lambda calcule slope/intercept candidats dans des variables locales, vérifie les bornes, *puis* écrit les globals. Sur rejet, les anciennes valeurs sont préservées (pattern fail-soft "preserve last known state").
- **V_pH7/V_pH4 conservés après reset usine** (R9) : le reset ne purge que slope/intercept (et écrit `g_ph_last_result_code = "Reset usine"`). Les V capturés restent visibles en diagnostic comme historique d'audit — utile pour comprendre *a posteriori* pourquoi une calibration avait été appliquée. Le bouton reset notifie clairement.

---

## Open Questions

### Resolved During Planning

- **Quel mode de script ?** → `mode: single` (justifié par déduction sur la nature séquentielle à état partiel ; cf. Key Technical Decisions pour le raisonnement complet — le learning cité ne tranche pas directement `single` vs `restart`).
- **Snapshot vs moyennage à la capture ?** → **Réévalué pendant la doc-review du 2026-04-26** : remplacé par le multi-capture R14 (3 échantillons espacés de 5 s avec spread check ≤ 50 mV). Couvre à la fois la robustesse au bruit (la motivation initiale) et la détection de staleness I²C (révélée par adversarial F3).
- **Reset usine purge-t-il les V_pH7/V_pH4 capturés ?** → Non. Conservés en diagnostic comme audit ; reset ne touche que slope/intercept (et écrit `g_ph_last_result_code = "Reset usine"`, R16).
- **Race reset-vs-calibration ?** → résolu via le flag `g_ph_calibration_in_progress` (R13) : pendant l'exécution du script, le bouton reset notifie "Calibration en cours, reset ignoré" et n'écrit pas. *Identifié par adversarial F1 le 2026-04-26.*
- **Comment protéger `pool_ph` quand la pompe tourne déjà depuis > `pump_uptime_delay` au démarrage de la calib ?** → gating de l'`interval: 1min` sur `!id(g_ph_calibration_in_progress)` (R15), atomique et gratuit puisque le flag existe déjà via R13. *Identifié par adversarial F4 le 2026-04-26.*
- **Comment recevoir l'issue de la calib si HA est déconnecté pendant la séquence ?** → `text_sensor` "pH Calibration Last Result" avec `restore_value` (R16) ; les 4 diagnostics numériques restent disponibles comme double-check. *Identifié par adversarial F2 le 2026-04-26.*

### Deferred to Implementation

- Wording exact des notifications HA (titre + corps) : à finaliser au moment de l'écriture, en s'alignant sur le ton existant du repo (français, concis, mention des valeurs calculées dans le succès).
- Vérification finale au flash : le câblage exact de la sonde Gravity v2.0 reçue (non-inversé) — confirmer en lisant `esphome logs` après flash que `V_pH7 ≈ 2.5 V` et `V_pH4 ≈ 1.65 V`. Si ce n'est pas le cas, la calibration sera rejetée par les garde-fous (R5) et le plan reste cohérent — l'utilisateur saura immédiatement.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

Squelette logique du script `_ph_calibration` (à écrire en YAML ESPHome) — intègre les durcissements R12 (NaN guard), R13 (flag anti-race), R14 (multi-capture spread), R16 (last_result).

> **Note de lecture du pseudo-code** : pour la lisibilité, les écritures à `g_ph_last_result_code` sont annotées avec la chaîne française correspondante (`"Echec: capteur indispo (pH 7)"`) — l'implémentation réelle écrit le **code int** (`4` pour cet exemple) et le `text_sensor` mappe code → chaîne via lookup lambda. Voir R16 pour la table complète des codes.

```text
script: _ph_calibration  (mode: single)
  on_enter:
    id(g_ph_calibration_in_progress) = true     // R13: bloque le bouton reset

  steps:
    1. notify HA "Plonger sonde dans pH 7.00, attendre stabilisation"  (gated on api.connected)
    2. delay 180 s

    3. // Capture multi-échantillon pH 7 (R14) avec NaN guards (R12)
       captures: vec<float> = []
       for i in 0..2:
         v = id(ads1115_a1).state
         if isnan(v):
           id(g_ph_last_result_code) = "Echec: capteur indispo (pH 7)"   // R16
           id(g_ph_calibration_in_progress) = false                  // R13: libère le verrou
           notify "Calibration échouée: capteur indisponible (pH 7)"
           abort
         captures.push(v)
         if i < 2: delay 5s
       v_min = min(captures); v_max = max(captures)
       if (v_max - v_min) > 0.050:
         id(g_ph_last_result_code) = "Echec: capture instable pH 7 (spread=<xx>mV)"
         id(g_ph_calibration_in_progress) = false
         notify "Calibration échouée: capture pH 7 instable (spread=<xx>mV > 50mV)"
         abort
       v7 = mean(captures)
       id(g_v_ph7) = v7

    4. notify HA "Rincer + plonger sonde dans pH 4.00"
    5. delay 180 s

    6. // Capture multi-échantillon pH 4 (R14) avec NaN guards (R12)
       captures = []
       for i in 0..2:
         v = id(ads1115_a1).state
         if isnan(v):
           id(g_ph_last_result_code) = "Echec: capteur indispo (pH 4)"
           id(g_ph_calibration_in_progress) = false
           notify "Calibration échouée: capteur indisponible (pH 4)"
           abort
         captures.push(v)
         if i < 2: delay 5s
       if (max(captures) - min(captures)) > 0.050:
         id(g_ph_last_result_code) = "Echec: capture instable pH 4 (spread=<xx>mV)"
         id(g_ph_calibration_in_progress) = false
         notify "Calibration échouée: capture pH 4 instable (spread=<xx>mV > 50mV)"
         abort
       v4 = mean(captures)
       id(g_v_ph4) = v4

    7. // Garde-fous (sur variables locales, pas encore écrites dans slope/intercept)
       if v7 <= v4:
         id(g_ph_last_result_code) = "Rejet: V_pH7<=V_pH4 (bains inversés ?)"
         id(g_ph_calibration_in_progress) = false
         notify "Calibration rejetée: V_pH7 <= V_pH4 — bains inversés ?"
         abort
       slope_candidate     = 3.0 / (v7 - v4)
       intercept_candidate = 7.0 - slope_candidate * v7
       if slope_candidate < 2.5 || slope_candidate > 5.0:
         id(g_ph_last_result_code) = "Rejet: pente=<x.xx> hors plage [2.5,5.0]"
         id(g_ph_calibration_in_progress) = false
         notify "Calibration rejetée: pente=<x.xx> hors plage saine [2.5, 5.0]"
         abort

    8. // Acceptation: écriture atomique des deux globals + last_result
       id(g_ph_slope)     = slope_candidate
       id(g_ph_intercept) = intercept_candidate
       id(g_ph_last_result_code) = "OK pente=<x.xx>, intercept=<y.yyy>"
       id(g_ph_calibration_in_progress) = false                      // R13: libère
       component.update sur les 5 diagnostics  (slope, intercept, V_pH7, V_pH4, last_result)
       notify "Calibration pH OK — pente=<x.xx>, intercept=<y.yyy>"

button: démarrer_calibration_ph
  on_press: script.execute _ph_calibration   // mode: single ignore le 2e press

button: reset_calibration_ph_usine
  on_press:
    if id(g_ph_calibration_in_progress):                              // R13
      notify "Calibration en cours, reset ignoré"
      return
    id(g_ph_slope)       = 3.56
    id(g_ph_intercept)   = -1.889
    id(g_ph_last_result_code) = "Reset usine"                              // R16
    component.update sur les 5 diagnostics
    notify "Calibration pH ramenée aux valeurs d'usine"
```

Notes :

- Toutes les notifications passent par `homeassistant.action: persistent_notification.create` enveloppé dans `if condition: api.connected:`. Le `g_ph_last_result_code` est le canal de recovery résilient à la déconnexion HA (R16).
- La formule du sensor `realtime_ph` devient `slope * V + intercept` (au lieu de `3.56 * V - 1.889 + offset`).
- Le bloc `interval: 1min` qui latche `g_store_pool_ph` est conditionné sur `!id(g_ph_calibration_in_progress)` (R15) — pas d'update pendant que les bains tampons sont en lecture.
- Un commentaire d'en-tête de fichier liste les writers de `g_ph_slope`/`g_ph_intercept` : (1) `_ph_calibration` étape 8, (2) `reset_calibration_ph_usine` (gardé par R13). Toute future addition d'un writer doit mettre ce commentaire à jour.
- Sur tout chemin d'abort, le flag `g_ph_calibration_in_progress` est explicitement remis à `false` AVANT le `notify` final — ne jamais laisser le flag set sur une erreur, sinon le bouton reset reste indéfiniment bloqué.

---

## Implementation Units

- [x] U1. **Réécriture du calcul pH + globals + sondes diagnostic**

**Goal:** Remplacer le modèle single-offset par le modèle slope+intercept avec valeurs d'usine. Mettre en place tous les globals et entités diagnostic dont U2 a besoin (flag anti-race, last_result). Aucun changement de comportement utilisateur visible tant que la calibration n'est pas relancée.

**Requirements:** R1, R2, R3, R10, R11, R13 (déclaration du flag), R15 (gating de l'interval), R16 (text_sensor last_result)

**Dependencies:** —

**Files:**
- Modify: `packages/ph.yaml`

**Approach:**
- Supprimer `g_ph_offset` (et l'ancien sensor `ph_offset_sensor`).
- Ajouter 6 globals :
  - `g_ph_slope` (float, `restore_value: true`, `initial_value: '3.56'`)
  - `g_ph_intercept` (float, `restore_value: true`, `initial_value: '-1.889'`)
  - `g_v_ph7` (float, `restore_value: true`, `initial_value: '0.0'`)
  - `g_v_ph4` (float, `restore_value: true`, `initial_value: '0.0'`)
  - `g_ph_calibration_in_progress` (bool, **`restore_value: false`** — flag éphémère, R13. Si l'ESP reboote en plein milieu d'une calib, le flag repart à false et le reset redevient utilisable)
  - `g_ph_last_result_code` (int, `restore_value: true`, `initial_value: '0'` — `0` = jamais calibré au premier boot, R16. Voir R16 pour la table de codes 0-8 et le rationale int-au-lieu-de-string)
- Réécrire le lambda du sensor `realtime_ph` : `return id(g_ph_slope) * id(ads1115_a1).state + id(g_ph_intercept);`. Conserver `accuracy_decimals: 1`, `update_interval: 10s`, et le filtre `sliding_window_moving_average` (window 18, send_every 6).
- Ajouter 4 sondes template diagnostic numériques (R11) : `pH Slope` (lambda `return id(g_ph_slope);`), `pH Intercept` (lambda `return id(g_ph_intercept);`), `V_pH7` (lambda `return id(g_v_ph7);`, unit_of_measurement `V`), `V_pH4` (idem). Toutes en `entity_category: diagnostic`.
- Ajouter 1 `text_sensor` diagnostic `pH Calibration Last Result` (R16) qui lit `g_ph_last_result_code`. `entity_category: diagnostic`. Pattern : `text_sensor: template` avec `entity_category: diagnostic` qui lit un global via un `lambda` et formate la valeur pour HA (cf. les exemples ESPHome dans le repo).
- Conserver à l'identique le sensor `pool_ph` (lecture de `g_store_pool_ph`).
- **Modifier le bloc `interval: 1min`** qui latche `g_store_pool_ph` : ajouter à la condition `and:` une 3ᵉ branche `- lambda: "return !id(g_ph_calibration_in_progress);"` (R15). Pendant une calibration, l'interval ne met PAS à jour `pool_ph`.
- Ajouter un commentaire d'en-tête de fichier listant les writers de slope/intercept (préparation pour U2) et précisant le rationale single-point → two-points + bornes garde-fous (cf. learning [redox-asymmetric-regulation-policy.md](../solutions/architecture/redox-asymmetric-regulation-policy.md)).

**Patterns to follow:**

- [packages/redox.yaml:1-15](../../packages/redox.yaml) pour le bloc `globals:` avec `restore_value: true`.
- [packages/redox.yaml:71-75](../../packages/redox.yaml) pour le pattern de sensor diagnostic qui expose un global numérique.
- [packages/redox.yaml:78-88](../../packages/redox.yaml) pour le pattern de `text_sensor` template qui expose un global string-équivalent.
- [packages/ph.yaml:58-69](../../packages/ph.yaml) (version actuelle) pour la structure de l'`interval: 1min` à modifier — ajouter la 3ᵉ branche `lambda` à la condition `and:`.

**Test scenarios:**

- Happy path / Covers AE1. Avec slope=3.56, intercept=-1.889 (valeurs d'usine, premier boot ou post-reset), une mesure ADS1115 à V=2.50 V doit donner pH = 8.011. À V=2.10 V → pH = 5.587. À V=1.65 V → pH = 3.985. Calculs vérifiables manuellement à partir du lambda.
- Edge case. Au boot avec valeurs persistées différentes (ex: slope=3.529, intercept=-1.824 — valeurs d'AE1), `realtime_ph(V=2.10)` doit donner 5.587 — confirme que `restore_value: true` charge bien les globals avant le premier calcul.
- Edge case. Si l'ADS1115 retourne NaN (probe débranché), `realtime_ph` propagera NaN — c'est le comportement actuel et acceptable côté affichage (HA affichera "unknown"). Ce n'est PAS le chemin de calibration (qui lui doit guarder, cf. U2).
- Edge case. Au premier boot après OTA depuis l'ancien firmware, `g_ph_calibration_in_progress` doit valoir `false` (`restore_value: false`, défaut bool) et `g_ph_last_result_code` doit valoir `""` (string vide). Le `text_sensor` "pH Calibration Last Result" affiche une valeur vide ou "—" selon le rendu HA.
- Integration / Covers R15. Forcer manuellement (via `lambda` de debug, ou via un bouton de test temporaire pendant développement) `g_ph_calibration_in_progress = true`, vérifier que pendant ~70 s le bloc `interval: 1min` ne met PAS à jour `g_store_pool_ph` même si `pump.is_on` et `pump_uptime ≥ pump_uptime_delay`. Remettre à `false`, vérifier que le tick suivant écrit normalement.
- ESPHome config validation : `esphome config salt_full.yaml` (après `sed`-rewrite) passe sans erreur. Idem pour les 5 autres presets qui incluent `packages/ph.yaml` (`salt_minimal`, `salt_wo_redox`, `salt_booster_full`, `salt_booster_minimal`, `salt_booster_wo_redox`).

**Verification:**

- Le firmware compile et démarre sans erreur sur les 6 presets impactés.
- En l'absence de calibration manuelle, le pH affiché est numériquement identique à la version précédente du firmware (mêmes V → mêmes pH).
- Les 4 sondes diagnostic numériques + 1 text_sensor apparaissent dans HA, avec valeurs initiales `slope=3.56`, `intercept=-1.889`, `V_pH7=0.0`, `V_pH4=0.0`, `pH Calibration Last Result=""`.
- Le flag `g_ph_calibration_in_progress` n'est pas exposé en HA (interne uniquement) et vaut `false` au boot.

---

- [x] U2. **Script de calibration two-points + bouton démarrage + bouton reset usine**

**Goal:** Ajouter la séquence interactive complète : un bouton qui orchestre pH7 → pH4 avec multi-capture spread check (R14), NaN guards (R12), garde-fous stricts (R4, R5), flag anti-race (R13), écriture de `g_ph_last_result_code` (R16) à chaque sortie, notifications HA à chaque étape, et un bouton de reset usine gardé par le flag (R13).

**Requirements:** R4, R5, R6, R7, R8, R9, R12, R13, R14, R16

**Dependencies:** U1 (a déclaré tous les globals + le text_sensor)

**Files:**
- Modify: `packages/ph.yaml`

**Approach:**

- Ajouter un script `_ph_calibration` en `mode: single` (cf. learning ESPHome script mode + Key Technical Decisions). Structure : voir le pseudo-code dans High-Level Technical Design ci-dessus — il est canonique pour cette unité.
- **R13 — flag set/clear** : à l'entrée du script, `id(g_ph_calibration_in_progress) = true`. Sur **chaque** chemin de sortie (succès final, NaN abort, spread > 50 mV, V_pH7 ≤ V_pH4, slope hors [2.5, 5.0]), remettre à `false` AVANT tout `notify` ou `return`. Vérifier en relecture que le flag est libéré sur les 6 chemins de sortie possibles — sinon le bouton reset reste indéfiniment bloqué après une calib échouée.
- **R14 — capture multi-échantillon** : à la fin de chaque fenêtre 180 s, faire 3 lectures de `id(ads1115_a1).state` espacées de `delay: 5s`. Stocker dans 3 globals temporaires ou (mieux) dans un `std::vector<float>` local au lambda si la version ESPHome 2026.3.3 le supporte ; sinon utiliser 3 lambdas séquentielles écrivant dans des globals scratch (`g_ph_cap_0`, `g_ph_cap_1`, `g_ph_cap_2`, non-restored, non-exposés). Calculer `spread = max - min`, abort si > 0.050 V. Sinon `v_pH7 = (cap0 + cap1 + cap2) / 3.0`. Mêmes étapes pour pH 4.
- **R12 — NaN guards** : à *chaque* lecture individuelle (3 par bain × 2 bains = 6 captures), tester `std::isnan(v)` immédiatement. Sur NaN, abort avec notif "Capteur indisponible (pH X)" + `g_ph_last_result_code = "Echec: capteur indispo (pH X)"` + clear du flag.
- **R16 — last_result à chaque sortie** : sur chaque chemin (succès et 5 chemins d'erreur), écrire `g_ph_last_result_code` avec une chaîne courte (≤ 60 chars idéalement) qui résume l'issue. Le format des chaînes est défini dans le pseudo-code HLD. Faire un `component.update: ph_last_result_sensor` après chaque écriture pour rafraîchir HA.
- **Garde-fous stricts (R4, R5)** : calculer `slope_candidate` et `intercept_candidate` dans des variables locales du lambda, vérifier les bornes, puis seulement *si valides* écrire `g_ph_slope` et `g_ph_intercept`. Sur rejet, les globals existants sont préservés (pattern fail-soft).
- **Notifications wrappées** : chaque `homeassistant.action: persistent_notification.create` est encapsulé dans `if condition: api.connected: then: ...` (cf. `_ntp_alert_once` dans `packages/filtration.yaml:309-321`). Le message de succès embarque slope/intercept calculés.
- Ajouter un bouton template `Démarrer calibration pH` (`entity_category: config`) qui fait `script.execute: _ph_calibration`.
- Ajouter un bouton template `Reset calibration pH usine` (`entity_category: config`) avec :
  - **Garde R13** : un `if` `condition: lambda: "return id(g_ph_calibration_in_progress);"` `then: notify "Calibration en cours, reset ignoré"` `else: ...` qui effectue le reset uniquement dans la branche `else`. Ne touche pas g_v_ph7/g_v_ph4 (audit).
  - Dans la branche `else` : restaurer slope=3.56, intercept=-1.889, écrire `g_ph_last_result_code = "Reset usine"`, `component.update` sur les 5 sondes diagnostic, et notifier HA "Calibration pH ramenée aux valeurs d'usine".
- Mettre à jour le commentaire d'en-tête de fichier (liste des writers de slope/intercept) : `_ph_calibration` (étape de validation), `reset_calibration_ph_usine` (gardé par R13).

**Patterns to follow:**

- [packages/filtration.yaml:309-321](../../packages/filtration.yaml) `_ntp_alert_once` — pattern `script: mode: single` + `if condition: api.connected: then: homeassistant.action`. Modèle direct pour les notifs.
- [packages/redox.yaml:91-110](../../packages/redox.yaml) bouton de calibration Redox — pattern `delay: 180s` + capture lambda + notif. À adapter au contexte two-points (deux délais 180 s + 3 sous-captures espacées de 5 s par bain).
- [packages/redox.yaml:133-142](../../packages/redox.yaml) bouton reset Redox — modèle pour `Reset calibration pH usine`, *augmenté* du garde R13 (vérification du flag avant écriture).

**Test scenarios:**

- Happy path / Covers AE1. Plonger sonde dans pH 7 (V≈2.50), presser "Démarrer calibration pH". Attendre 190 s (180 s stabilisation + 10 s pour les 3 sous-captures). Plonger dans pH 4 (V≈1.65). Attendre 190 s. Notif succès "Calibration pH OK — pente=3.529, intercept=-1.824". Sondes diagnostic mises à jour : `pH Slope`=3.529, `pH Intercept`=-1.824, `V_pH7`=2.500 (moyenne), `V_pH4`=1.650, `pH Calibration Last Result`="OK pente=3.529, intercept=-1.824".
- Error path / Covers AE2 / Covers R4. Démarrer calibration avec sonde dans pH 4 d'abord (V≈1.65 capturé en V_pH7), puis dans pH 7 (V≈2.50 capturé en V_pH4) → V_pH7 ≤ V_pH4 → notif rejet "Calibration rejetée: V_pH7 <= V_pH4 — bains inversés ?", `g_ph_slope` et `g_ph_intercept` inchangés. `g_v_ph7=1.65`, `g_v_ph4=2.50` exposés en diagnostic pour analyse SAV. `g_ph_last_result_code` = "Rejet: V_pH7<=V_pH4 (bains inversés ?)".
- Error path / Covers AE3 / Covers R5. Sonde HS donnant V_pH7=2.30, V_pH4=2.00 → slope_candidate = 10.0 (hors [2.5, 5.0]) → notif rejet "Calibration rejetée: pente=10.00 hors plage saine [2.5, 5.0]", globals slope/intercept inchangés. `g_ph_last_result_code` = "Rejet: pente=10.00 hors plage [2.5,5.0]".
- Error path / Covers R12. Coupure ADS1115 pendant la 1ʳᵉ sous-capture pH 7 → `id(ads1115_a1).state` retourne NaN → guard déclenché immédiatement → notif "Calibration échouée: capteur indisponible (pH 7)", flag remis à false, aucun global slope/intercept/V modifié. `g_ph_last_result_code` = "Echec: capteur indispo (pH 7)". Vérifier que le bouton reset redevient utilisable juste après.
- Error path / Covers R14. Sonde non stabilisée pendant la capture pH 7 : 3 sous-captures donnent 2.450, 2.500, 2.510 → spread = 60 mV > 50 mV → abort + notif "Calibration échouée: capture pH 7 instable (spread=60mV > 50mV)". Globals inchangés. Flag libéré.
- Error path / Covers R14 (cas mild). 3 sous-captures pH 7 : 2.498, 2.500, 2.502 → spread = 4 mV ≤ 50 mV → V_pH7 = 2.500 (moyenne). Pas d'abort. Calibration continue.
- Edge case. Repress de "Démarrer calibration pH" pendant qu'une séquence tourne → `mode: single` ignore le second trigger (comportement ESPHome attendu pour `single`). La séquence en cours se termine normalement.
- Race path / Covers R13. Démarrer calibration. Pendant la phase pH 7 (T=90s), presser "Reset calibration pH usine" → branche `if g_ph_calibration_in_progress` déclenchée → notif "Calibration en cours, reset ignoré", g_ph_slope/intercept inchangés. La calibration en cours continue normalement et écrit ses valeurs finales à T+~390s. Pas d'écriture concurrente.
- Reset path nominal. Après calibration acceptée (slope=3.529, intercept=-1.824), presser "Reset calibration pH usine" → `g_ph_calibration_in_progress` étant `false`, branche `else` exécutée → `g_ph_slope=3.56`, `g_ph_intercept=-1.889`, `g_ph_last_result_code`="Reset usine", sondes mises à jour, notif "Calibration pH ramenée aux valeurs d'usine". `g_v_ph7` et `g_v_ph4` restent à 2.50 / 1.65 (audit conservé).
- Integration / Covers R15. Pendant une calibration (flag = true), le bloc `interval: 1min` modifié dans U1 ne met PAS à jour `g_store_pool_ph` même si la pompe tourne depuis longtemps. Validation : démarrer la calib avec pump_uptime ≥ pump_uptime_delay, plonger probe en bain pH 7, attendre 65s, lire `pool_ph` dans HA → doit refléter la *dernière valeur d'avant la calib*, pas la lecture du bain tampon.
- Recovery path / Covers R16. Couper le WiFi du module pendant la phase pH 4 (T=300s). Les notifs HA suivantes ne sont pas délivrées (api.connected = false). Laisser la calib se terminer. Reconnecter le WiFi à T+450s. Le `text_sensor` "pH Calibration Last Result" affiche directement "OK pente=3.529, intercept=-1.824" (R16, restored value), permettant à l'opérateur de constater le succès sans avoir reçu la notif de fin.
- ESPHome config validation : `esphome config salt_full.yaml` (après `sed`-rewrite) passe sans erreur après ajout du script et des deux boutons. Vérifier que les `if condition:`/`else:` du bouton reset valident schéma.

**Verification:**

- Une calibration nominale produit slope/intercept dans la plage attendue et notifie l'opérateur. `g_ph_last_result_code` reflète le succès.
- Une calibration aux valeurs aberrantes (bains inversés, sonde HS, capteur NaN, capture instable) est rejetée — globals inchangés, notif explicite, `g_ph_last_result_code` documente la raison.
- Le flag `g_ph_calibration_in_progress` est libéré sur **toutes** les sorties (vérifier les 6 chemins en relecture du YAML) — un `grep g_ph_calibration_in_progress packages/ph.yaml | grep '= false'` doit montrer ≥ 6 occurrences (1 par chemin de sortie).
- Pendant une calibration, presser le bouton reset notifie sans écrire — vérifié par lecture des sondes diagnostic après le press.
- Pendant une calibration, `pool_ph` ne se met pas à jour, même pompe tournante.
- Après reconnexion HA, l'issue de la calib est lisible via le text_sensor même si les notifs ont été perdues.

---

- [x] U3. **Mise à jour README + dashboard**

**Goal:** Documenter le nouveau flux de calibration côté utilisateur (procédure, durée, recovery), nettoyer la doc / dashboard pour éviter les références orphelines, et expliciter les bonnes pratiques opérateur (pompe coupée).

**Requirements:** Hygiène doc — pas de R direct, supporte la traçabilité de R7, R9, R16 (canal de recovery doc'é) et la limitation "pas de compensation T°". Renforce la bonne pratique liée à R15 (recommander de couper la pompe).

**Dependencies:** U1, U2

**Files:**
- Modify: `README.md`
- Modify: `homeassistant/dashboard/frangipool.yaml` (uniquement si une carte référence explicitement `pH Calibration 7.00` ou `pH Offset` — sinon laisser le dashboard auto-cacher via détection d'entités, conformément à CLAUDE.md)

**Approach:**

- README.md (table des boutons) : remplacer la ligne unique "pH Calibration 7.00" par deux entrées : "Démarrer calibration pH" (séquence pH 7 → pH 4 guidée par notifications) et "Reset calibration pH usine" (gardé pendant qu'une calibration est en cours).
- README.md (table des packages) : mettre à jour la description de `packages/ph.yaml` pour refléter "Capteur pH (ADS1115 A1), calibration two-points pH 7+pH 4 (slope+intercept), 4 sondes diagnostic + text_sensor d'audit".
- **Ajouter une nouvelle section "Procédure de calibration pH"** dans le README, contenant :
  - Matériel : tampons pH 7.00 et pH 4.00 (sachets prêts à diluer chez la plupart des fournisseurs aquariophiles/piscine).
  - Préparation : **couper la pompe avant de démarrer la calibration** (conseil de bonne pratique — le firmware protège `pool_ph` automatiquement via R15, mais c'est plus propre).
  - Étapes : (1) sortir la sonde de la piscine et la rincer, (2) la plonger dans le tampon pH 7, (3) presser "Démarrer calibration pH" dans HA, (4) suivre les notifications HA — rincer + plonger en pH 4 quand demandé, (5) attendre la notif de succès "Calibration pH OK — pente=X.XX".
  - Durée totale : environ 6 min 20 s (180 s pH 7 + 10 s sous-captures + 180 s pH 4 + 10 s sous-captures + transitions).
  - **Si aucune notification de fin n'arrive sous ~7 minutes** (déconnexion HA possible), consulter le `text_sensor` "pH Calibration Last Result" dans les diagnostics : "OK pente=…" = calibration réussie, "Rejet: …" / "Echec: …" = à refaire, "" (vide) = pas de calib enregistrée. Vérifier aussi `pH Slope` (3.56 = défaut, autre = calib appliquée).
  - Cas de rejet possibles (à documenter brièvement) : bains inversés (R4), sonde usée (R5), capture instable (R14), capteur indisponible (R12).
  - Limitation : **pas de compensation en température**, on assume 25 °C. Erreur résiduelle ≤ 0.1 pH dans la plage piscine 15–30 °C.
  - Fréquence recommandée : recalibrer en début de saison et après remplacement de sonde.
- Vérifier la mention "antigel, calibration" du README (table des notifications) : élargir si nécessaire pour mentionner les nouvelles notifs (succès calib, rejet, capture instable, race reset, reset usine).
- Dashboard ([homeassistant/dashboard/frangipool.yaml](../../homeassistant/dashboard/frangipool.yaml)) : la review feasibility a confirmé que le dashboard ne référence que `sensor.frangipool_ph` (préservé). Aucune carte ne nomme `pH Offset` ou `pH Calibration 7.00`. **Aucun changement dashboard nécessaire** — les nouvelles sondes diagnostic apparaîtront automatiquement dans la zone diagnostics HA si l'utilisateur les active.
- Mentionner dans le commit message / PR description que l'OTA invalide l'ancienne calibration `g_ph_offset` (storage cleanup côté ESPHome) et qu'une recalibration est requise. Souligner aussi les durcissements : flag anti-race, multi-capture spread, gating de l'interval, text_sensor de recovery.

**Patterns to follow:**

- README existant : ton et structure des tables de boutons / packages.
- CLAUDE.md "Where to find more context" : convention sur les références dashboard ("default to dropping").

**Test scenarios:**

- Test expectation: none — modification documentaire (pas de behavioral test côté firmware). Vérifications manuelles :
  - Le README rendu (GitHub Markdown) ne contient plus de référence à `g_ph_offset` ni au bouton single-point pH 7.00.
  - La nouvelle section "Procédure de calibration pH" est lisible et auto-suffisante (un opérateur n'ayant pas vu le brainstorm peut suivre la procédure).
  - La consigne "couper la pompe avant calibration" est mentionnée explicitement.
  - La consigne de recovery via le `text_sensor` "pH Calibration Last Result" est documentée pour le cas déconnexion HA.
  - Dashboard chargé sur `salt_full.yaml` après flash : aucune erreur "entité introuvable" dans HA (vérifié indirectement par la review feasibility — pas de référence aux entités supprimées).

**Verification:**

- README.md cohérent avec le firmware : boutons (Démarrer / Reset), 5 entités diagnostic (slope, intercept, V_pH7, V_pH4, last result text_sensor), limitation T°, procédure complète.
- Dashboard ne référence plus l'ancien `pH Offset` ni l'ancien bouton de calibration single-point. Pas d'entité orpheline dans HA.
- Le commit message / PR description annonce le breaking change OTA et liste les durcissements (R12–R16).

---

## System-Wide Impact

- **Interaction graph:** Writers de `g_ph_slope` / `g_ph_intercept` : (1) `_ph_calibration` étape 8 (succès), (2) `reset_calibration_ph_usine` — branche `else` du garde R13 uniquement. Le bouton reset gardé par le flag élimine la race avec le script. Reader unique : la lambda du sensor `realtime_ph`. Aucun autre package du repo ne lit `g_ph_offset` (vérifié) ni les nouveaux globals — la suppression et l'ajout sont localisés à `packages/ph.yaml`.
- **Error propagation:** NaN sur `ads1115_a1.state` se propage en NaN dans `realtime_ph` (comportement actuel, acceptable côté affichage HA = "unknown"). Le chemin de calibration est durci par 3 lignes de défense : (a) NaN guard R12 sur chaque sous-capture, (b) spread check R14 qui détecte les staleness invisibles au NaN guard, (c) bornes R4/R5 sur les valeurs candidates. Les notifications HA sont best-effort (`api.connected` snapshot) ; la vérité durable est dans `g_ph_last_result_code` (R16).
- **State lifecycle risks:** 5 globals restaurés (`g_ph_slope`, `g_ph_intercept`, `g_v_ph7`, `g_v_ph4`, `g_ph_last_result_code`) + 1 global éphémère (`g_ph_calibration_in_progress`, `restore_value: false` — démarre à `false` au boot, donc une coupure de courant en plein milieu d'une calibration laisse le système dans un état où le reset est immédiatement utilisable). À la première OTA depuis l'ancienne version, `g_ph_offset` cesse d'être référencé et son stockage flash est éventuellement réutilisé par ESPHome — pas de fuite de données.
- **API surface parity:** Aucune action API HA exposée n'est cassée. Nouvelles entités HA : 4 sondes diagnostic numériques + 1 text_sensor diagnostic + 2 boutons config. Toutes apparaissent par auto-discovery ESPHome.
- **Integration coverage:** Tests E2E nécessaires sur hardware : (a) calibration nominale en bains tampons, vérifier concordance ±0.1 pH avec un pH-mètre de référence sur la plage 6.8–8.0 ; (b) test de race : presser reset pendant calib, vérifier non-écriture ; (c) test de gating : forcer pompe ON > 20 min, démarrer calib, vérifier `pool_ph` figé ; (d) test de recovery : déconnecter WiFi en plein milieu, vérifier que `g_ph_last_result_code` reflète l'issue après reconnexion. Aucune simulation logicielle ne couvre ces scénarios.
- **Unchanged invariants:** `pool_ph` reste sampled via `g_store_pool_ph`, latché par le bloc `interval: 1min`. Les **règles de latching changent légèrement** : on conserve les conditions existantes (`pump.is_on` + `pump_uptime ≥ pump_uptime_delay`) ET on ajoute la 3ᵉ branche `!g_ph_calibration_in_progress` (R15). Le filtre `sliding_window_moving_average` sur `realtime_ph` est inchangé. La pin ADS1115 A1 et le gain 6.144V sont inchangés. Aucune modification des modules Redox, filtration, antifreeze, ou de la pump authority.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| L'utilisateur intervertit les bains tampons (presse "Démarrer" puis plonge dans pH 4 d'abord) | Garde-fou R4 : rejet automatique avec notif explicite "V_pH7 <= V_pH4 — bains inversés ?". L'utilisateur recommence. Aucune corruption silencieuse. |
| ADS1115 retourne NaN pendant la capture (probe débranché, faux contact) | Guard `std::isnan` (R12) à chaque sous-capture : abort + notif, aucun global slope/intercept/V écrit. Pattern du learning antifreeze. Flag R13 libéré pour ne pas bloquer le reset. |
| Lecture I²C stale (bus figé, dernière valeur valide retournée — invisible au NaN guard) | Spread check R14 : 3 sous-captures espacées de 5 s, abort si max−min > 50 mV. Une staleness produit soit une valeur stable mais fausse (capturée par les bornes R5 ou R4), soit des sauts récents qui dépassent 50 mV — couvert. |
| Race "Reset pendant calibration" — silence + écriture concurrente | Verrou `g_ph_calibration_in_progress` (R13) : le bouton reset, vérifie le flag et notifie sans écrire si la calib tourne. `mode: single` empêche le re-press du démarrage. |
| Pollution de `pool_ph` pendant la calib si la pompe tournait déjà depuis > pump_uptime_delay | Gating R15 : le bloc `interval: 1min` est conditionné sur `!g_ph_calibration_in_progress`. `pool_ph` figé pendant toute la séquence, retour automatique au sampling normal après libération du flag. |
| Notifs HA perdues pendant la calib (déconnexion WiFi/HA mid-séquence) | Canal de recovery R16 : `text_sensor` "pH Calibration Last Result" persistant qui reflète l'issue après reconnexion. Documenté dans le README. |
| Calibration acceptée mais slope/intercept persistés corrompus (cas théorique : bug ESPHome dans le restore, wear flash, coupure pendant write) | Recovery manuelle : bouton "Reset calibration pH usine" disponible. Pas de sanity check automatique au boot (décision F5 = skip) — accepté comme tradeoff de simplicité, le scénario reste théorique. |
| Régression de pH après OTA (ancien `g_ph_offset` perdu, nouveaux defaults appliqués) | Comportement attendu et documenté dans le README + commit message. Les valeurs d'usine `(3.56, -1.889)` reproduisent la formule pré-calibration de l'ancien firmware — donc tant que `g_ph_offset` était à 0 (cas le plus courant), le pH affiché reste numériquement identique. |
| Câblage Gravity v2.0 inversé (variante non-supportée) | Hypothèse documentée : Gravity v2.0 non-inversé (pH7≈2.5V). À vérifier au flash via `esphome logs`. Si inversé, le slope calculé sera négatif et rejeté par R5 — l'utilisateur saura immédiatement. |
| Drift de pente non-détectée (sonde vieillit lentement, slope reste juste dans [2.5, 5.0]) | Pas de détection automatique en v1. La calibration two-points périodique recapture la pente — conseiller à l'utilisateur de calibrer chaque saison dans le README. |
| Reboot ESP en plein milieu de la calibration → flag R13 perdu, `g_v_ph7` persisté mais `g_v_ph4` stale | `g_ph_calibration_in_progress` est `restore_value: false` → repart à `false` au boot (le bouton reset est immédiatement utilisable). `g_v_ph7` est rouverture sur prochaine calibration. Diagnostics affichent un mix V_pH7-récent / V_pH4-ancien jusqu'à la prochaine calib — purement cosmétique car slope/intercept eux ne sont pas écrits. Acceptable. |
| Validation CI cassée par une erreur de syntaxe YAML | Pré-validation locale via `sed`-rewrite + `esphome config salt_full.yaml` avant push (snippet CLAUDE.md). |

---

## Documentation / Operational Notes

- Commit message / PR description doit annoncer le breaking change : "OTA invalide l'ancienne calibration `g_ph_offset` ; recalibrer en two-points après upgrade".
- Le README explique le matériel nécessaire (tampons pH 7 et pH 4 — généralement vendus en sachets prêts à diluer) et la procédure (~6 min total).
- Pas de monitoring particulier requis. Les 4 sondes diagnostic permettent à l'opérateur de vérifier l'état de la calibration depuis HA.
- Aucun feature flag, déploiement progressif, ou rollback automatique : ce repo flashe une seule unité hardware.

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-25-001-ph-two-point-calibration-requirements.md](../brainstorms/2026-04-25-001-ph-two-point-calibration-requirements.md)
- Related code: [packages/ph.yaml](../../packages/ph.yaml), [packages/redox.yaml](../../packages/redox.yaml), [packages/filtration.yaml](../../packages/filtration.yaml)
- Architectural learnings: [docs/solutions/architecture/esphome-script-mode-queued-vs-restart.md](../solutions/architecture/esphome-script-mode-queued-vs-restart.md), [docs/solutions/architecture/antifreeze-nan-silent-failure.md](../solutions/architecture/antifreeze-nan-silent-failure.md), [docs/solutions/architecture/redox-asymmetric-regulation-policy.md](../solutions/architecture/redox-asymmetric-regulation-policy.md)
- CI workflow: [.github/workflows/validate.yml](../../.github/workflows/validate.yml)
- Project conventions: [CLAUDE.md](../../CLAUDE.md)
