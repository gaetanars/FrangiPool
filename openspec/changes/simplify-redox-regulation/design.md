## Context

La régulation actuelle de l'électrolyseur (cf. [packages/redox_electrolyser.yaml](../../../packages/redox_electrolyser.yaml) et [packages/redox.yaml](../../../packages/redox.yaml)) est issue d'un fix progressif documenté dans [docs/solutions/architecture/redox-asymmetric-regulation-policy.md](../../../docs/solutions/architecture/redox-asymmetric-regulation-policy.md). L'objectif initial était d'éviter une réaction sur du bruit capteur transitoire (sur-chloration). Le fix a empilé :

1. **Hystérésis** : `setpoint` (haut) et `setpoint - 30 mV` (bas).
2. **Tendance Redox** : un global `g_redox_trend_state` (∈ {-1, 0, 1}) recalculé toutes les 5 min en comparant à un échantillon précédent (`g_last_redox_trend_value`).
3. **Compteur de stabilité** : `g_redox_stable_minutes` incrémenté chaque minute si la tendance ≤ 0, mis à zéro sinon. ON gaté à `stable_minutes >= 30`.
4. **Filet OFF rapide** : `on_value_range.above` qui appelle `turn_off` dès franchissement (sans attendre le tick).
5. **Filet OFF dans le select** : `select.on_value` Auto branch coupe immédiatement si `pool_redox > setpoint`, et reset `g_redox_stable_minutes` à 0.

En parallèle, [packages/redox.yaml](../../../packages/redox.yaml) implémente déjà un sampling : `pool_redox` (mesure consommée par le régulateur) n'est mis à jour que quand `pump.state ∧ pump_uptime ≥ pump_uptime_delay`. Ce sampling est le filtre principal du système — il garantit qu'on ne réagit pas à des mesures faites pendant la stagnation d'eau ou les premières minutes de pompe (eau morte dans la canalisation, capteur pas réveillé).

Le retour utilisateur : **le compteur de stabilité rend le comportement aléatoire et non-explicable**. Une chute légitime sous le seuil bas peut rester sans réaction pendant 30 min ; une remontée brève au-dessus du seuil haut reset le compteur et repousse encore l'activation. L'utilisateur ne voit pas de corrélation simple entre la mesure affichée et l'action de l'électrolyseur.

L'hystérésis seule, appliquée à `pool_redox` (déjà gated par pump uptime), est cohérente, prédictible, et chimiquement saine pour une piscine (la dose de chlore livrée en 1 min d'électrolyse à valeur basse est largement amortie par le volume du bassin).

## Goals / Non-Goals

**Goals:**
- Réduire le régulateur Auto à une seule règle : hystérésis pure sur `pool_redox` avec gate `pump_uptime_delay`.
- Supprimer toute trace de tendance/stabilité (globals, intervals, text_sensor, branches gating).
- Garder le filet OFF rapide (`on_value_range.above`) car il complète l'hystérésis sans la contredire (single-direction writer, pas de ON).
- Garder une transition de mode immédiate (Off/Forcé) ; en Auto, conserver uniquement le filet OFF immédiat si déjà au-dessus du setpoint.
- Documenter le nouveau comportement dans [CLAUDE.md](../../../CLAUDE.md) et mettre à jour ou archiver le learning d'origine.

**Non-Goals:**
- Ajouter un nouveau paramètre de configuration. `pump_uptime_delay` existe déjà (5–30 min, défaut 20). Pas de nouveau slider.
- Modifier la chaîne de mesure Redox (ADS1115, calibration 225/475, offset, sliding window). Inchangée.
- Modifier le schéma `pool_redox` sampled vs `realtime_redox`. Inchangé.
- Toucher au scheduler de filtration, à l'antifreeze, au pH, ou au booster.
- Réintroduire un filtre temporel "soft" (3 min, 10 min). L'utilisateur a explicitement dit que toute couche au-dessus de l'hystérésis lui paraît aléatoire.

## Decisions

### D1. Hystérésis pure dans l'`interval: 1min`, pas de débouncer

L'`interval: 1min` de [packages/redox_electrolyser.yaml](../../../packages/redox_electrolyser.yaml) devient :

```yaml
interval:
  - interval: 1min
    then:
      - lambda: |-
          if (id(electrolyser_mode).state != "Auto") return;
          if (!id(pump).state) return;
          if (id(pump_uptime).state < id(pump_uptime_delay).state) return;

          float current = id(pool_redox).state;
          float low  = id(redox_setpoint).state - 30.0f;
          float high = id(redox_setpoint).state;

          if (current > high && id(electrolyser).state) {
            id(electrolyser).turn_off();
          } else if (current < low && !id(electrolyser).state) {
            id(electrolyser).turn_on();
          }
```

