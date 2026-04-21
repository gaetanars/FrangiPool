---
date: 2026-04-21
topic: consolidate-pump-authority
todo: 002
---

# Consolider l'autorité de la pompe dans filtration.yaml

## Problem Frame

Trois chemins indépendants écrivent actuellement sur le switch `pump` :

1. `packages/base.yaml:171-173` — `on_release` de l'antigel : `switch.turn_off: pump` (inconditionnel).
2. `packages/base.yaml:211-218` — interval 30s qui fait `switch.turn_on: pump` si antigel actif.
3. `packages/filtration.yaml:441-527` — interval 30s du scheduler (gère antigel, mode forcé, cycles, mode Off).

Deux conséquences indésirables :

- **Drop mi-cycle pendant un traitement forcé** : cycle forcé 24h + matin froid → antigel se désactive au lever du soleil → `on_release` coupe la pompe pendant ~30s avant que l'interval filtration ne la rallume. Gênant pendant un choc chloré ou un traitement ponctuel.
- **Chatter relais aux transitions antigel** : les deux intervals 30s ne sont pas synchronisés. À certains ticks, l'un peut écrire OFF pendant que l'autre écrit ON dans la même seconde. Érosion du contact sur le long terme.

Les 8 presets incluent `base.yaml` ET `filtration.yaml` — aucune configuration où `base.yaml` tiendrait seul.

## Requirements

- **R1.** Supprimer `switch.turn_off: pump` du `on_release` de l'antigel dans `packages/base.yaml`. La notification HA "Fin du mode hors-gel" reste en place.
- **R2.** Supprimer entièrement le bloc `interval: 30s` antigel de `packages/base.yaml` (redondant avec `filtration.yaml:458-461`).
- **R3.** `filtration.yaml` reste seule autorité de contrôle du switch `pump`.
- **R4.** Le bloc `on_turn_on` du switch `pump` (met à jour le global `pump_last_turn_on`) est préservé — ce n'est pas une écriture sur la pompe, c'est un handler de transition d'état qui reste utile pour le capteur `pump_uptime`.

## Success Criteria

- Un cycle forcé 24h qui traverse une désassertion antigel ne provoque plus de coupure transitoire de la pompe.
- Aucun chatter relais observé aux transitions antigel (pas d'alternance ON/OFF dans la même minute).
- Mode Off + antigel actif → pompe tourne toujours (filtration.yaml:458-461 couvre ce cas).
- Un toggle manuel du capteur `antifreeze` dans HA déclenche la pompe comme avant.

## Scope Boundaries

- **Non-goal** : refactoring plus large de `filtration.yaml` ou réorganisation inter-packages.
- **Non-goal** : fallback pompe si `filtration.yaml` est absent. Tous les presets l'incluent.
- **Non-goal** : modification du bloc `switch` pump lui-même (GPIO, restore_mode, name, icon, on_turn_on).
- **Non-goal** : modification de la notification HA "Fin du mode hors-gel" — seule la ligne `switch.turn_off: pump` est retirée.

## Key Decisions

- **Option A (retrait complet) retenue sur B (belt-and-suspenders)** : les 8 presets incluent toujours filtration.yaml, donc garder une boucle antigel redondante dans base.yaml n'apporte qu'un risque de chatter sans bénéfice réel. Un seul modèle mental est plus maintenable qu'une défense en profondeur qui introduit son propre bug (chatter).

## Dependencies / Assumptions

- Aucune config ne peut charger `base.yaml` sans `filtration.yaml` — vérifié : les 8 presets référencent les deux packages.

## Outstanding Questions

### Resolve Before Planning

_(aucune)_

### Deferred to Planning

- [Affects R2][Technical] Vérifier que `component.update` et autres references éventuelles au 30s interval de base.yaml ne sont pas utilisées ailleurs (recherche rapide avant retrait).

## Next Steps

→ `/ce:plan` pour un plan d'implémentation court (édition unique de `packages/base.yaml`, validation CI).
