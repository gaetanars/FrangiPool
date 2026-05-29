---
sidebar_position: 1
title: Paramètres de filtration
description: Référence complète des paramètres configurables de la filtration — modes, horaires, durées et coefficients.
---

# Paramètres de filtration

Tous les paramètres sont **persistants** : ils survivent aux coupures de courant et aux redémarrages de l'ESP. Ils sont modifiables depuis l'interface web de l'ESP ou depuis Home Assistant.

## Tableau complet

| Paramètre | Entité HA | Défaut | Plage | Description |
|-----------|-----------|--------|-------|-------------|
| **Mode Filtration** | `select.frangipool_mode_filtration` | Auto | Off / Hiver / Courbe / Auto | Mode de fonctionnement principal |
| **Heure Pivot Courbe** | `datetime.frangipool_heure_pivot_filtration_courbe` | 13:30 | Toute heure | Centre de la pause estivale |
| **Heure Pivot Hiver** | `datetime.frangipool_heure_pivot_filtration_hiver` | 03:00 | Toute heure | Centre de la pause hivernale |
| **Durée Pause Courbe** | `number.frangipool_duree_pause_filtration_courbe` | 8 h | 0–12 h | Pause entre les deux cycles estivaux (0 = continu) |
| **Durée Pause Hiver** | `number.frangipool_duree_pause_filtration_hiver` | 0 h | 0–12 h | Pause entre les deux cycles hivernaux (0 = continu) |
| **Ratio Matin** | `number.frangipool_ratio_matin_filtration` | 33 % | 20–50 % | Part de la durée totale allouée au cycle matin |
| **Coefficient Filtration** | `number.frangipool_coefficient_filtration` | 100 % | 50–150 % | Multiplicateur global de la durée calculée |
| **Durée Hiver Min** | `number.frangipool_duree_hiver_min` | 3 h | 0–12 h | Durée fixe en mode Hiver quand T < 10 °C |
| **Diviseur Hiver** | `number.frangipool_diviseur_hiver` | 3 | 1–5 | Diviseur pour Hiver quand T ≥ 10 °C (`durée = T ÷ diviseur`) |
| **Consigne Antigel** | `number.frangipool_consigne_antigel` | 0 °C | −2 à 2 °C | Seuil de déclenchement antigel |
| **Délai Mesures** | `number.frangipool_delais_mesures` | 20 min | 5–30 min | Temps de pompe minimum avant de mettre à jour la température piscine et le Redox |

## Notes sur les paramètres clés

### Coefficient Filtration

Le coefficient est un multiplicateur global appliqué à la durée calculée **sans changer de mode**. Exemples :
- 150 % : augmente la durée d'une moitié (forte chaleur, eau trouble)
- 80 % : réduit légèrement la durée (eau impeccable, saison intermédiaire)
- 50 % : durée minimale (entretien réduit, longue absence)

### Ratio Matin

Définit la répartition entre cycle matin et cycle soir. Avec Ratio 33 % et durée totale 9 h :
- Cycle matin = 3 h (33 %)
- Cycle soir = 6 h (67 %)

### Pivot et Pause

L'**heure pivot** est le **milieu de la pause**. La pause est centrée dessus :
- Pivot 13h30, Pause 8 h → Pause de 09h30 à 17h30

Avec Pause = 0 h, les deux cycles sont contigus centrés sur le pivot (filtration continue).

### Délai Mesures

Ce paramètre protège la qualité des mesures de température et de Redox. Pendant les premières minutes après le démarrage de la pompe, l'eau stagnante dans les tuyaux n'est pas représentative du bassin. Le délai par défaut de 20 min garantit une mesure fiable.

## Recalcul immédiat

La modification d'un paramètre recalcule les horaires immédiatement. Il n'est pas nécessaire d'attendre le prochain cycle de 30 s.

L'action API `recalc_filtration()` force également un recalcul immédiat :

```yaml
action: esphome.frangipool_recalc_filtration
```