**Pourquoi** : le sampling de `pool_redox` (1 valeur / minute, et seulement si pump uptime OK) est déjà le filtre temporel. Réagir au prochain tick est cohérent et prévisible.

**Alternatives considérées** :
- *Garder un compteur réduit (3 min stable)* — Rejeté : ajoute du flou sans bénéfice mesurable, va à l'encontre de la demande utilisateur "pas d'historique".
- *Mettre l'hystérésis sur `realtime_redox`* — Rejeté : `realtime_redox` est non-gated par pump uptime, on perdrait la garantie "pas de décision sur eau stagnante".

### D2. Conserver `on_value_range.above` comme filet OFF rapide

Le `sensor.pool_redox.on_value_range.above → turn_off` reste dans [packages/redox_electrolyser.yaml](../../../packages/redox_electrolyser.yaml) tel quel.

**Pourquoi** : il ne contredit pas l'hystérésis (même direction OFF, mêmes seuils). Il améliore juste la latence de réaction quand `pool_redox` bondit au-dessus de la consigne entre deux ticks. Coût : 5 lignes de YAML, zéro nouveau global. Bénéfice : cohérent avec le pattern "fast OFF" (sécurité sur-chloration) qui reste défendable indépendamment de la stabilité.

**Alternative considérée** : *Tout faire dans l'interval, supprimer l'edge trigger* — Plus minimaliste, mais remplace une réaction sub-seconde par jusqu'à 60 s d'attente sur over-shoot. Pour un cas où le coût de garder le trigger est nul (single writer, single direction), on garde.

### D3. `select.on_value` Auto branch : OFF immédiat si déjà au-dessus, rien d'autre

Le handler `select.on_value` en mode Auto devient :

```yaml
- lambda: |-
    if (id(electrolyser_mode).state == "Off") {
      id(electrolyser).turn_off();
    } else if (id(electrolyser_mode).state == "Forcé") {
      id(electrolyser).turn_on();
    } else {  // Auto
      if (id(pool_redox).state > id(redox_setpoint).state) {
        id(electrolyser).turn_off();
      }
      // sinon : laisser l'interval 1 min décider au prochain tick.
    }
```

**Pourquoi** : on garde le filet OFF immédiat (sinon une transition Off→Auto avec ORP haut attendrait jusqu'à 60 s avant de couper, période durant laquelle l'électrolyseur pourrait être enclenché par un précédent état restauré). On supprime le `g_redox_stable_minutes = 0` (le global disparaît). On supprime aussi le `turn_on` immédiat pour `pool_redox < setpoint` qui n'a jamais été présent dans la version actuelle de toute façon (le commit `4358410` l'avait déjà retiré).

**Alternative considérée** : *Laisser entièrement à l'interval* — Risque d'over-chloration de courte durée (~60 s max) lors d'une transition mal timée. Le coût d'ajouter 3 lignes ici est négligeable.

### D4. Suppression complète de la tendance Redox

Le bloc `interval: 5min` qui calcule `g_redox_trend_state` et le `text_sensor "Tendance Redox"` sont supprimés de [packages/redox.yaml](../../../packages/redox.yaml). Globals associés également (`g_redox_trend_state`, `g_last_redox_trend_value`).

**Pourquoi** : aucun consommateur après la suppression du gate de stabilité. Garder un text_sensor diagnostic "pour info" reviendrait à laisser du dead code se réaccrocher à du dead code (anti-pattern observé dans le repo, cf. `docs/solutions/architecture/redox-asymmetric-regulation-policy.md`).

**Alternative considérée** : *Garder le text_sensor diagnostic en lecture seule* — Rejeté : pas de valeur ajoutée pour l'utilisateur (HA peut tracer la tendance lui-même depuis l'historique de `pool_redox`), et ré-ouvre la porte à une régression "ah ce signal existe, gatons-le sur ON".

### D5. Mise à jour ou archivage du learning `redox-asymmetric-regulation-policy.md`

Le learning reste valable historiquement (la leçon "fast OFF / slow ON quand on a un débouncer" est correcte) mais ne reflète plus le code. Décision : **mettre à jour** le doc avec une section "Update 2026-04-26" qui dit "le débouncer 30 min a été retiré : le sampling pump-uptime suffit en pratique. La règle 'fast OFF via on_value_range' reste, mais le 'slow ON via stability gate' est devenu 'simple ON via hystérésis dans l'interval 1 min'". Pas d'archivage destructif — la généalogie du fix reste lisible.

