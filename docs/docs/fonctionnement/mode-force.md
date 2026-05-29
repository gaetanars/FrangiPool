---
sidebar_position: 2
title: Mode forcé
description: Forcez la pompe pendant une durée fixe pour les traitements ponctuels (choc chloré, algicide, floculant).
---

# Mode forcé

Le mode forcé permet de **forcer la pompe en marche pendant une durée fixe**, indépendamment du planning normal. C'est l'outil idéal pour les traitements ponctuels : choc chloré, algicide, floculant.

## Boutons disponibles

| Bouton | Durée | Usage typique |
|--------|-------|--------------|
| **Forcer Filtration 2h** | 2 heures | Ajout rapide de produit, brassage post-traitement |
| **Forcer Filtration 6h** | 6 heures | Traitement algicide ou floculant |
| **Forcer Filtration 24h** | 24 heures | Choc chloré, remise en route de la piscine |
| **Arrêter Mode Forcé** | — | Annule immédiatement le mode forcé |

Ces boutons sont accessibles depuis Home Assistant et depuis l'interface web de l'ESP.

## Comportement

- La pompe **démarre immédiatement** à l'appui du bouton, sans attendre le prochain cycle de calcul (30 s).
- Le mode forcé est **prioritaire sur tout** sauf l'antigel : il s'applique même si le Mode Filtration est réglé sur **Off**.
- Appuyer sur un preset pendant qu'un autre est actif **repart à zéro depuis maintenant** — pas d'empilement.
- À expiration, la pompe repasse sous contrôle de la planification normale dans les 30 secondes.
- Le mode forcé **n'est pas conservé après un redémarrage** de l'ESP.

## Suivi du temps restant

L'entité `text_sensor.frangipool_mode_force_temps_restant` affiche le temps restant en clair (`2h 30min`, `45min`, etc.) ou `Inactif` quand aucun mode forcé n'est actif.

## Via l'action API

Il est également possible de déclencher le mode forcé par une action Home Assistant, ce qui permet de l'intégrer dans des automatisations :

```yaml
action: esphome.frangipool_force_filtration
data:
  hours: 4   # durée en heures, valeur entre 0 et 24 — 0 annule le mode forcé
```

Voir [Actions API](../home-assistant/actions-api) pour la liste complète des actions disponibles.
