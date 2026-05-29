---
sidebar_position: 2
title: Configuration WiFi et adoption
description: Connectez FrangiPool à votre réseau WiFi et adoptez-le dans ESPHome ou Home Assistant.
---

# Configuration WiFi et adoption

## Étape 1 — Configuration WiFi

Deux méthodes sont disponibles selon votre environnement.

### Méthode A : Improv Serial (recommandée)

Lors du flash via ESPHome Web, la page propose automatiquement la configuration WiFi via le protocole **Improv Serial**. Une invite s'affiche dans le navigateur pour saisir le SSID et le mot de passe. Aucun AP intermédiaire n'est nécessaire.

### Méthode B : Captive Portal

Si Improv Serial n'est pas disponible (flash depuis binaire ou reconnexion après perte WiFi) :

1. L'ESP démarre un point d'accès ouvert nommé **`frangipool-XXXX`** (les 4 derniers caractères sont dérivés de l'adresse MAC).
2. Connectez-vous à ce réseau depuis votre téléphone ou ordinateur.
3. Ouvrez `http://192.168.4.1` dans un navigateur — le portail captif s'affiche.
4. Saisissez vos identifiants WiFi et validez.
5. L'ESP redémarre et rejoint votre réseau.

:::info AP de secours
Si le WiFi configuré devient injoignable (changement de box, SSID modifié), l'ESP redémarre automatiquement en mode AP après quelques tentatives. Même procédure pour re-saisir les identifiants.
:::

## Étape 2 — Adoption dans ESPHome Dashboard

Une fois FrangiPool connecté à votre réseau :

1. Ouvrez ESPHome Dashboard.
2. Le device `frangipool-XXXX` apparaît dans la section **Discovered**.
3. Cliquez **Adopt** — le Dashboard génère automatiquement une `api_encryption_key` et un `ota_password` uniques.
4. Ces credentials sont poussés par OTA sur le device et stockés dans la configuration locale du Dashboard.
5. Toutes les mises à jour ultérieures se font via OTA depuis le Dashboard.

## Étape 3 — Intégration Home Assistant

Home Assistant découvre automatiquement le device ESPHome via mDNS :

1. Une notification apparaît dans HA : **Nouvel appareil ESPHome détecté**.
2. Cliquez **Configurer** et entrez la clé API (fournie par ESPHome Dashboard lors de l'adoption).
3. Le device est ajouté dans **Paramètres → Appareils & Services → ESPHome**.

:::note Ordre recommandé
Adoptez d'abord dans ESPHome Dashboard pour générer les credentials, puis ajoutez dans Home Assistant avec la clé API générée.
:::

## Note de sécurité

Avant l'adoption (fenêtre de quelques minutes après le premier boot), l'API est accessible sans chiffrement et l'OTA sans mot de passe — comportement identique aux devices commerciaux (Shelly, Sonoff, etc.). Une fois adopté, le device est sécurisé avec des credentials uniques par appareil.
