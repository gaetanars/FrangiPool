# FrangiPool

[![ESPHome](https://img.shields.io/badge/ESPHome-ESP32-blue?logo=esphome&logoColor=white)](https://esphome.io)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.6%2B-41BDF5?logo=home-assistant&logoColor=white)](https://www.home-assistant.io)
[![GitHub release](https://img.shields.io/github/v/release/frangipool/esphome-config?label=derni%C3%A8re%20version&color=brightgreen)](https://github.com/frangipool/esphome-config/releases)
[![GitHub stars](https://img.shields.io/github/stars/frangipool/esphome-config?style=social)](https://github.com/frangipool/esphome-config/stargazers)

Configuration ESPHome pour l'automatisation d'une piscine à sel sur ESP32. La filtration est gérée directement par l'ESP — calcul des horaires, démarrage et arrêt de la pompe — sans aucune automatisation Home Assistant requise. HA reste utile pour la supervision et les notifications, mais son absence ou son redémarrage n'interrompt pas la filtration.

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

Tous les presets incluent la gestion autonome de la filtration. **Auto-régulation** : contrôle automatique de l'électrolyseur selon les seuils Redox (nécessite électrolyseur + Redox).

## Substitutions

Chaque preset définit quatre substitutions à adapter avant de flasher :

```yaml
substitutions:
  name: frangipool                          # Nom ESPHome du périphérique (hostname)
  friendly_name: FrangiPool                 # Nom affiché dans Home Assistant
  local_temp_address: "0x0000000000000000"  # Adresse Dallas : sonde locale/intérieure
  temp_address: "0x0000000000000000"        # Adresse Dallas : sonde tuyau/piscine
```

**Trouver les adresses Dallas :** flasher avec les adresses `0x0000000000000000`, connecter via USB et ouvrir les logs ESPHome. Le scan du bus 1-Wire affiche les adresses découvertes au démarrage.

## Filtration autonome

L'ESP calcule lui-même les horaires de filtration en fonction de la température de la piscine. La pompe démarre et s'arrête sans aucune action de Home Assistant.

### Modes de filtration

| Mode | Comportement |
| ---- | ------------ |
| **Off** | Pompe arrêtée (le mode antigel reste actif) |
| **Hiver** | Durée fixe si T < 10 °C (défaut 3 h), sinon T ÷ diviseur (défaut 3) |
| **Courbe** | Durée calculée selon une courbe adaptée à la température, modulée par le coefficient |
| **Auto** | Bascule automatiquement entre Courbe et Hiver selon la température (seuil 16 °C avec hystérésis) |

### Deux cycles par jour

La durée journalière est répartie en deux plages de filtration : une le matin, une le soir. L'**heure pivot** définit le milieu de la pause entre les deux cycles.

```text
Exemple : pivot 13h30, pause 8h, ratio 33 %, durée totale 9h
  → Cycle matin  :  07h30 – 10h30  (3h)
  → Pause        :  10h30 – 17h30
  → Cycle soir   :  17h30 – 23h30  (6h)
```

Avec une **pause de 0 h**, les deux cycles sont contigus — la filtration est continue.

### Paramètres configurables

Tous les paramètres sont persistants (conservés après coupure de courant) et modifiables depuis l'interface web ou Home Assistant.

| Paramètre | Défaut | Description |
| --------- | ------ | ----------- |
| Mode Filtration | Auto | Off / Hiver / Courbe / Auto |
| Heure Pivot | 13:30 | Centre de la pause entre les deux cycles |
| Durée Pause | 8 h | Durée de repos entre matin et soir (0 = continu) |
| Ratio Matin | 33 % | Part de la durée totale allouée au cycle matin |
| Coefficient Filtration | 100 % | Multiplicateur global (50–150 %) pour ajuster la durée sans changer de mode |
| Durée Hiver Min | 3 h | Durée journalière en mode Hiver quand T < 10 °C |
| Diviseur Hiver | 3 | Durée = T ÷ diviseur quand T ≥ 10 °C en mode Hiver |

### Priorité antigel

Le mode antigel est indépendant du planning de filtration. Si la température du tuyau passe sous le seuil antigel, la pompe démarre immédiatement, quel que soit le mode ou l'heure.

### Mode forcé (traitement ponctuel)

Pour les traitements ponctuels (choc chloré, algicide, floculant), trois boutons permettent de forcer la pompe en marche pendant une durée fixe, **quel que soit le mode ou l'heure planifiée**, puis de revenir automatiquement à la planification normale.

| Bouton | Durée | Usage typique |
| ------ | ----- | ------------- |
| **Forcer Filtration 2h** | 2 heures | Ajout rapide de produit, brassage post-traitement |
| **Forcer Filtration 6h** | 6 heures | Traitement algicide ou floculant |
| **Forcer Filtration 24h** | 24 heures | Choc chloré, remise en route de la piscine |
| **Arrêter Mode Forcé** | — | Annule immédiatement le mode forcé |

**Comportement :**

- La pompe démarre **immédiatement** à l'appui du bouton, sans attendre le prochain tick de 30 s.
- Le mode forcé est **prioritaire sur tout** : il s'applique même si le Mode Filtration est réglé sur Off.
- Appuyer sur un preset pendant qu'un autre est actif **repart du compte depuis maintenant** (pas d'empilement).
- À expiration, la pompe revient sous contrôle de la planification normale dans les 30 secondes.
- Le mode forcé **ne persiste pas au redémarrage** de l'ESP.

Le capteur diagnostique **Mode Forcé — Temps restant** affiche le temps restant (ex. `2h 30min`) ou `Inactif`.

## Interface web locale

L'ESP expose une interface web sur le **port 80** (`http://<ip-de-lesp>`), accessible sans Home Assistant. Elle permet de consulter l'état des capteurs et de modifier tous les paramètres de filtration.

## Autres entités de configuration

Disponibles selon le preset :

| Entité | Description |
| ------ | ----------- |
| **Consigne Antigel** | Seuil de température antigel (sonde tuyau). La pompe s'active 1 °C en dessous du seuil |
| **Délais mesures** | Durée minimale de pompage avant d'enregistrer la température et les valeurs Redox |
| **Mode Électrolyseur** | Off / Auto / Forcé |
| **Consigne Redox Max / Min** | Seuils Redox (mV) pour l'auto-régulation |
| **Mode Surpresseur** | Off / Auto / Forcé |
| **Calibration Redox 225mV / 475mV** | Calibration de la sonde Redox dans une solution étalon |
| **Réinitialisation calibration Redox** | Remet l'offset de calibration à 0 |
| **Calibration pH 7.00** | Calibration de la sonde pH dans un tampon pH 7.00 |
| **Redémarrage** | Redémarre l'ESP |

## Dashboard Home Assistant

Un dashboard Lovelace dédié est disponible dans le repo : [`homeassistant/dashboard/frangipool.yaml`](homeassistant/dashboard/frangipool.yaml).

**Prérequis :** [HACS](https://hacs.xyz/) installé avec la carte [apexcharts-card](https://github.com/RomRider/apexcharts-card).

**Import :** HA Settings → Dashboards → Add dashboard → From YAML (raw config editor) → coller le contenu du fichier.

Le dashboard affiche sur une page unique :

- État de la piscine : pompe, électrolyseur, pH et Redox avec coloration contextuelle (vert/orange/rouge), température
- Diagnostics de filtration : phase courante, horaires calculés, durée journalière, mode Auto actif
- Graphiques 7 jours : pH, Redox et température avec zones de couleur
- Configuration : paramètres de filtration, consignes Redox, mode électrolyseur
- Diagnostics système : uptime (en secondes), RSSI, état connexion, bouton reboot

Les sections pH, Redox, Booster et Électrolyseur+Redox se masquent automatiquement si les entités correspondantes sont absentes (compatibilité avec tous les presets, du `salt_minimal` au `salt_booster_full`).

> **Adapter au device name :** si votre ESP ne s'appelle pas `frangipool`, remplacez toutes les occurrences de `frangipool` par votre device name (tirets → underscores dans les entity IDs HA).
> **Uptime :** affiché en secondes brutes — HA ne supporte pas de formatage natif durée pour les capteurs de ce type.

## Intégration Home Assistant

Home Assistant reste utile pour superviser l'état de l'ESP, recevoir les notifications (antigel, calibration) et ajuster les paramètres. Mais **aucune automatisation HA n'est nécessaire** pour que la filtration fonctionne.

> **Migration depuis le blueprint HA :** si vous utilisiez le blueprint `homeassistant/blueprint/frangipool.yaml`, **désactivez ou supprimez l'automation correspondante** avant de déployer ce firmware. Laisser les deux actifs en parallèle provoquerait des conflits sur le contrôle de la pompe.

L'heure est fournie à l'ESP par Home Assistant via l'API locale (pas d'accès internet requis). Si HA est temporairement indisponible au démarrage, la pompe reste à l'arrêt jusqu'à la synchronisation de l'heure.

## Packages ESPHome disponibles

Pour les utilisateurs souhaitant composer une configuration personnalisée :

| Package | Description |
| --------- | ----------- |
| `packages/base.yaml` | Pompe (GPIO25), capteurs Dallas (GPIO23), antigel, interface web port 80, API/OTA/Improv, LED de statut |
| `packages/filtration.yaml` | Gestion autonome de la filtration : modes Off/Hiver/Courbe/Auto, deux cycles journaliers, calcul des horaires |
| `packages/i2c_ads1115.yaml` | Bus I2C (GPIO21/22) et ADC ADS1115 à l'adresse 0x48 |
| `packages/electrolyser.yaml` | Relais électrolyseur (GPIO27), compteur de minutes d'électrolyse |
| `packages/booster.yaml` | Relais surpresseur (GPIO26), Mode Off/Auto/Forcé |
| `packages/redox.yaml` | Capteur Redox/ORP (ADS1115 A0), boutons de calibration, capteur de tendance |
| `packages/ph.yaml` | Capteur pH (ADS1115 A1), bouton de calibration |
| `packages/redox_electrolyser.yaml` | Auto-régulation Redox de l'électrolyseur, Mode Off/Auto/Forcé, seuils Redox |

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
  filtration: github://frangipool/esphome-config/packages/filtration.yaml@main
  i2c_ads1115: github://frangipool/esphome-config/packages/i2c_ads1115.yaml@main
  electrolyser: github://frangipool/esphome-config/packages/electrolyser.yaml@main
  redox: github://frangipool/esphome-config/packages/redox.yaml@main
  redox_electrolyser: github://frangipool/esphome-config/packages/redox_electrolyser.yaml@main
```

Tous les packages sont téléchargés directement depuis GitHub au moment de la compilation. Pour épingler une version spécifique, remplacer `@main` par un tag (ex : `@v2.0.0`).
