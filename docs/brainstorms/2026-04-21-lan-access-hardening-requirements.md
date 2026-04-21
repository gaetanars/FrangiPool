---
date: 2026-04-21
topic: lan-access-hardening
todo: 001
---

# Durcissement accès LAN (ESP API / OTA / web_server / AP / Improv)

## Problem Frame

`packages/base.yaml` expose aujourd'hui une API ESPHome non chiffrée, une OTA sans mot de passe, un `web_server` HTTP sans auth, un AP de fallback WiFi avec le mot de passe `"12345678"`, et Improv BLE avec `authorizer: none`. N'importe quel appareil sur le LAN (ou à portée BLE pendant le provisioning, ou connecté au fallback AP) peut déclencher la pompe 24h, passer l'électrolyseur en mode forcé (surdosage chlore), modifier les setpoints redox, ou flasher un firmware arbitraire.

PR #6 élargit cette surface avec de nouvelles entités write-capable (boutons force 2h/6h/24h, stop). Le durcissement doit être fait dans le même PR pour ne pas publier des contrôles supplémentaires derrière une porte ouverte.

Pas de parc déployé à protéger : le projet n'est pas encore distribué, on peut casser la compat sans migration.

## Requirements

- **R1.** L'API ESPHome refuse toute connexion sans clé de chiffrement valide (`api.encryption.key` via `!secret`).
- **R2.** L'OTA refuse tout upload sans mot de passe (`ota.password` via `!secret`).
- **R3.** `web_server` est retiré de `packages/base.yaml`. Plus de page HTTP locale — tout passe par HA.
- **R4.** `improv_serial` et `esp32_improv` sont retirés de `packages/base.yaml`. Le provisioning WiFi initial passe exclusivement par `secrets.yaml` au flash USB.
- **R5.** Le SSID et password du fallback AP WiFi ne sont pas des littéraux faibles — si le fallback est conservé, il utilise `!secret ap_password`. Alternative acceptable : supprimer le bloc `wifi.ap` entièrement (plus de fallback).
- **R6.** Un fichier `secrets.example.yaml` à la racine documente toutes les clés attendues (`wifi_ssid`, `wifi_password`, `api_encryption_key`, `ota_password`, `ap_password` si R5 garde le fallback).
- **R7.** Le `README.md` explique comment générer les secrets (notamment `esphome wizard` ou `openssl rand -base64 32` pour la clé API) et rappelle que `secrets.yaml` ne doit pas être committé.
- **R8.** `.gitignore` liste `secrets.yaml`.

## Success Criteria

- `curl -X POST http://<esp-ip>/button/filtration_force_24h/press` renvoie une erreur de connexion (port fermé) ou 401/403 — plus jamais 200.
- Une tentative OTA sans password échoue explicitement.
- Une nouvelle adoption du device dans Home Assistant exige la clé API présente dans `secrets.yaml`.
- Aucun fichier `secrets.yaml` n'apparaît dans `git status` après avoir suivi le README.
- `grep -r '12345678\|password: "'` sur les YAML du repo ne retourne aucun littéral sensible.

## Scope Boundaries

- **Non-goal** : maintenir la compat avec des unités déjà flashées (aucune n'est déployée).
- **Non-goal** : fournir une page de diagnostic locale hors HA — la suppression de `web_server` est assumée.
- **Non-goal** : gating Improv via GPIO ou fenêtre temporelle — Improv est retiré entièrement, pas conditionné.
- **Non-goal** : auth/chiffrement sur les packages autres que `base.yaml` (les autres `packages/*.yaml` n'exposent pas d'endpoints réseau distincts).
- **Non-goal** : rotation automatique des secrets — génération manuelle one-shot au premier flash.

## Key Decisions

- **A+B+C maximal retenu** : chiffrement + secrets (A), suppression complète d'Improv (B radical), suppression de `web_server` (C). Rationale : le projet n'a pas encore d'utilisateurs déployés, donc le coût de la surface d'attaque résiduelle dépasse largement le coût de confort d'une page HTTP locale ou d'un provisioning BLE.
- **Improv supprimé, pas gaté** : pas de GPIO dédié à réserver, pas de fenêtre BLE résiduelle. Premier flash = USB avec `secrets.yaml`.
- **Pas de release transitoire** : une seule PR, tout en une fois. Les changements OTA/API breaking n'affectent personne puisque personne n'est déployé.

## Dependencies / Assumptions

- L'utilisateur a la chaîne `esphome` CLI installée localement pour générer les secrets et flasher via USB la première fois.
- Le projet reste distribué via `dashboard_import` github : le `secrets.yaml` est géré côté utilisateur (par ESPHome Dashboard ou CLI), le repo ne publie que les clés nommées dans les YAML.

## Outstanding Questions

### Resolve Before Planning

_(aucune)_

### Deferred to Planning

- [Affects R5][Technical] Conserver le bloc `wifi.ap` avec `!secret ap_password` ou le supprimer entièrement ? À trancher au moment où on regarde les scénarios de récupération WiFi (perte du routeur principal, etc.).
- [Affects R7][Needs research] Le README mentionne-t-il déjà `dashboard_import` vs flash local ? Vérifier si la doc existante couvre déjà le flash USB initial ou s'il faut l'ajouter.

## Next Steps

→ `/ce:plan` pour planifier l'implémentation (édition de `packages/base.yaml`, création de `secrets.example.yaml` et `.gitignore`, section README).
