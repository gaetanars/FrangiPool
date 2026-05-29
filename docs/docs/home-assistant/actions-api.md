---
sidebar_position: 3
title: Actions API
description: Liste des actions ESPHome disponibles depuis Home Assistant pour piloter FrangiPool par automatisation.
---

# Actions API

FrangiPool expose plusieurs **actions ESPHome** accessibles depuis Home Assistant. Elles permettent de piloter le device depuis des automatisations, des scripts ou les Developer Tools.

**Accès :** HA → Developer Tools → Actions → recherchez `esphome.frangipool_*`

---

## `swap_dallas_probes`

Échange les assignations des deux sondes Dallas. Persistant après redémarrage.

**Quand l'utiliser :** si les sondes ont été branchées dans le mauvais ordre physiquement.

```yaml
action: esphome.frangipool_swap_dallas_probes
```

_Aucun paramètre. Disponible sur tous les presets._

---

## `force_filtration`

Force la pompe en marche pendant une durée en heures. Prioritaire sur tous les modes sauf l'antigel. Mettre `hours: 0` pour annuler le mode forcé.

```yaml
action: esphome.frangipool_force_filtration
data:
  hours: 4   # 0 à 24 heures — 0 annule le mode forcé
```

**Paramètre :** `hours` (entier, 0–24)

_Disponible sur tous les presets._

---

## `recalc_filtration`

Force un recalcul immédiat des horaires de filtration. Utile après avoir modifié plusieurs paramètres en rafale ou pour forcer la prise en compte d'une modification sans attendre le prochain cycle de 30 s.

```yaml
action: esphome.frangipool_recalc_filtration
```

_Aucun paramètre. Disponible sur tous les presets._

---

## `set_redox_manual_offset`

Définit un offset de correction manuel sur la mesure Redox. Prend la priorité sur l'offset de calibration tampon (225/475 mV). Mettre `offset: 0` pour désactiver et revenir à l'offset de calibration.

```yaml
action: esphome.frangipool_set_redox_manual_offset
data:
  offset: 45   # en mV — négatif pour abaisser, positif pour monter, 0 pour désactiver
```

**Paramètre :** `offset` (float, −300 à +300 mV)

_Disponible sur les presets incluant le module Redox : `er`, `erp`, `ber`, `berp`._

---

## Exemples d'automatisations

### Forcer la filtration après ajout de produit

```yaml
alias: "Filtration 6h après traitement algicide"
trigger:
  - platform: template
    value_template: "{{ now().hour == 8 and now().weekday() == 5 }}"  # Samedi 8h
action:
  - action: esphome.frangipool_force_filtration
    data:
      hours: 6
```

### Notification si Redox trop bas depuis 2h

```yaml
alias: "Alerte Redox faible"
trigger:
  - platform: numeric_state
    entity_id: sensor.frangipool_redox
    below: 650
    for: "02:00:00"
action:
  - action: notify.mobile_app_<votre_téléphone>
    data:
      title: "⚠️ FrangiPool — Redox bas"
      message: "Redox à {{ states('sensor.frangipool_redox') }} mV depuis 2h — vérifier l'électrolyseur."
```
