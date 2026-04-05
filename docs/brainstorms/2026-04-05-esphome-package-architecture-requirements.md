---
date: 2026-04-05
topic: esphome-package-architecture
---

# Architecture Packages ESPHome

## Problem Frame

Le projet gère actuellement 8 variantes de configuration via un générateur Go (`go generate`) qui produit autant de fichiers `frangipool_*.yaml`. Cette approche a deux limites :

1. **Pour le mainteneur** : chaque ajout de feature ou correction nécessite de toucher le template, régénérer, et committer des fichiers générés. La CI auto-génère sur certaines branches, mais le flow est non-standard et peu lisible.
2. **Pour l'utilisateur final** : il doit identifier la bonne variante parmi 8, copier le bon `dashboard_import` URL, et n'a aucun moyen d'adapter finement sa config sans forker.

ESPHome supporte nativement les `packages` — des fragments YAML importables depuis GitHub. Cette mécanique permet de décomposer la config en modules indépendants et de composer des presets pré-assemblés, sans générateur de code.

## Requirements

**Packaging**

- R1. La configuration est découpée en packages YAML indépendants sous `packages/` :
  - `base.yaml` — pompe filtration, sondes température Dallas, protection antigel, LED statut, API/OTA/improv
  - `electrolyser.yaml` — relais électrolyseur, mode Off/Auto/Forcé, compteur minutes électrolyse
  - `booster.yaml` — relais surpresseur, mode Off/Auto/Forcé
  - `i2c_ads1115.yaml` — bus I2C et composant ADS1115 (partagé entre redox et pH)
  - `redox.yaml` — capteur Redox via ADS1115, calibration, tendance Redox (référence `i2c_ads1115` par id, ne le redéfinit pas)
  - `ph.yaml` — capteur pH via ADS1115, calibration (référence `i2c_ads1115` par id, ne le redéfinit pas)
  - `redox_electrolyser.yaml` — logique d'auto-régulation électrolyseur basée sur le Redox (inclus uniquement quand les deux sont présents)
- R2. Les packages sont conçus pour être composables : inclure `redox.yaml` + `electrolyser.yaml` + `redox_electrolyser.yaml` produit une config cohérente et fonctionnelle.
- R3. Le bus I2C et le module ADS1115 sont définis une seule fois dans `packages/i2c_ads1115.yaml`. Les packages `redox.yaml` et `ph.yaml` référencent ces composants par `id:` sans les redéfinir. Les presets qui incluent redox ou pH doivent inclure `i2c_ads1115.yaml`.

**Presets pré-assemblés**

- R4. Des fichiers de presets pré-assemblés sont fournis **à la racine du repo** (pas dans un sous-dossier) ; chaque preset compose ses packages via la clé `packages:` d'ESPHome. Note : ESPHome issue #4887 (open) — `dashboard_import.package_import_url` échoue silencieusement pour les fichiers en sous-dossier. Les packages eux-mêmes peuvent être sous `packages/` car l'URL de `packages:` supporte les sous-dossiers.
- R5. Les presets couvrent au minimum les combinaisons actuelles (les 8 variantes existantes), soit :
  - `salt_full.yaml` — électrolyseur + i2c_ads1115 + redox + pH + auto-régulation (redox_electrolyser)
  - `salt_wo_ph.yaml` — électrolyseur + i2c_ads1115 + redox (sans pH, sans auto-régulation)
  - `salt_wo_redox.yaml` — électrolyseur + i2c_ads1115 + pH (sans redox, sans auto-régulation)
  - `salt_minimal.yaml` — électrolyseur seul (sans capteurs ADC, sans i2c_ads1115)
  - `salt_booster_full.yaml` — idem `salt_full` + surpresseur
  - `salt_booster_wo_ph.yaml` — électrolyseur + surpresseur + i2c_ads1115 + redox (sans pH)
  - `salt_booster_wo_redox.yaml` — électrolyseur + surpresseur + i2c_ads1115 + pH (sans redox)
  - `salt_booster_minimal.yaml` — électrolyseur + surpresseur (sans capteurs ADC)
- R6. Chaque preset contient une section `dashboard_import` pointant vers son propre URL GitHub à la racine, permettant l'import direct depuis le Dashboard ESPHome.
- R7. Chaque preset contient les `substitutions` nécessaires (nom, adresses Dallas) avec des valeurs par défaut documentées que l'utilisateur doit adapter.

**Migration et suppression du générateur**

- R8. Le générateur Go (`template/main.go`, `template/config.yaml`, `template/frangipool.yaml.tmpl`, `main.go`, `go.mod`, `go.sum`) est supprimé.
- R9. Les fichiers générés existants (`frangipool_*.yaml`) sont supprimés.
- R10. La CI (`go-generated.yaml`) est supprimée ou remplacée par une validation ESPHome si pertinent.
- R11. Aucune compatibilité avec les anciennes URLs `frangipool_*.yaml` n'est maintenue — migration nette.

