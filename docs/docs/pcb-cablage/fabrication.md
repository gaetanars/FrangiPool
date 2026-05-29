---
sidebar_position: 3
title: Fabrication du PCB
description: Comment télécharger les fichiers Gerber et commander le PCB auprès d'un fabricant.
---

# Fabrication du PCB

## Télécharger les Gerbers

Les fichiers Gerber prêts pour fabrication sont publiés dans les **releases GitHub PCB** sous forme d'archive `gerber.zip` :

1. Rendez-vous sur la page [Releases du projet](https://github.com/gaetanars/FrangiPool/releases).
2. Filtrez les releases avec le tag `pcb-*.*.*` (les releases firmware ont un tag `v*.*.*`).
3. Téléchargez `gerber.zip` depuis la dernière release PCB.

:::info Releases PCB vs firmware
Les releases PCB (tags `pcb-*.*.*`) et les releases firmware (tags `v*.*.*`) sont indépendantes et ont leurs propres cycles de versions. Utilisez toujours la **dernière release PCB** pour la fabrication — elle ne change que lors d'une modification matérielle du PCB.
:::

## Commander auprès d'un fabricant

Envoyez le fichier `gerber.zip` directement au fabricant de votre choix. Les paramètres recommandés :

| Paramètre | Valeur |
|-----------|--------|
| Nombre de couches | 2 |
| Épaisseur | 1.6 mm |
| Finition de surface | HASL (Sn/Pb) ou ENIG |
| Couleur du vernis | Au choix |
| Quantité minimale | 5 pièces (minimum habituel) |

Fabricants courants compatibles :
- **JLCPCB** — [jlcpcb.com](https://jlcpcb.com)
- **PCBWay** — [pcbway.com](https://www.pcbway.com)
- **Eurocircuits** (Europe) — pour des délais plus courts en France/Europe

## Composants à souder

Le PCB est livré nu (sans composants). Vous devrez souder :

- 1× Module ESP32 DevKit (format standard 38 pins)
- 1× ADS1115 (module breakout)
- Connecteurs dupont femelles pour les GPIO
- Connecteurs 1-Wire (4×)
- Connecteurs relais (pompé sur 3× relais 5 V)
- Connecteur I²C

:::note
La liste complète des composants (BOM) et les instructions d'assemblage détaillées ne sont pas encore disponibles dans la documentation. Référez-vous au schéma du PCB dans les fichiers sources (`pcb/src/`) pour les footprints et valeurs des composants.
:::
