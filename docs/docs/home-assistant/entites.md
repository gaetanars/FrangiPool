---
sidebar_position: 2
title: Référence des entités
description: Liste complète des entités Home Assistant exposées par FrangiPool, organisées par module et disponibilité selon le preset.
---

# Référence des entités

Les entity IDs ci-dessous utilisent le préfixe `frangipool_` (device renommé `frangipool` dans HA). Pour les presets avec suffixe MAC non renommés, remplacez `frangipool_` par `frangipool_xxxx_`.

## Module Base (tous les presets)

### Capteurs

| Entity ID | Description |
|-----------|-------------|
| `sensor.frangipool_temperature_local` | Température ambiante locale (sonde 1-Wire index 0) |
| `sensor.frangipool_temperature_canalisation` | Température du tuyau retour (sonde 1-Wire index 1) |
| `sensor.frangipool_temperature_piscine` | Température piscine échantillonnée (mise à jour si pompe ≥ délai mesure) |
| `sensor.frangipool_pump_uptime` | Minutes de fonctionnement continu de la pompe depuis le dernier démarrage |
| `sensor.uptime` | Uptime de l'ESP en secondes |
| `sensor.frangipool_rssi` | Signal WiFi en dBm |

### Capteurs texte (diagnostic)

| Entity ID | Description |
|-----------|-------------|
| `text_sensor.frangipool_sonde_temperature_local` | Assignation active : `Sonde 0` ou `Sonde 1` |
| `text_sensor.frangipool_sonde_temperature_canalisation` | Assignation active : `Sonde 0` ou `Sonde 1` |

### Binaires

| Entity ID | Description |
|-----------|-------------|
| `binary_sensor.frangipool_antigel` | Actif si la protection antigel est déclenchée |

### Switches

| Entity ID | Description |
|-----------|-------------|
| `switch.frangipool_filtration` | État de la pompe — géré par le planificateur |

### Nombres

| Entity ID | Description | Plage | Défaut |
|-----------|-------------|-------|--------|
| `number.frangipool_consigne_antigel` | Seuil antigel | −2 à 2 °C | 0 °C |
| `number.frangipool_delais_mesures` | Délai avant échantillonnage | 5–30 min | 20 min |

### Boutons

| Entity ID | Description |
|-----------|-------------|
| `button.frangipool_reboot` | Redémarre l'ESP |

## Module Filtration (tous les presets)

### Sélecteurs

| Entity ID | Options | Défaut |
|-----------|---------|--------|
| `select.frangipool_mode_filtration` | Off / Hiver / Courbe / Auto | Auto |

### Nombres

| Entity ID | Description | Plage | Défaut |
|-----------|-------------|-------|--------|
| `number.frangipool_coefficient_filtration` | Multiplicateur durée | 50–150 % | 100 % |
| `number.frangipool_duree_pause_filtration_courbe` | Pause entre cycles (mode Courbe) | 0–12 h | 8 h |
| `number.frangipool_duree_pause_filtration_hiver` | Pause entre cycles (mode Hiver) | 0–12 h | 0 h |
| `number.frangipool_ratio_matin_filtration` | Part du cycle matin | 20–50 % | 33 % |
| `number.frangipool_duree_hiver_min` | Durée min mode Hiver (T < 10 °C) | 0–12 h | 3 h |
| `number.frangipool_diviseur_hiver` | Diviseur mode Hiver (T ≥ 10 °C) | 1–5 | 3 |

### DateTimes

| Entity ID | Description | Défaut |
|-----------|-------------|--------|
| `datetime.frangipool_heure_pivot_filtration_courbe` | Centre pause mode Courbe | 13:30 |
| `datetime.frangipool_heure_pivot_filtration_hiver` | Centre pause mode Hiver | 03:00 |

### Capteurs

