---
date: 2026-04-25
topic: ph-two-point-calibration
---

# pH two-point calibration (Gravity pH Meter v2.0)

## Problem Frame

Le module pH actuel ([packages/ph.yaml](../../packages/ph.yaml)) corrige uniquement un **offset additif** via une calibration single-point au pH 7. La **pente** de la sonde est figée à la valeur d'usine du Gravity v2.0 (`3.56 pH/V`) et ne peut pas être recalibrée. Conséquence : le vieillissement de la sonde, une dérive de pente liée au remplacement, ou un câblage légèrement différent produisent un pH **silencieusement faux** que l'opérateur ne peut corriger qu'en bidouillant l'offset — ce qui masque le vrai problème de pente plutôt que de le mesurer.

Une calibration two-point pH 4 + pH 7 est la procédure standard du fabricant Gravity et permet de recalculer **pente ET intercept** pour conserver une mesure correcte sur toute la durée de vie de la sonde. C'est aussi un prérequis pour fiabiliser n'importe quelle régulation pH+ future, qui s'appuiera sur `pool_ph` comme source de vérité.

---

## Key Flows

- F1. **Calibration two-point pH 7 → pH 4**
  - **Trigger:** l'opérateur presse le bouton HA "Démarrer calibration pH"
  - **Steps:**
    1. Notif HA : "Plonger la sonde dans le tampon pH 7.00, attendre stabilisation"
    2. Délai de stabilisation (180 s, aligné avec le pattern Redox)
    3. Capture de `V_pH7` depuis `ads1115_a1`
    4. Notif HA : "Rincer la sonde et plonger dans le tampon pH 4.00"
    5. Délai 180 s
    6. Capture de `V_pH4`
    7. Calcul `slope` et `intercept`, vérification des garde-fous (R4, R5)
    8. Si valide → écriture des globals, mise à jour des sondes diagnostic, notif succès avec valeurs calculées
    9. Si rejet → globals de calibration inchangés, V_pH7/V_pH4 conservés en diagnostic, notif d'erreur indiquant la raison
  - **Outcome:** soit la sonde est recalibrée et `pool_ph` reflète la mesure exacte, soit la calibration précédente reste intacte et l'opérateur sait pourquoi le rejet a eu lieu
  - **Covered by:** R1, R2, R4, R5, R7, R8

---

## Requirements

**Calcul de pH (math)**
- R1. Le pH affiché applique une régression linéaire deux points : `pH = g_ph_slope × V + g_ph_intercept`, où `V` est la tension brute de `ads1115_a1` en volts.
- R2. À chaque calibration acceptée, les globals sont recalculés ainsi : `g_ph_slope = 3.0 / (V_pH7 − V_pH4)` et `g_ph_intercept = 7.0 − g_ph_slope × V_pH7`.
- R3. En l'absence de calibration valide (premier boot, après reset usine), les valeurs par défaut sont `g_ph_slope = 3.56` et `g_ph_intercept = -1.889`. Le comportement initial est strictement identique à l'implémentation actuelle.

