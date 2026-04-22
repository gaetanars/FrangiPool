# FrangiPool

[![ESPHome](https://img.shields.io/badge/ESPHome-ESP32-blue?logo=esphome&logoColor=white)](https://esphome.io)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.6%2B-41BDF5?logo=home-assistant&logoColor=white)](https://www.home-assistant.io)
[![GitHub release](https://img.shields.io/github/v/release/gaetanars/FrangiPool?label=derni%C3%A8re%20version&color=brightgreen)](https://github.com/gaetanars/FrangiPool/releases)
[![GitHub stars](https://img.shields.io/github/stars/gaetanars/FrangiPool?style=social)](https://github.com/gaetanars/FrangiPool/stargazers)

Configuration ESPHome pour l'automatisation d'une piscine à sel sur ESP32. La filtration est gérée directement par l'ESP — calcul des horaires, démarrage et arrêt de la pompe — sans aucune automatisation Home Assistant requise. HA reste utile pour la supervision et les notifications, mais son absence ou son redémarrage n'interrompt pas la filtration.

PCB intégré au monorepo sous [pcb/](pcb/) — détails matériels et Gerbers prêts pour fabrication ci-dessous.

## Prérequis

- ESPHome ≥ 2024.6.0 (plateforme `datetime:`) — version épinglée via `esphome.min_version` dans `packages/base.yaml`.

## Import rapide

1. Ouvrir le tableau de bord ESPHome → **Nouveau périphérique** → **Utiliser un projet**
2. Coller l'URL du preset correspondant à votre matériel
3. Adapter les substitutions (nom de l'appareil, adresses Dallas)
4. Flasher → Terminé

## Configurations disponibles

Choisissez le preset correspondant à votre matériel :

| Preset | Électrolyseur | Redox | pH | Auto-régulation | Surpresseur | URL |
| -------- | :---: | :---: | :---: | :---: | :---: | --- |
| `salt_full` | ✓ | ✓ | ✓ | ✓ | — | `github://gaetanars/FrangiPool/salt_full.yaml@main` |
| `salt_wo_ph` | ✓ | ✓ | — | ✓ | — | `github://gaetanars/FrangiPool/salt_wo_ph.yaml@main` |
| `salt_wo_redox` | ✓ | — | ✓ | — | — | `github://gaetanars/FrangiPool/salt_wo_redox.yaml@main` |
| `salt_minimal` | ✓ | — | — | — | — | `github://gaetanars/FrangiPool/salt_minimal.yaml@main` |
| `salt_booster_full` | ✓ | ✓ | ✓ | ✓ | ✓ | `github://gaetanars/FrangiPool/salt_booster_full.yaml@main` |
| `salt_booster_wo_ph` | ✓ | ✓ | — | ✓ | ✓ | `github://gaetanars/FrangiPool/salt_booster_wo_ph.yaml@main` |
| `salt_booster_wo_redox` | ✓ | — | ✓ | — | ✓ | `github://gaetanars/FrangiPool/salt_booster_wo_redox.yaml@main` |
| `salt_booster_minimal` | ✓ | — | — | — | ✓ | `github://gaetanars/FrangiPool/salt_booster_minimal.yaml@main` |

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

## Secrets

L'API ESPHome, l'OTA, le WiFi principal et l'AP de secours exigent des secrets définis dans un fichier `secrets.yaml` local (gitignored). Un modèle `secrets.example.yaml` est fourni à la racine du repo.

### Mise en place

1. Copier `secrets.example.yaml` en `secrets.yaml` à la racine du repo (même dossier que les presets `salt_*.yaml`).
2. Générer une clé API ESPHome fraîche — exactement 32 octets base64 :

   ```bash
   openssl rand -base64 32
   ```

   Sur Windows sans `openssl` :

   ```bash
   python -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
   ```

3. Remplir `wifi_ssid`, `wifi_password`, `ap_password` (≥ 8 caractères), `api_encryption_key` (clé générée ci-dessus), `ota_password`.
4. Adopter le device dans Home Assistant en renseignant la `api_encryption_key` lorsque HA la demande.

> **Dashboard ESPHome :** si tu passes par `dashboard_import` (import via URL depuis le tableau de bord ESPHome), le fichier `secrets.yaml` doit se trouver dans le dossier de config de ton dashboard, pas dans ce repo. L'éditeur propose une entrée « Secrets » pour y accéder.

### Premier flash

Improv (WiFi provisioning BLE/série) a été retiré pour réduire la surface d'attaque. **Le premier flash doit se faire par USB** avec `secrets.yaml` prêt. Les mises à jour ultérieures peuvent se faire par OTA (authentifié via `ota_password`).

### Perte de `secrets.yaml`

`secrets.yaml` n'est pas committé. S'il est perdu :

- Regénérer une nouvelle `api_encryption_key` et un nouveau `ota_password`.
- Reflasher le device par USB.
- Re-adopter le device dans Home Assistant avec la nouvelle clé.

### Secours WiFi (captive portal)

Si le WiFi domestique est injoignable, l'ESP démarre un point d'accès `${friendly_name} Fallback Hotspot` protégé par `ap_password`. Une fois connecté à cet AP, ouvre `http://192.168.4.1/` pour saisir de nouveaux identifiants WiFi. Le captive portal expose aussi un endpoint OTA — d'où l'importance d'un `ap_password` fort.

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

## Autres entités de configuration

Disponibles selon le preset :

| Entité | Description |
| ------ | ----------- |
| **Consigne Antigel** | Seuil de température antigel (sonde tuyau). La pompe s'active 1 °C en dessous du seuil |
| **Délais mesures** | Durée minimale de pompage avant d'enregistrer la température et les valeurs Redox |
| **Mode Électrolyseur** | Off / Auto / Forcé |
| **Consigne Redox** | Seuil Redox cible (mV) — l'électrolyseur s'active à -30 mV et se coupe à la consigne |
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

### Migration v0.1 → v0.2

La v0.2 déplace la planification et les consignes sur l'ESP. Si tu montes depuis la v0.1, prévois les étapes suivantes.

**Blueprint Home Assistant (obsolète).** Le blueprint `homeassistant/blueprint/frangipool.yaml` n'est plus maintenu et est supprimé du dépôt. Avant de flasher la v0.2, ouvre HA → Settings → Automations & Scenes → filtre par blueprint `FrangiPool` → désactive ou supprime les automations correspondantes. Laisser le blueprint actif provoque du pump-chattering : deux sources (blueprint HA + planification ESP) écrivent sur `switch.frangipool_filtration` à chaque limite de cycle.

**Package Home Assistant (obsolète).** Le package HA `homeassistant/package/frangipool.yaml` est également supprimé. Les entités d'aide HA sont remplacées par des entités exposées par l'ESP. Mets à jour tes automations selon la correspondance :

| v0.1 (HA helpers) | v0.2 (entités ESP) |
| --- | --- |
| `input_select.mode_filtration_piscine` | `select.frangipool_mode_filtration` |
| `input_datetime.heure_debut_filtration_*` | Plus d'entrée manuelle — les fenêtres sont calculées, exposées via `sensor.frangipool_horaires_filtration` |
| `input_number.duree_filtration_*` | `number.frangipool_coefficient_filtration` + `number.frangipool_duree_pause_filtration` |
| `input_button.forcer_filtration` | `button.frangipool_forcer_filtration_2h` / `_6h` / `_24h` ou `force_filtration(hours)` |
| Template sensors HA | `sensor.frangipool_duree_filtration_journaliere`, `sensor.frangipool_phase_filtration`, `sensor.frangipool_mode_auto_actif` |

**Options du mode filtration.** Les valeurs du select ont changé. ESPHome ignore silencieusement les valeurs inconnues — toute automation HA appelant `select.select_option` avec les anciens libellés ne fera rien.

| v0.1 | v0.2 |
| --- | --- |
| `Inactif` | `Off` |
| `Hivernage` | `Hiver` |
| `Automatique` | `Auto` |
| `Forcé` | Utiliser l'action API `force_filtration(hours)` ou les boutons Forcer Filtration 2h / 6h / 24h |

**Clé API Home Assistant.** L'API native utilise maintenant le chiffrement Noise (voir section Secrets). Si ton ESP était déjà adopté dans HA, HA le verra comme `unavailable` après le flash. Supprime l'intégration existante (HA → Settings → Devices & Services → ESPHome → sélectionne le device → Delete), puis ré-adopte-le avec la nouvelle `api_encryption_key`. Les `unique_id` ESPHome sont conservés, donc tes dashboards continuent de fonctionner après ré-adoption.

**Consigne Redox.** Les anciens `number.frangipool_consigne_redox_min` / `_max` sont remplacés par un unique `number.frangipool_consigne_redox` (plage 680–760 mV, défaut 730 mV). Mets à jour les automations HA qui référencent les deux anciennes entités.

L'heure est fournie à l'ESP par Home Assistant via l'API locale (pas d'accès internet requis). Si HA est temporairement indisponible au démarrage, la pompe reste à l'arrêt jusqu'à la synchronisation de l'heure.

## Packages ESPHome disponibles

Pour les utilisateurs souhaitant composer une configuration personnalisée :

| Package | Description |
| --------- | ----------- |
| `packages/base.yaml` | Pompe (GPIO25), capteurs Dallas (GPIO23), antigel, API chiffrée, OTA passwordé, captive portal, LED de statut |
| `packages/filtration.yaml` | Gestion autonome de la filtration : modes Off/Hiver/Courbe/Auto, deux cycles journaliers, calcul des horaires |
| `packages/i2c_ads1115.yaml` | Bus I2C (GPIO21/22) et ADC ADS1115 à l'adresse 0x48 |
| `packages/electrolyser.yaml` | Relais électrolyseur (GPIO27), compteur de minutes d'électrolyse |
| `packages/booster.yaml` | Relais surpresseur (GPIO26), Mode Off/Auto/Forcé |
| `packages/redox.yaml` | Capteur Redox/ORP (ADS1115 A0), boutons de calibration, capteur de tendance |
| `packages/ph.yaml` | Capteur pH (ADS1115 A1), bouton de calibration |
| `packages/redox_electrolyser.yaml` | Auto-régulation Redox de l'électrolyseur, Mode Off/Auto/Forcé, seuils Redox |

## PCB

Le PCB qui héberge l'ESP32 et ses capteurs est sous [pcb/](pcb/). Voir [pcb/README.md](pcb/README.md) pour le détail matériel (ADS1115, bus 1-Wire, connecteurs Nextion/I2C).

![Vue 2D du PCB](pcb/images/Vue_2D.svg)

Les Gerbers prêts pour fabrication sont publiés en tant qu'asset `gerber.zip` sur chaque [GitHub release](https://github.com/gaetanars/FrangiPool/releases) — téléchargez-les et envoyez-les au fabricant de votre choix (JLCPCB, PCBWay, etc.).

## Relais Active-LOW

Le PCB FrangiPool utilise des relais à logique **Active-LOW** : le relais se ferme (charge activée) quand la broche GPIO est à l'état bas (LOW), et s'ouvre quand elle est à l'état haut (HIGH).

Au boot de l'ESP32, toutes les broches GPIO sont en état HIGH par défaut. Avec des relais Active-LOW, cela signifie que les charges sont **éteintes au démarrage**, ce qui évite toute activation intempestive de la pompe ou de l'électrolyseur pendant la séquence de boot.

Les broches concernées utilisent `inverted: true` dans ESPHome pour que la logique applicative (ON/OFF) corresponde à l'état physique attendu.

## Conventions

Les globales portées par un package sont préfixées `g_` pour les distinguer des IDs d'entités dans les appels `id()` (ex. `g_pump_last_turn_on`, et non `pump_last_turn_on`). La règle s'applique à tous les packages sous `packages/`. Les globales partagées entre packages (aucune à ce jour) peuvent omettre le préfixe.

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
  base: github://gaetanars/FrangiPool/packages/base.yaml@main
  filtration: github://gaetanars/FrangiPool/packages/filtration.yaml@main
  i2c_ads1115: github://gaetanars/FrangiPool/packages/i2c_ads1115.yaml@main
  electrolyser: github://gaetanars/FrangiPool/packages/electrolyser.yaml@main
  redox: github://gaetanars/FrangiPool/packages/redox.yaml@main
  redox_electrolyser: github://gaetanars/FrangiPool/packages/redox_electrolyser.yaml@main
```

Tous les packages sont téléchargés directement depuis GitHub au moment de la compilation. Pour épingler une version spécifique, remplacer `@main` par un tag (ex : `@v0.2.0`).
