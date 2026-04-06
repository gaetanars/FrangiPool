# FrangiPool

[![ESPHome](https://img.shields.io/badge/ESPHome-ESP32-blue?logo=esphome&logoColor=white)](https://esphome.io)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.6%2B-41BDF5?logo=home-assistant&logoColor=white)](https://www.home-assistant.io)
[![GitHub release](https://img.shields.io/github/v/release/frangipool/esphome-config?label=derni%C3%A8re%20version&color=brightgreen)](https://github.com/frangipool/esphome-config/releases)
[![GitHub stars](https://img.shields.io/github/stars/frangipool/esphome-config?style=social)](https://github.com/frangipool/esphome-config/stargazers)

Configuration ESPHome pour l'automatisation d'une piscine à sel sur ESP32. Supporte le contrôle de l'électrolyseur, la mesure Redox/ORP, la mesure du pH, la pompe de surpression et la protection antigel.

PCB disponible : [frangipool/pcb](https://github.com/frangipool/pcb)

## Import rapide

1. Ouvrir le tableau de bord ESPHome → **Nouveau périphérique** → **Utiliser un projet**
2. Coller l'URL du preset correspondant à votre matériel
3. Adapter les substitutions (nom de l'appareil, adresses Dallas)
4. Flasher → Terminé

## Configurations disponibles

Choisissez le preset correspondant à votre matériel :

| Preset | Électrolyseur | Redox | pH | Auto-régulation | Surpresseur | URL |
| -------- | :---: | :---: | :---: | :---: | :---: | --- |
| `salt_full` | ✓ | ✓ | ✓ | ✓ | — | `github://frangipool/esphome-config/salt_full.yaml@main` |
| `salt_wo_ph` | ✓ | ✓ | — | ✓ | — | `github://frangipool/esphome-config/salt_wo_ph.yaml@main` |
| `salt_wo_redox` | ✓ | — | ✓ | — | — | `github://frangipool/esphome-config/salt_wo_redox.yaml@main` |
| `salt_minimal` | ✓ | — | — | — | — | `github://frangipool/esphome-config/salt_minimal.yaml@main` |
| `salt_booster_full` | ✓ | ✓ | ✓ | ✓ | ✓ | `github://frangipool/esphome-config/salt_booster_full.yaml@main` |
| `salt_booster_wo_ph` | ✓ | ✓ | — | ✓ | ✓ | `github://frangipool/esphome-config/salt_booster_wo_ph.yaml@main` |
| `salt_booster_wo_redox` | ✓ | — | ✓ | — | ✓ | `github://frangipool/esphome-config/salt_booster_wo_redox.yaml@main` |
| `salt_booster_minimal` | ✓ | — | — | — | ✓ | `github://frangipool/esphome-config/salt_booster_minimal.yaml@main` |

**Auto-régulation** : contrôle automatique de l'électrolyseur selon les seuils Redox (nécessite électrolyseur + Redox).

## Substitutions

Chaque preset définit quatre substitutions à adapter avant de flasher :

```yaml
substitutions:
  name: frangipool                          # Nom ESPHome du périphérique (hostname)
  friendly_name: FrangiPool                 # Nom affiché dans Home Assistant
  local_temp_address: "0x0000000000000000"  # Adresse Dallas : sonde locale/intérieure
  temp_address: "0x0000000000000000"        # Adresse Dallas : sonde tuyau/piscine
```

**Trouver les adresses Dallas :** flasher avec les adresses `0x0000000000000000`, connecter via USB et ouvrir les logs ESPHome. Le scan du bus 1-Wire affiche les adresses découvertes au démarrage. Copier ces adresses dans les substitutions et reflasher.

## Entités de configuration

Une fois le périphérique FrangiPool enregistré dans Home Assistant, les entités de configuration suivantes sont disponibles (selon le preset) :

- **Consigne Antigel** : seuil de température antigel. La pompe s'active 1°C en dessous du seuil et s'arrête au seuil. Utilise le capteur de température du tuyau.
- **Consigne Redox Max / Min** : seuils Redox (mV) pour l'auto-régulation de l'électrolyseur
- **Délais mesures (au lancement de la filtration)** : durée minimale de fonctionnement avant d'enregistrer la température et les valeurs Redox
- **Mode Électrolyseur** : Inactif / Auto / Forcé
- **Mode Surpresseur** : Inactif / Auto / Forcé
- **Calibration Redox 225mV / 475mV** : calibration de la sonde Redox dans une solution de référence
- **Réinitialisation calibration Redox** : remet l'offset de calibration à 0
- **Calibration pH 7.00** : calibration de la sonde pH dans un tampon pH 7.00
- **Redémarrage** : redémarre l'ESP

## Intégration Home Assistant

Le dossier [`homeassistant/`](homeassistant/) contient un package et un blueprint pour gérer la filtration de la piscine directement dans Home Assistant.

### Package

Le [package](homeassistant/package/frangipool.yaml) crée toutes les entités nécessaires à la gestion de la filtration :

- Horaires des deux périodes de filtration
- Heures pivot (été et hivernage)
- Durées de coupure
- Coefficient d'ajustement du temps de filtration
- Mode de filtration (Courbe / Hivernage / Automatique / Forcé / Inactif)
- Bouton de recalcul

**Installation :** copier le fichier dans votre répertoire `packages/` et l'inclure dans `configuration.yaml` :

```yaml
homeassistant:
  packages: !include_dir_named packages
```

### Blueprint

Le [blueprint](homeassistant/blueprint/frangipool.yaml) gère automatiquement la filtration selon la température de la piscine, avec cinq modes de fonctionnement :

- **Courbe** : durée calculée selon une courbe polynomiale en fonction de la température
- **Hivernage** : 3h/jour en dessous de 10°C, fonctionnement continu en dessous du seuil hors-gel
- **Automatique** : bascule entre Courbe et Hivernage selon une température seuil configurable
- **Forcé** : pompe en fonctionnement continu
- **Inactif** : pompe arrêtée

**Importer le blueprint :**

[![Importer le blueprint](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fraw.githubusercontent.com%2Ffrangipool%2Fesphome-config%2Fmain%2Fhomeassistant%2Fblueprint%2Ffrangipool.yaml)

Ou manuellement : copier le fichier dans `config/blueprints/automation/frangipool/`.

## Packages ESPHome disponibles

Pour les utilisateurs souhaitant composer une configuration personnalisée :

| Package | Description |
| --------- | ----------- |
| `packages/base.yaml` | Pompe (GPIO25), capteurs Dallas (GPIO23), antigel, API/OTA/Improv, LED de statut |
| `packages/i2c_ads1115.yaml` | Bus I2C (GPIO21/22) et ADC ADS1115 à l'adresse 0x48 |
| `packages/electrolyser.yaml` | Relais électrolyseur (GPIO27), compteur de minutes d'électrolyse |
| `packages/booster.yaml` | Relais surpresseur (GPIO26), Mode Inactif/Auto/Forcé |
| `packages/redox.yaml` | Capteur Redox/ORP (ADS1115 A0), boutons de calibration, capteur de tendance |
| `packages/ph.yaml` | Capteur pH (ADS1115 A1), bouton de calibration |
| `packages/redox_electrolyser.yaml` | Auto-régulation Redox de l'électrolyseur, Mode Inactif/Auto/Forcé, seuils Redox |

## Relais Active-LOW

Le PCB FrangiPool utilise des relais à logique **Active-LOW** : le relais se ferme (charge activée) quand la broche GPIO est à l'état bas (LOW), et s'ouvre quand elle est à l'état haut (HIGH).

Au boot de l'ESP32, toutes les broches GPIO sont en état HIGH par défaut. Avec des relais Active-LOW, cela signifie que les charges sont **éteintes au démarrage**, ce qui évite toute activation intempestive de la pompe ou de l'électrolyseur pendant la séquence de boot.

Les broches concernées utilisent `inverted: true` dans ESPHome pour que la logique applicative (ON/OFF) corresponde à l'état physique attendu.

## Configuration avancée

Créer un fichier `ma-piscine.yaml` et composer les packages directement :

```yaml
substitutions:
  name: ma-piscine
  friendly_name: Ma Piscine
  local_temp_address: "0xABCDEF0123456789"
  temp_address: "0x0123456789ABCDEF"

esphome:
  name: ${name}
  friendly_name: ${friendly_name}

packages:
  base: github://frangipool/esphome-config/packages/base.yaml@main
  i2c_ads1115: github://frangipool/esphome-config/packages/i2c_ads1115.yaml@main
  electrolyser: github://frangipool/esphome-config/packages/electrolyser.yaml@main
  redox: github://frangipool/esphome-config/packages/redox.yaml@main
  redox_electrolyser: github://frangipool/esphome-config/packages/redox_electrolyser.yaml@main
```

Tous les packages sont téléchargés directement depuis GitHub au moment de la compilation. Pour épingler une version spécifique, remplacer `@main` par un nom de branche ou un tag (ex : `@v2.0.0`).