**Garde-fous (le rejet est strict, jamais d'application "douteuse")**
- R4. La calibration est rejetée — globals inchangés — si `V_pH7 ≤ V_pH4` (bains intervertis, sonde câblée à l'envers, ou capture pendant que l'opérateur changeait de bain).
- R5. La calibration est rejetée si la pente calculée est hors `[2.5, 5.0]` pH/V (sonde HS, tampon contaminé, faux contact, court-circuit).
- R6. En cas de rejet, une notification HA explicite indique la raison (`Pente=X.XX hors plage saine [2.5, 5.0]` ou `V_pH7 ≤ V_pH4 — bains inversés ?`). Les V_pH7 et V_pH4 mesurés sont conservés en diagnostic pour permettre l'analyse SAV.

**UX de calibration**
- R7. Un bouton HA unique "Démarrer calibration pH" déclenche la séquence atomique pH 7 → pH 4 (cf. F1). Aucune capture isolée d'un seul des deux points n'est exposée — la calibration deux points est indivisible.
- R8. La séquence émet une notification HA `persistent_notification.create` à chaque étape clé : démarrage, passage pH 7 → pH 4, résultat (succès avec slope/intercept ou rejet avec raison). Notifications wrappées dans `api.connected:` comme les autres alertes du firmware.
- R9. Un bouton HA "Reset calibration pH usine" remet `g_ph_slope = 3.56` et `g_ph_intercept = -1.889`, notifie l'opérateur, et met à jour les sondes diagnostic.

**Persistance**
- R10. Les globals `g_ph_slope` et `g_ph_intercept` sont persistés (`restore_value: true`) — la calibration survit aux reboots et aux OTA partielles. Les V_pH7 et V_pH4 capturés sont aussi persistés pour exposition diagnostic.

**Diagnostic exposé à HA**
- R11. Quatre sondes diagnostic (entity_category: diagnostic) : `pH Slope`, `pH Intercept`, `V_pH7 (dernier)`, `V_pH4 (dernier)`. Permettent au mainteneur de comprendre l'état de la calibration sans relire les logs ESPHome.

---

## Acceptance Examples

- AE1. **Covers R1, R2.** Calibration nominale : `V_pH7 = 2.50 V`, `V_pH4 = 1.65 V` → `slope = 3 / (2.50 − 1.65) = 3.529 pH/V`, `intercept = 7 − 3.529 × 2.50 = −1.824`. Une mesure ultérieure à `V = 2.10 V` donne `pH = 3.529 × 2.10 − 1.824 = 5.587`.
- AE2. **Covers R4.** L'opérateur intervertit les bains : `V_pH7 = 1.65`, `V_pH4 = 2.50` → `V_pH7 ≤ V_pH4` → calibration rejetée, `g_ph_slope`/`g_ph_intercept` inchangés, notif HA "Calibration pH rejetée : V_pH7 ≤ V_pH4, vérifier l'ordre des bains".
- AE3. **Covers R5.** Sonde en fin de vie : `V_pH7 = 2.30`, `V_pH4 = 2.00` → `slope = 3 / 0.30 = 10.0` pH/V (hors plage `[2.5, 5.0]`) → calibration rejetée, notif "Calibration pH rejetée : pente=10.00 hors plage saine".

---

## Success Criteria

- Après une calibration réussie, le pH affiché concorde avec un pH-mètre de référence à ±0.1 dans la plage piscine 6.8–8.0.
- Une calibration aux valeurs aberrantes (bains inversés, sonde HS) ne corrompt jamais la calibration courante : l'opérateur reçoit une notification explicite et conserve la dernière calibration valide.
- Les sondes diagnostic permettent à un mainteneur de diagnostiquer un problème de calibration via le dashboard HA sans connecter le port série du module.
- Le plan d'implémentation peut générer le YAML directement depuis ce doc sans inventer de comportement utilisateur (le math, les garde-fous, et le flux UX sont entièrement spécifiés).

---

## Scope Boundaries

- **Pas de compensation en température** : on assume 25 °C, c'est documenté dans le README. L'erreur sur la pente reste ≤0.1 pH dans la plage piscine 15–30 °C, marginale pour une cible 7.0–7.6 ±0.1.
- **Pas d'offset manuel additif** (équivalent du `redox_manual_offset`) : la calibration two-point est la seule source de vérité. Un slider d'offset masquerait la dérive de la sonde et installerait un anti-pattern où l'opérateur ne refait jamais de calibration propre.
- **Pas de calibration trois points** (pH 4 + 7 + 10) : le pH piscine vit autour de 7.0–7.8, donc deux points encadrent largement la zone d'usage et la non-linéarité de la sonde y est négligeable.
- **Pas de support multi-cartes** : la cible est exclusivement le Gravity pH Meter v2.0 (DFRobot SEN0161-V2). Les v1.x, clones, ou cartes inversées ne sont pas validés et peuvent produire des pentes hors `[2.5, 5.0]` qui seront rejetées par R5 — c'est intentionnel.
- **Pas de migration in-place de l'ancien `g_ph_offset`** : à l'OTA, l'ancienne calibration est invalidée et le firmware redémarre avec les valeurs d'usine. L'opérateur doit refaire une calibration two-point. À documenter dans le README et le commit message.

---

## Key Decisions

- **Slope + intercept stockés directement, pas slope + offset additif** : on remplace complètement le couple `(3.56, -1.889)` plutôt que d'empiler une correction. Plus simple à raisonner, math plus pure, pas de mode "calibration partielle ambiguë".
- **Garde-fous stricts (R4, R5) plutôt que warning permissif** : sur du pH, une mauvaise calibration silencieuse fausse toute la régulation aval (pH+ injecté à mauvais escient). Le rejet + notif force l'opérateur à recommencer correctement.
- **Délai 180 s entre captures** : cohérent avec le pattern Redox existant, laisse le temps de la stabilisation chimique et du rinçage manuel.
- **Bouton unique "Démarrer calibration" plutôt que deux boutons indépendants** : la calibration two-point est une opération atomique en paire — pas de demi-calibration valide. Modèle UX différent du Redox (où chaque point sert un offset indépendant).

---

## Dependencies / Assumptions

- L'ADC ADS1115 sur A1 reste la source du signal (gain 6.144V, update 10s) — inchangé par rapport au [packages/ph.yaml](../../packages/ph.yaml) actuel.
- Le filtre `sliding_window_moving_average` du sensor `realtime_ph` (window=18, send_every=6) reste en aval de la formule corrigée. Le calcul de calibration lit `ads1115_a1` brut, donc le filtre n'affecte pas la capture de V_pH7/V_pH4.
- Le sensor `pool_ph` (échantillonné via `g_store_pool_ph` quand la pompe a tourné > `pump_uptime_delay`) reste inchangé — il continue de latcher la valeur de `realtime_ph`.
- **Hypothèse non vérifiée à confirmer en planning** : la formule actuelle `3.56 × V − 1.889` correspond bien au câblage Gravity v2.0 non-inversé (pH7 ≈ 2.5 V, pH4 ≈ 1.65 V). À valider sur la sonde réelle au moment de l'implémentation, soit en relisant les logs ESPHome, soit en mesurant au multimètre.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R1, R11][Technical] Faut-il moyenner les N derniers échantillons de `ads1115_a1` sur les ~30 dernières secondes de la fenêtre de stabilisation, ou capturer une valeur instantanée à T+180s comme le fait le Redox ? Le pH étant plus sensible au bruit, une moyenne courte vaut probablement le coup — à arbitrer en planning selon la stabilité observée.
- [Affects R7][Technical] Mode du script de calibration : `restart` (un nouveau press relance proprement la séquence) vs single-run avec verrou global (`g_ph_calibration_in_progress`) qui ignore les presses pendant l'exécution. Le pattern projet préfère `restart` pour les scripts à lambda pure, mais ce script a des effets de bord (notifications) qui peuvent justifier le verrou.
- [Affects R10][Technical] Reset usine (R9) doit-il purger les `V_pH7`/`V_pH4` capturés ou les laisser visibles comme historique d'audit ? Question d'UX SAV — ne bloque pas le planning.

---

## Next Steps

`-> /ce-plan` for structured implementation planning