**Documentation**

- R12. Le `README.md` (qui était lui aussi généré) est réécrit manuellement pour documenter la nouvelle architecture : liste des packages, liste des presets, instructions d'import Dashboard, guide de personnalisation avancée.
- R13. `CLAUDE.md` est mis à jour pour refléter la nouvelle structure (plus de `go generate`, édition directe des fichiers sous `packages/` et `presets/`).

## Success Criteria

- Un utilisateur peut importer un preset via ESPHome Dashboard (New Device → "Use a project") sans cloner le repo ni exécuter de commandes.
- Le mainteneur peut ajouter une feature en créant/modifiant un seul fichier package, sans étape de génération.
- Les 8 combinaisons matérielles actuelles sont couvertes par les presets.
- Aucun fichier ne doit être "généré" — tout ce qui est dans le repo est source de vérité directement éditable.

## Scope Boundaries

- Pas de changement à la logique métier existante (seuils Redox, calculs pH, antigel, etc.) — la refonte est structurelle uniquement.
- Pas de nouveau composant matériel ajouté dans cette refonte.
- Pas de système de configuration dynamique côté firmware (ESPHome est compilé statiquement — les features s'activent à la compilation, pas au runtime).
- Pas d'interface web de configuration de packages (hors scope).

## Key Decisions

- **Packages + presets plutôt que packages seuls** : les presets permettent un `dashboard_import` direct sans que l'utilisateur ait à composer manuellement. Les packages restent disponibles pour les utilisateurs avancés. Les presets sont à la racine du repo (contrainte ESPHome issue #4887), les packages dans `packages/`.
- **Migration nette sans transition** : les URLs `frangipool_*.yaml` sont abandonnées. Le projet est encore jeune, la base d'utilisateurs est limitée — la simplicité prime.
- **Suppression complète du générateur Go** : aucun `go generate`, aucun fichier généré, aucune CI de génération. La source de vérité devient les fichiers YAML eux-mêmes.

## User Flow

```
Utilisateur standard
      │
      ▼
ESPHome Dashboard → "New Device" → "Use a project"
      │
      ▼
Saisit l'URL du preset GitHub
(ex: github://frangipool/esphome-config/salt_full.yaml@main)
      │
      ▼
Adapte les substitutions (nom device, adresses Dallas)
      │
      ▼
Flash → Done

Utilisateur avancé
      │
      ▼
Crée my-pool.yaml local avec packages: choisis
      │
      ▼
Inclut les packages GitHub voulus
(base + electrolyser + redox + redox_electrolyser, etc.)
      │
      ▼
Flash → Done
```

## Dependencies / Assumptions

- **[Vérifié]** ESPHome fusionne les listes (`sensor:`, `switch:`, `globals:`, `interval:`) de façon additive (concaténation) entre packages. Les scalaires sont en last-write-wins. Source : ESPHome docs + PR #3555.
- **[Vérifié]** Les IDs déclarés dans un package (ex: `id: bus_a` dans `i2c_ads1115.yaml`) sont accessibles globalement après merge. Un package peut référencer l'ID d'un autre package sans le redéfinir. Source : ESPHome docs packages, issue #3354 corrigée.
- **[Vérifié - contrainte]** `dashboard_import.package_import_url` ne fonctionne pas de façon fiable pour les fichiers en sous-dossier (ESPHome issue #4887, ouverte). Les presets doivent être à la racine du repo. Les références `packages:` vers des sous-dossiers (`packages/`) fonctionnent normalement.
- Les URLs `github://` dans `packages:` nécessitent que les fichiers soient sur une branche ou tag public du repo. La question tag vs branche pour les presets (pinning de version) est déférée au planning.

## Outstanding Questions

### Resolve Before Planning

_(aucune — les décisions produit sont toutes prises)_

### Deferred to Planning

- [Affects R8][Technical] Vérifier si `go.mod`/`go.sum` sont nécessaires pour autre chose que le générateur (ex: CI Go toolchain) avant de les supprimer.
- [Affects R6][Technical] Décider si les presets sont publiés par branche (`@main`) ou par tag (`@v2.0.0`) — les appareils déployés dépendent de cette URL pour les OTA.
- [Affects R1][Technical] Confirmer qu'ESPHome supporte les `packages:` imbriqués (un package qui liste lui-même d'autres packages) — utile si les packages sensors veulent s'auto-documenter leurs dépendances.
- [Affects R7][Technical] Définir la valeur sentinelle pour les adresses Dallas dans les substitutions des presets (placeholder explicite type `0xDEADBEEFDEADBEEF` ou commentaire d'instruction).

## Next Steps

→ `/ce:plan` pour la planification de l'implémentation
