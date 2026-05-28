## ADDED Requirements

### Requirement: Electrolyser mode selection
Le système SHALL exposer un `select` avec exactement trois modes : `Off`, `Auto`, `Forcé`. Le mode SHALL être persisté entre redémarrages (`restore_value: true`) et SHALL être par défaut `Off`. Une transition de mode SHALL être traitée immédiatement sans attendre le tick d'1 minute du régulateur.

#### Scenario: Off désactive le relais immédiatement
- **WHEN** l'utilisateur sélectionne `Off` (depuis n'importe quel autre mode)
- **THEN** le système coupe `electrolyser` (`turn_off`) dans le handler `on_value` du select, sans attendre le prochain tick.

#### Scenario: Forcé active le relais immédiatement
- **WHEN** l'utilisateur sélectionne `Forcé`
- **THEN** le système active `electrolyser` (`turn_on`) dans le handler `on_value`, indépendamment de la valeur Redox, du temps de pompe, ou du seuil.

#### Scenario: Auto applique un filet de sécurité OFF immédiat si ORP au-dessus du setpoint
- **WHEN** l'utilisateur sélectionne `Auto` ET `pool_redox > redox_setpoint`
- **THEN** le système coupe `electrolyser` immédiatement dans le handler `on_value`, sans attendre le tick d'1 minute.

#### Scenario: Auto laisse le régulateur décider sinon
- **WHEN** l'utilisateur sélectionne `Auto` ET `pool_redox <= redox_setpoint`
- **THEN** le système ne change pas l'état de `electrolyser` dans le handler `on_value` ; la décision ON/OFF revient au régulateur 1 minute.

### Requirement: Hysteresis-based regulation in Auto mode
En mode `Auto`, le système SHALL réguler `electrolyser` selon une hystérésis pure basée sur `pool_redox` (mesure échantillonnée), avec deux seuils : `setpoint` (haut) et `setpoint - 30 mV` (bas). Le système SHALL évaluer cette hystérésis sur un `interval` de 1 minute. Le système SHALL NOT introduire de gate temporel additionnel (comptage de minutes stables, tendance Redox, ou similaire) au-delà du gate `pump_uptime_delay` défini ci-dessous.

#### Scenario: ORP au-dessus du setpoint coupe l'électrolyseur
- **WHEN** mode = `Auto` ET pump tourne depuis ≥ `pump_uptime_delay` minutes ET `pool_redox > redox_setpoint` ET `electrolyser` est ON
- **THEN** au prochain tick d'1 minute, le système appelle `electrolyser.turn_off`.

#### Scenario: ORP sous le seuil bas active l'électrolyseur
- **WHEN** mode = `Auto` ET pump tourne depuis ≥ `pump_uptime_delay` minutes ET `pool_redox < redox_setpoint - 30` ET `electrolyser` est OFF
- **THEN** au prochain tick d'1 minute, le système appelle `electrolyser.turn_on`.

#### Scenario: ORP dans la bande d'hystérésis conserve l'état
- **WHEN** mode = `Auto` ET pump tourne depuis ≥ `pump_uptime_delay` minutes ET `redox_setpoint - 30 <= pool_redox <= redox_setpoint`
- **THEN** au prochain tick d'1 minute, le système ne modifie pas l'état de `electrolyser`.

### Requirement: Pump-uptime gate
Le régulateur 1 minute SHALL ne consommer la valeur `pool_redox` qu'après que la pompe a été continuellement allumée pendant au moins `pump_uptime_delay` minutes. Le paramètre `pump_uptime_delay` (déjà exposé par `packages/base.yaml`) SHALL être configurable par l'utilisateur via une entité `number` en plage `[5, 30]` minutes, persistée entre redémarrages, valeur par défaut `20`.

#### Scenario: Pompe arrêtée bloque toute décision Auto
- **WHEN** mode = `Auto` ET la pompe est OFF
- **THEN** le régulateur 1 minute ne change pas l'état de `electrolyser` (return immédiat).

#### Scenario: Uptime insuffisant bloque toute décision Auto
- **WHEN** mode = `Auto` ET la pompe est ON depuis moins de `pump_uptime_delay` minutes
- **THEN** le régulateur 1 minute ne change pas l'état de `electrolyser`.

#### Scenario: Reconfiguration du delay prend effet sans redémarrage
- **WHEN** l'utilisateur change `pump_uptime_delay` de 20 à 10 minutes pendant que la pompe tourne
- **THEN** le régulateur 1 minute applique la nouvelle valeur dès le tick suivant.

### Requirement: Setpoint configuration
Le système SHALL exposer une entité `number` `redox_setpoint` (config) pour la consigne ORP, en mV, plage `[680, 760]`, pas 10 mV, valeur par défaut 730, persistée entre redémarrages. Le seuil bas SHALL être dérivé en runtime comme `redox_setpoint - 30` (pas d'entité séparée).

#### Scenario: Changement de setpoint repropage les seuils
- **WHEN** l'utilisateur change `redox_setpoint` de 730 à 700 pendant que la pompe tourne
- **THEN** le prochain tick d'1 minute évalue l'hystérésis avec les seuils 700 et 670.

### Requirement: Fast-OFF safety net on overshoot
Le système SHALL conserver un trigger d'arrêt rapide indépendant du tick d'1 minute : un `on_value_range.above` sur le `sensor.pool_redox` qui, en mode `Auto`, appelle `electrolyser.turn_off` dès franchissement du `redox_setpoint`. Ce trigger SHALL être le seul writer rapide vers `electrolyser`, et il NE DOIT PAS faire de `turn_on`.

#### Scenario: Franchissement supérieur en Auto coupe immédiatement
- **WHEN** mode = `Auto` ET `pool_redox` franchit `redox_setpoint` à la hausse
- **THEN** `electrolyser.turn_off` est appelé dans la seconde suivant la mise à jour du sensor, sans attendre le tick d'1 minute.

#### Scenario: Franchissement supérieur hors Auto est ignoré
- **WHEN** mode ∈ {`Off`, `Forcé`} ET `pool_redox` franchit `redox_setpoint` à la hausse
- **THEN** le trigger `on_value_range` ne change pas l'état de `electrolyser` (mode `Off`/`Forcé` reste autoritaire).

### Requirement: No legacy stability or trend state
Le système SHALL NE PAS exposer ni maintenir de globals ou entités liés à un compteur de stabilité (`g_redox_stable_minutes`) ou à une tendance Redox (`g_redox_trend_state`, `g_last_redox_trend_value`, `text_sensor "Tendance Redox"`). Aucune branche du code SHALL gater l'activation de l'électrolyseur sur des minutes de stabilité accumulées ou un signe de pente.

#### Scenario: Validation YAML ne contient plus les globals supprimés
- **WHEN** on grep `g_redox_stable_minutes\|g_redox_trend_state\|g_last_redox_trend_value\|Tendance Redox` dans `packages/`
- **THEN** la commande retourne zéro résultat.

#### Scenario: Aucun gate de stabilité dans le régulateur
- **WHEN** mode = `Auto` ET pump uptime ≥ `pump_uptime_delay` ET `pool_redox` vient de chuter sous `setpoint - 30` au tick T
- **THEN** l'électrolyseur est activé au tick T+1 minute (au plus tard), sans attendre 30 minutes de "stabilité".