| Entity ID | Description |
|-----------|-------------|
| `sensor.frangipool_duree_filtration_journaliere` | Durée planifiée aujourd'hui (minutes) |
| `sensor.frangipool_duree_filtration_effective` | Durée effective de pompage depuis minuit (minutes) |

### Capteurs texte

| Entity ID | Description |
|-----------|-------------|
| `text_sensor.frangipool_horaires_filtration` | Horaires du jour : `HH:MM-HH:MM / HH:MM-HH:MM` |
| `text_sensor.frangipool_phase_filtration` | Phase courante : Cycle matin / Cycle soir / Pause |
| `text_sensor.frangipool_mode_auto_actif` | Sous-mode actif en Auto : Courbe / Hiver / N/A |
| `text_sensor.frangipool_mode_force_temps_restant` | Temps restant mode forcé : `2h 30min` / `Inactif` |

### Boutons

| Entity ID | Description |
|-----------|-------------|
| `button.frangipool_forcer_filtration_2h` | Force la pompe pendant 2 heures |
| `button.frangipool_forcer_filtration_6h` | Force la pompe pendant 6 heures |
| `button.frangipool_forcer_filtration_24h` | Force la pompe pendant 24 heures |
| `button.frangipool_arreter_mode_force` | Annule le mode forcé |

## Module Électrolyseur (presets E*)

| Entity ID | Type | Description |
|-----------|------|-------------|
| `switch.frangipool_electrolyseur` | Switch | État du relais électrolyseur |
| `sensor.frangipool_duree_electrolyse` | Capteur | Total minutes d'électrolyse |

## Module Redox (presets *R*)

| Entity ID | Type | Description |
|-----------|------|-------------|
| `sensor.frangipool_redox` | Capteur | Valeur Redox échantillonnée (mV) |
| `sensor.frangipool_redox_temps_reel` | Capteur | Valeur Redox temps réel (mV) |
| `sensor.frangipool_redox_offset` | Capteur (diagnostic) | Offset effectivement appliqué |
| `button.frangipool_redox_calibration_225mv` | Bouton | Calibration solution 225 mV |
| `button.frangipool_redox_calibration_475mv` | Bouton | Calibration solution 475 mV |
| `button.frangipool_redox_calibration_reset` | Bouton | Réinitialise les offsets |

## Module Auto-régulation Redox (presets *R* avec E)

| Entity ID | Type | Description | Plage | Défaut |
|-----------|------|-------------|-------|--------|
| `select.frangipool_mode_electrolyseur` | Sélecteur | Off / Auto / Forcé | — | Off |
| `number.frangipool_consigne_redox` | Nombre | Seuil Redox cible | 680–760 mV | 730 mV |

## Module pH (presets *P*)

| Entity ID | Type | Description |
|-----------|------|-------------|
| `sensor.frangipool_ph` | Capteur | Valeur pH échantillonnée |
| `sensor.frangipool_ph_temps_reel` | Capteur | Valeur pH temps réel |
| `sensor.frangipool_ph_slope` | Capteur (diagnostic) | Pente de calibration |
| `sensor.frangipool_ph_intercept` | Capteur (diagnostic) | Intercept de calibration |
| `sensor.frangipool_v_ph7` | Capteur (diagnostic) | Tension capturée au tampon pH 7 |
| `sensor.frangipool_v_ph4` | Capteur (diagnostic) | Tension capturée au tampon pH 4 |
| `button.frangipool_demarrer_calibration_ph` | Bouton | Lance la séquence de calibration |
| `button.frangipool_reset_calibration_ph_usine` | Bouton | Restaure les valeurs d'usine |
| `text_sensor.frangipool_ph_calibration_last_result` | Texte (diagnostic) | Résultat persisté de la dernière calibration |

## Module Surpresseur (presets B*)

| Entity ID | Type | Description |
|-----------|------|-------------|
| `switch.frangipool_surpresseur` | Switch | État du relais booster |
| `select.frangipool_mode_surpresseur` | Sélecteur | Off / Auto / Forcé |
