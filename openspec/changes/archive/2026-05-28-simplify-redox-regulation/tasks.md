## 1. Suppression de la tendance Redox dans `packages/redox.yaml`

- [x] 1.1 Supprimer le bloc `interval: 5min` qui calcule `g_redox_trend_state` / `g_last_redox_trend_value` (lignes ~157-169 actuelles).
- [x] 1.2 Supprimer le `text_sensor` `Tendance Redox` (lignes ~78-88 actuelles).
- [x] 1.3 Supprimer les globals `g_last_redox_trend_value` et `g_redox_trend_state` du bloc `globals:` (lignes ~8-15 actuelles). Garder `g_store_pool_redox` et `g_redox_offset`.

## 2. Simplification du régulateur dans `packages/redox_electrolyser.yaml`

- [x] 2.1 Supprimer le global `g_redox_stable_minutes` (lignes ~11-15 actuelles).
- [x] 2.2 Réécrire le `select.electrolyser_mode.on_value` Auto branch pour ne plus toucher à `g_redox_stable_minutes` ; conserver le filet OFF immédiat `if (pool_redox > setpoint) electrolyser.turn_off()`. (cf. design.md D3)
- [x] 2.3 Réécrire l'`interval: 1min` en hystérésis pure : early-return si mode != Auto, pump OFF, ou `pump_uptime < pump_uptime_delay` ; sinon `pool_redox > setpoint → turn_off`, `pool_redox < setpoint - 30 → turn_on`. Supprimer la branche d'incrémentation/reset du compteur, la `delay: 10s`, et tout usage de `g_redox_stable_minutes` / `g_redox_trend_state`. (cf. design.md D1)
- [x] 2.4 Conserver tel quel le `sensor.pool_redox.on_value_range.above → turn_off` (filet OFF rapide). (cf. design.md D2)
- [x] 2.5 Réécrire le commentaire de tête du fichier pour décrire la nouvelle politique : "Hystérésis pure sur `pool_redox` (mesure échantillonnée après `pump_uptime_delay` minutes), avec filet OFF rapide via `on_value_range.above` pour minimiser la latence d'overshoot."

## 3. Validation locale

- [x] 3.1 Exécuter le rewrite `sed` documenté dans CLAUDE.md (section "Validating local package edits") sur `salt_full.yaml`.
- [x] 3.2 `esphome config salt_full.yaml` doit passer sans warning ni erreur.
- [x] 3.3 Restaurer `salt_full.yaml` (`git checkout salt_full.yaml`).
- [x] 3.4 Répéter 3.1-3.3 sur `salt_booster_full.yaml` (préset booster qui inclut redox + electrolyser_regulation).
- [x] 3.5 `grep -rn "g_redox_stable_minutes\|g_redox_trend_state\|g_last_redox_trend_value\|Tendance Redox" packages/` retourne zéro résultat.

## 4. Vérification du dashboard Home Assistant

- [x] 4.1 Lire `homeassistant/dashboard/frangipool.yaml` et chercher toute référence à `tendance_redox`, `Tendance Redox`, ou un sensor `*trend*`.
- [x] 4.2 Aucune référence trouvée dans le dashboard — rien à retirer.

## 5. Mise à jour de la documentation

- [x] 5.1 Mettre à jour [CLAUDE.md](../../../CLAUDE.md) ligne ~72 (tableau des packages) : remplacer "5-min trend `g_redox_trend_state`" par une description du sampling pump-uptime seul.
- [x] 5.2 Réécrire la section "Electrolyser regulation: asymmetric policy" (~ligne 95) : décrire la politique simplifiée (hystérésis pure + fast OFF + pump uptime gate). Garder la liste des cinq writer-types comme rappel de review (toujours pertinente), mais retirer la mention `g_redox_stable_minutes >= 30 AND g_redox_trend_state <= 0`.
- [x] 5.3 Mettre à jour [docs/solutions/architecture/redox-asymmetric-regulation-policy.md](../../../docs/solutions/architecture/redox-asymmetric-regulation-policy.md) avec une section finale "## Update 2026-04-26: stability gate removed" expliquant que le débouncer 30 min a été retiré (sampling pump-uptime suffit), et que la règle "fast OFF via on_value_range" reste valable. Ajouter une référence vers ce change OpenSpec (`openspec/changes/simplify-redox-regulation/`).
- [x] 5.4 Mettre à jour le `last_updated:` du frontmatter du learning à `2026-04-26`. Ajouter le tag `simplification` si pas déjà présent.

## 6. Tests sur l'ESP

- [ ] 6.1 `esphome compile salt_full.yaml` réussit (cache `.esphome/` peut être vidé pour s'assurer que les globals supprimés ne traînent pas).
- [ ] 6.2 OTA flash via `esphome run salt_full.yaml`.
- [ ] 6.3 Surveiller `esphome logs salt_full.yaml` pendant au moins 2 cycles pump on/off (∼20 min après stabilisation pump_uptime_delay) :
  - `sensor.frangipool_redox` se met à jour normalement.
  - `switch.frangipool_electrolyseur` bascule OFF si ORP > setpoint, ON si ORP < setpoint - 30, dans le tick suivant la condition.
  - Aucun log d'erreur lié à un global manquant.
- [ ] 6.4 Test manuel mode select : Auto → Off (relais coupe immédiatement) ; Off → Auto avec ORP haut (relais reste OFF immédiatement) ; Auto → Forcé (relais ON) ; Forcé → Auto (revient à régulation hystérésis au prochain tick).

## 7. Archivage du change

- [ ] 7.1 Une fois la PR mergée et le firmware tournant en prod ≥ 24h, exécuter `/opsx:archive simplify-redox-regulation` pour transformer la spec deltas en spec définitive sous `openspec/specs/electrolyser-regulation/`.