[CLAUDE.md](../../../CLAUDE.md) sections "Electrolyser regulation: asymmetric policy" et la ligne du tableau `redox.yaml` sont réécrites pour décrire le nouveau modèle (et ne plus mentionner `g_redox_stable_minutes` / `g_redox_trend_state`).

### D6. Pas de migration de globals au flash

Les globals supprimés disparaissent à la prochaine compilation. `g_redox_stable_minutes` et `g_last_redox_trend_value` étaient `restore_value: true`, mais leur valeur restaurée n'a aucun effet observable après leur suppression — ESPHome alloue un layout NVS différent, l'ancienne valeur est ignorée. Pas de risque de comportement résiduel.

`g_redox_trend_state` était `restore_value: no`, donc ré-init à 0 à chaque boot dans l'ancien code aussi.

## Risks / Trade-offs

- **[Risque]** L'utilisateur perd le text_sensor "Tendance Redox" exposé à HA. Quelqu'un pourrait l'utiliser dans une automatisation HA externe.
  → **Mitigation** : pas d'usage interne (ni dashboard ni notification). On documente la suppression dans le proposal et le commit. Si l'utilisateur en a besoin, HA peut recalculer la tendance à partir de l'historique de `sensor.frangipool_redox`.

- **[Risque]** Sans le filtre 30 min, un transitoire de bruit qui coïnciderait pile avec un tick d'1 min pourrait activer brièvement l'électrolyseur. Les 30 min couvraient ce cas même avec le sampling pump-uptime.
  → **Mitigation** : le sampling `pool_redox` se fait à intervalle 1 min également (même `interval: 1min` dans `packages/redox.yaml` qui copie `realtime_redox` vers `g_store_pool_redox`), et `realtime_redox` lui-même est un `sliding_window_moving_average` de 12 échantillons (window de 2 min sur des updates de 10 s). Donc une seule mesure aberrante ne fait pas franchir le seuil. Le risque résiduel est un transitoire qui dure plus de 2 min — c'est-à-dire un signal qu'on doit traiter.

- **[Risque]** Régression de comportement perçue : un utilisateur qui voyait l'électrolyseur s'activer "30 min après que la consigne soit OK" peut trouver le nouveau comportement "trop réactif".
  → **Mitigation** : c'est exactement ce que l'utilisateur a demandé. Documenter dans la PR description.

- **[Trade-off]** L'asymétrie OFF-fast / ON-slow disparaît. La protection sur-chloration repose maintenant uniquement sur `on_value_range.above` + hystérésis 1 min. C'est moins agressif que le gate 30 min précédent, mais cohérent avec la dose réelle livrée par cycle.
  → **Mitigation** : le filet `on_value_range.above` reste, donc le scénario "ORP qui dépasse subitement" est toujours protégé en sub-seconde. Seul le scénario "redémarrage à froid avec ORP qui oscille autour du seuil" voit son comportement changer.

## Migration Plan

1. Implémenter en suivant `tasks.md` (ordre : globals → interval → select → text_sensor → docs → dashboard).
2. Validation locale via le rewrite `sed` documenté dans [CLAUDE.md](../../../CLAUDE.md) (section "Validating local package edits") — `esphome config salt_full.yaml` doit passer.
3. Compile : `esphome compile salt_full.yaml`.
4. OTA flash sur l'ESP : `esphome run salt_full.yaml`.
5. Vérifier en logs (`esphome logs`) :
   - Au boot, plus aucune log `g_redox_stable_minutes` / `g_redox_trend_state`.
   - Au tick suivant `pump_uptime_delay` minutes, le régulateur prend une décision cohérente avec la mesure courante.
6. Surveiller HA pendant 24 h : `sensor.frangipool_redox` doit toujours s'updater (tous les 1 min quand pump up), `switch.frangipool_electrolyseur` doit basculer ON/OFF cohéremment avec les seuils.
7. **Rollback** : revert du commit, re-flash. Les globals supprimés se reréallouent au prochain boot (pas de corruption NVS — ESPHome gère les changements de layout). Pas de migration de données utilisateur à orchestrer.

## Open Questions

- **OQ1** : Faut-il en profiter pour renommer `pump_uptime_delay` (générique) en quelque chose de plus explicite côté HA (`pump_uptime_before_measurements`) ? → Hors scope. À traiter dans une PR de UX dédiée si l'utilisateur le demande, car ça touche aussi pH et `pool_temp`.
- **OQ2** : Le `homeassistant/dashboard/frangipool.yaml` contient-il encore une carte "Tendance Redox" ? Le grep initial n'a rien trouvé, mais vérifier exhaustivement durant l'implémentation. Si présente, supprimer la carte (ne pas réintroduire le sensor firmware — convention `default to dropping dashboard refs`).
