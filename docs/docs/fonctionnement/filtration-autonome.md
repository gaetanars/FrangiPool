---
sidebar_position: 1
title: Filtration autonome
description: L'ESP calcule les horaires de filtration en fonction de la température et gère la pompe sans Home Assistant.
---

# Filtration autonome

L'ESP calcule lui-même les horaires de filtration en fonction de la température de la piscine. **La pompe démarre et s'arrête sans aucune action de Home Assistant.** HA reste utile pour la supervision et les notifications, mais son absence ou son redémarrage n'interrompt pas la filtration.

La pompe est pilotée par un automate cadencé toutes les **30 secondes** qui compare l'heure courante aux plages calculées. Les plages horaires elles-mêmes sont recalculées dans les cas suivants :

- **Au démarrage** — après la première synchronisation NTP
- **À minuit** — pour prendre en compte la température du nouveau jour
- **En fin de cycle** — après le cycle matin ou le cycle soir
- **À chaque modification d'un paramètre** — immédiatement, sans attendre le tick de 30 s
- **Via l'action API `recalc_filtration`** — à la demande

## Modes de filtration

| Mode | Comportement |
|------|-------------|
| **Off** | Pompe arrêtée. La protection antigel reste active indépendamment. |
| **Hiver** | Durée fixe si T < 10 °C (défaut 3 h), sinon `T ÷ diviseur` (défaut 3). |
| **Courbe** | Durée calculée selon une courbe adaptée à la température, multipliée par le coefficient. |
| **Auto** | Bascule automatiquement entre Courbe et Hiver selon la température (seuil 16 °C avec hystérésis de 2 °C). |

Le mode par défaut est **Auto**.

### Mode Courbe — calcul de la durée

La durée journalière suit une courbe polynomiale du 3ᵉ degré ajustée sur les recommandations de filtration. Elle croît fortement au-dessus de 22 °C pour couvrir les pics de chaleur estivaux.

| Température | Durée (coeff 100 %) |
|---|---|
| 10 °C | 2 h |
| 15 °C | 3 h 30 |
| 20 °C | 5 h |
| 25 °C | 9 h |
| 28 °C | ~14 h |
| ≥ 32 °C | continu (≥ 24 h) |

Au-delà de 32 °C la durée calculée dépasse 24 h : l'ESP plafonne à une filtration quasi-continue, ce qui est intentionnel pour les épisodes caniculaires.

La durée obtenue est multipliée par le **Coefficient Filtration** (50–150 %, défaut 100 %). Par exemple à 25 °C avec un coefficient à 80 %, la durée effective sera de 9 h × 0,8 = **7 h 12**.

### Mode Hiver — calcul de la durée

- Si `T < 10 °C` : durée fixe = **Durée Hiver Min** (défaut 3 h)
- Si `T ≥ 10 °C` : durée = `T ÷ Diviseur Hiver` (défaut 3)

Exemples : 15 °C → 5 h, 12 °C → 4 h.

### Mode Auto — basculement automatique

En mode Auto, l'ESP bascule entre les sous-modes Courbe et Hiver selon la température de la piscine :
- **Courbe actif** si `T > 16 °C`
- **Hiver actif** si `T < 14 °C`
- Entre 14 °C et 16 °C : l'ESP conserve le sous-mode en cours (hystérésis)

Le sous-mode actif est visible dans l'entité `text_sensor.frangipool_mode_auto_actif`.

## Deux cycles par jour

La durée journalière est répartie en **deux plages de filtration** : une le matin, une le soir. Entre les deux, une **pause** dont la durée et le point central (l'**heure pivot**) sont configurables.

### Exemple en mode Courbe (été)

```
Pivot 13h30 · Pause 8 h · Ratio matin 33 % · Durée totale 9 h

→ Cycle matin  : 07h30 – 10h30 (3 h)
→ Pause        : 10h30 – 17h30
→ Cycle soir   : 17h30 – 23h30 (6 h)
```

### Exemple en mode Hiver

```
Pivot 03h00 · Pause 0 h · Ratio matin 33 % · Durée totale 3 h

→ Cycle matin  : 02h00 – 03h00 (1 h, contigu)
→ Cycle soir   : 03h00 – 05h00 (2 h, contigu)
```

Avec une **pause de 0 h**, les deux cycles sont contigus — la filtration est continue sur la durée totale.

### Paramètres pivot et pause par sous-mode

Les paramètres `Heure Pivot` et `Durée Pause` sont **séparés pour Courbe et Hiver** : cela permet d'avoir des horaires différents en saison et en hivernage sans changer manuellement au passage.

| Paramètre | Courbe (été) | Hiver (hivernage) |
|---|---|---|
| Heure Pivot | 13h30 (pause en journée) | 03h00 (filtration nocturne) |
| Durée Pause | 8 h | 0 h (continu) |

## Horaires calculés

Les horaires du jour sont disponibles dans l'entité `text_sensor.frangipool_horaires_filtration` au format `HH:MM-HH:MM / HH:MM-HH:MM`.

La durée journalière calculée est exposée dans `sensor.frangipool_duree_filtration_journaliere` (en minutes).

La durée effective depuis minuit (temps de pompage réel) est dans `sensor.frangipool_duree_filtration_effective`.

## Priorité des actions

L'ordre de priorité de la pompe, du plus prioritaire au moins prioritaire :

1. **Antigel** — déclenche immédiatement la pompe quelle que soit la configuration
2. **Mode forcé** — pompe en marche pendant une durée fixe (voir [Mode forcé](./mode-force))
3. **Mode Off** — pompe arrêtée (l'antigel reste actif)
4. **Synchronisation NTP** — sans heure valide, la pompe reste à l'arrêt
5. **Planification normale** — cycles matin et soir calculés

## Sans synchronisation NTP

Si Home Assistant est indisponible au démarrage et que l'heure n'est pas encore synchronisée, la pompe reste à l'arrêt jusqu'à la synchronisation. Une notification HA est envoyée une seule fois pour signaler l'attente. La protection antigel fonctionne toujours normalement sans heure valide.
