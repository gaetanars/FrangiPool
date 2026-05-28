## Why

La régulation actuelle de l'électrolyseur empile trois mécanismes (hystérésis, tendance Redox sur 5 min, compteur de stabilité 30 min) qui rendent le comportement difficile à prédire et à expliquer. La sortie du capteur Redox est déjà filtrée — `pool_redox` n'est échantillonné que quand la pompe tourne depuis plus de `pump_uptime_delay` minutes — donc le filtre supplémentaire de stabilité n'apporte plus de valeur observable, juste de l'aléa perçu (l'électrolyseur peut rester éteint 30 min après une transition légitime sous le seuil).

Cette régulation a été introduite comme garde-fou anti-bruit (cf. `docs/solutions/architecture/redox-asymmetric-regulation-policy.md`), mais en pratique le sampling pump-uptime suffit à filtrer les transitoires. Garder une seule règle (hystérésis pure) supprime la couche cognitive et aligne la documentation avec l'intuition utilisateur.

## What Changes

- **BREAKING (comportement)** : suppression du gate de stabilité 30 min — l'électrolyseur peut s'allumer dès le tick suivant si `pool_redox < setpoint - 30 mV` (la valeur étant déjà gated par `pump_uptime_delay`).
- Suppression de la tendance Redox 5 min : globals `g_redox_trend_state`, `g_last_redox_trend_value`, `text_sensor` "Tendance Redox", interval 5 min.
- Suppression du compteur de stabilité : global `g_redox_stable_minutes`, branche d'incrémentation dans l'interval 1 min, reset dans `select.electrolyser_mode.on_value`.
- Simplification de l'`interval: 1min` de [packages/redox_electrolyser.yaml](../../../packages/redox_electrolyser.yaml) en hystérésis pure : `pool_redox > setpoint → OFF` ; `pool_redox < setpoint - 30 → ON` ; entre les deux, conserver l'état courant.
- Conservation du paramètre **`pump_uptime_delay`** (déjà existant dans [packages/base.yaml](../../../packages/base.yaml)) comme seul gate temporel — le X minutes paramétrable demandé par l'utilisateur. Aucun changement à cette entité, juste réaffirmation de son rôle.
- Conservation du fast-OFF edge-trigger via `sensor.pool_redox.on_value_range.above` (filet de sécurité anti-surchloration ; ne contredit pas l'hystérésis).
- Mise à jour du commentaire de tête de [packages/redox_electrolyser.yaml](../../../packages/redox_electrolyser.yaml), de [CLAUDE.md](../../../CLAUDE.md), et archivage du learning `redox-asymmetric-regulation-policy.md` (le pattern reste valable historiquement, mais le code ne l'implémente plus).
- Suppression de la carte "Tendance Redox" de [homeassistant/dashboard/frangipool.yaml](../../../homeassistant/dashboard/frangipool.yaml) si présente (à vérifier).

## Capabilities

### New Capabilities
- `electrolyser-regulation`: politique de régulation de l'électrolyseur de chlore à partir de la mesure ORP/Redox, incluant les modes Off/Auto/Forcé, l'hystérésis ON/OFF, le gate de pump uptime, et le filet de sécurité anti-surchloration.

### Modified Capabilities
<!-- Aucune capability existante modifiée — première spec OpenSpec du repo. -->

## Impact

- **Code** : [packages/redox_electrolyser.yaml](../../../packages/redox_electrolyser.yaml) (interval simplifié, globals retirés, commentaire de tête réécrit), [packages/redox.yaml](../../../packages/redox.yaml) (suppression trend interval, text_sensor, globals).
- **Documentation** : [CLAUDE.md](../../../CLAUDE.md) (sections "redox.yaml" et "Electrolyser regulation: asymmetric policy" réécrites), [docs/solutions/architecture/redox-asymmetric-regulation-policy.md](../../../docs/solutions/architecture/redox-asymmetric-regulation-policy.md) (à mettre à jour ou archiver — le pattern dead-code reste valable, mais la solution actuelle a changé).
- **Dashboard HA** : carte "Tendance Redox" retirée si présente (par défaut on supprime, on ne ré-ajoute pas l'entité firmware).
- **État persistant** : globals supprimés (`g_redox_stable_minutes`, `g_redox_trend_state`, `g_last_redox_trend_value`) — leur disparition après flash est sans conséquence (le système recalcule l'état depuis zéro et la première décision attend juste le prochain tick d'1 min après pump uptime).
- **Compatibilité HA** : les entités diagnostic disparaissent (`sensor.frangipool_tendance_redox`) — les automatisations utilisateur qui les liraient remonteraient `unavailable`. Pas d'usage connu en interne.
- **Pas d'impact** : presets (composition inchangée), API/encryption, scheduler de filtration, antifreeze, pH, booster.
