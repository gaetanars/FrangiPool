---
sidebar_position: 5
title: Calibration pH
description: Procédure de calibration two-points pH 7 + pH 4, codes d'erreur et récupération en cas d'échec.
---

# Calibration pH

FrangiPool applique une calibration **two-points** sur la sonde pH : deux solutions tampon (pH 7 et pH 4) permettent de calculer la pente (`slope`) et le décalage (`intercept`) propres à votre sonde.

La formule appliquée est : `pH = slope × V + intercept`

Les paramètres de calibration sont **persistants** dans la NVS de l'ESP — ils survivent aux redémarrages et aux mises à jour OTA.

## Matériel nécessaire

- Solution tampon **pH 7.00** (sachet ou flacon)
- Solution tampon **pH 4.00**
- Eau claire pour le rinçage entre les bains

## Précautions avant de démarrer

- **Coupez la pompe** avant de lancer la calibration (évite le brassage pendant la capture).
- Sortez la sonde de la piscine et rincez-la brièvement à l'eau claire.
- Utilisez de préférence des tampons frais à température ambiante (~25 °C).

## Procédure (~6 min 20 s)

| Étape | Action |
|-------|--------|
| **1** | Plongez la sonde dans le tampon **pH 7.00**. Attendez quelques secondes que la sonde soit bien immergée. |
| **2** | Dans HA, appuyez sur le bouton **Démarrer calibration pH**. Une notification confirme le démarrage. |
| **3** | Attendez **190 s** (3 min 10 s) — le firmware laisse la sonde se stabiliser 180 s puis capture 3 lectures espacées de 5 s. |
| **4** | Notification : *"V_pH7 = X.XXXX V capturé. Rincer la sonde et plonger dans le tampon pH 4.00"*. Rincez à l'eau claire et plongez dans le tampon **pH 4.00**. |
| **5** | Attendez à nouveau **190 s**. |
| **6** | Notification finale : *"Calibration pH réussie. Pente = X.XXX, intercept = X.XXX"*. |

La durée totale est d'environ **6 minutes 20 secondes**.

## Codes de rejet

Si la calibration est rejetée, une notification HA explicite indique la cause. Les paramètres `slope` et `intercept` restent inchangés. Le code et le message sont également persistés dans `text_sensor.frangipool_ph_calibration_last_result`.

| Code | Cause | Vérifier |
|:----:|-------|---------|
| **2** | V_pH7 ≤ V_pH4 — bains inversés ou sonde câblée à l'envers | Ordre des bains, câblage Gravity v2.0 |
| **3** | Pente hors plage saine [2.5 – 5.0] pH/V | Sonde usée, bain contaminé, court-circuit |
| **4** | Capteur indisponible (NaN) pendant la capture pH 7 | Câble sonde / connexion ADS1115 |
| **5** | Capteur indisponible (NaN) pendant la capture pH 4 | Câble sonde / connexion ADS1115 |
| **6** | Capture instable (spread > 50 mV) sur pH 7 | Sonde non stabilisée, bain trop froid, vibrations |
| **7** | Capture instable (spread > 50 mV) sur pH 4 | Sonde non stabilisée, bain trop froid, vibrations |

## Réinitialisation usine

Le bouton **Reset calibration pH usine** restaure les valeurs d'usine :
- `slope = 3.56`
- `intercept = -1.889`

Ce bouton est refusé pendant qu'une calibration est en cours.

## Récupération si Home Assistant était déconnecté

Les notifications HA sont envoyées en best-effort. Si HA était indisponible pendant la séquence, le résultat est lisible après reconnexion dans `text_sensor.frangipool_ph_calibration_last_result` :
- `OK pente=X.XXX, intercept=X.XXX`
- `Rejet: [cause]`
- `Echec: [cause]`
- `Reset usine`

Les entités diagnostics `sensor.frangipool_ph_slope` et `sensor.frangipool_ph_intercept` indiquent les valeurs actuellement appliquées.

## Fréquence recommandée

- En **début de saison** et après tout **remplacement de la sonde**.
- Si la valeur `slope` reste à 3.56 (valeur d'usine), la sonde n'a jamais été calibrée sur votre installation.

## Entités associées

| Entité | Type | Description |
|--------|------|-------------|
| `button.frangipool_demarrer_calibration_ph` | Bouton | Lance la séquence two-points |
| `button.frangipool_reset_calibration_ph_usine` | Bouton | Restaure les valeurs d'usine |
| `text_sensor.frangipool_ph_calibration_last_result` | Texte (diagnostic) | Résultat persisté de la dernière calibration |
| `sensor.frangipool_ph_slope` | Capteur (diagnostic) | Pente actuelle |
| `sensor.frangipool_ph_intercept` | Capteur (diagnostic) | Intercept actuel |
| `sensor.frangipool_v_ph7` | Capteur (diagnostic) | Tension capturée au tampon pH 7 |
| `sensor.frangipool_v_ph4` | Capteur (diagnostic) | Tension capturée au tampon pH 4 |
