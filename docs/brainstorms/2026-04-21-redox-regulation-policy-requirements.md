---
date: 2026-04-21
topic: redox-regulation-policy
todo: 003
---

# Politique de régulation Redox électrolyseur (OFF rapide / ON lent)

## Problem Frame

`packages/redox_electrolyser.yaml` régule l'électrolyseur dans trois endroits simultanés :

1. `select.electrolyser_mode.on_value` (lignes 20-32) — one-shot sur changement de mode.
2. `sensor.pool_redox.on_value_range` (lignes 48-64) — déclenche sur franchissement de seuil : `above: setpoint → OFF` et `below: setpoint-30 → ON` (ce dernier gardé par `redox_trend_state != 1`).
3. `interval: 1min` (lignes 66-99) — poll 1 min avec `redox_stable_minutes >= 30` requis avant ON.

Le trigger `on_value_range below → ON` tire dès qu'ORP passe sous `setpoint-30` (tendance non-montante), sans attendre la fenêtre de stabilité de 30 min. Le `redox_stable_minutes` devient inatteignable — le gate existe dans le code mais jamais appliqué.

C'est un problème de sécurité fonctionnelle : la présence du compteur de stabilité suggère à l'utilisateur que l'électrolyseur attend un signal ORP soutenu avant d'activer, alors qu'en pratique il réagit à toute baisse transitoire.

## Requirements

- **R1.** Supprimer le chemin `on_value_range below: setpoint-30 → turn_on` de l'extension `pool_redox` (lignes ~57-64). Il entre en conflit avec le gate de stabilité et doit disparaître.
- **R2.** Conserver `on_value_range above: setpoint → turn_off` comme protection rapide contre sur-chloration (réponse immédiate au franchissement supérieur).
- **R3.** L'interval 1 min reste l'autorité unique d'activation ON, avec le gate `redox_stable_minutes >= 30` effectivement appliqué (tendance non-montante pendant 30 min avant ON).
- **R4.** L'interval 1 min conserve son bloc OFF comme filet de sécurité pour les cas où `on_value_range` ne peut pas fire (ex : état déjà au-dessus de setpoint lors d'un passage en mode Auto, sans franchissement). Deux chemins OFF (rapide + backstop) acceptés ; un seul chemin ON (gated).
- **R5.** Le global `redox_stable_minutes` et sa logique d'incrémentation/reset sont préservés — ils sont maintenant réellement appliqués.
- **R6.** Un commentaire en tête de fichier décrit la politique asymétrique retenue : « OFF rapide (protection sur-chloration) / ON lent (filtre bruit capteur) » avec la logique des 30 min de stabilité.

## Success Criteria

- Un dip ORP transitoire (bruit capteur, agitation de l'eau, quelques minutes < setpoint-30) ne déclenche plus l'électrolyseur.
- Un dépassement ORP > setpoint coupe l'électrolyseur dans les secondes, pas dans les minutes.
- Le compteur `redox_stable_minutes` est visible et affecte réellement le comportement (un reviewer qui lit le code comprend qu'il contrôle l'activation).
- `grep 'electrolyser\.turn_on\|electrolyser\.turn_off' packages/redox_electrolyser.yaml` n'expose plus qu'un seul chemin ON (l'interval).

## Scope Boundaries

- **Non-goal** : modifier la valeur du gate (30 min) ou le seuil `setpoint-30`. Ces choix chimie restent.
- **Non-goal** : modifier la logique `redox_trend_state` dans `packages/redox.yaml` (hors scope).
- **Non-goal** : retirer le `on_value` de `select.electrolyser_mode` — il gère les transitions utilisateur (Off/Auto/Forcé) et reste utile.
- **Non-goal** : refactoring plus large du fichier ou extraction vers un autre package.

## Key Decisions

- **Hybride asymétrique retenu** sur Option A (tout-interval) et Option B (tout-on_value_range) :
  - OFF rapide = protection sur-chloration (priorité sanitaire : surdosage chlore est le pire scénario).
  - ON lent = filtre bruit capteur (un retard de 30 min sur la remontée est acceptable, les cinétiques chlore piscine sont lentes).
- **Le bloc OFF de l'interval est conservé comme backstop** et non supprimé : il couvre les cas où aucun franchissement de seuil n'a lieu (ex : ORP déjà au-dessus lors d'un passage Off → Auto).

## Dependencies / Assumptions

- `redox_trend_state` est défini dans `packages/redox.yaml` et reste disponible. La logique d'incrémentation de `redox_stable_minutes` s'appuie sur `redox_trend_state <= 0`.
- Tous les presets qui chargent `redox_electrolyser.yaml` chargent aussi `redox.yaml` (à vérifier au planning mais attendu vrai).

## Outstanding Questions

### Resolve Before Planning

_(aucune)_

### Deferred to Planning

- [Affects R4][Technical] Vérifier pendant la planification si le bloc OFF de l'interval expose une race avec `on_value_range above → OFF` (ex: double appel `turn_off`). ESPHome est tolérant aux appels idempotents mais à confirmer.
- [Affects R6][Technical] Position exacte du commentaire de tête (avant `globals:` vs en en-tête de fichier).

## Next Steps

→ `/ce:work` directement — scope borné, décisions claires, AC mesurables, un seul fichier touché.
