---
title: "Encoder un état string restauré via un global int (codes énumérés) en ESPHome"
date: 2026-04-26
category: design-patterns
module: esphome
problem_type: design_pattern
component: tooling
severity: medium
applies_when:
  - Un global ESPHome de type std::string utilise restore_value true
  - Le firmware doit afficher un message textuel lisible dans Home Assistant après un reboot
  - Les messages possibles sont finis et connus à la compilation
tags:
  - esphome
  - global
  - restore_value
  - nvs
  - text_sensor
  - enum
  - persistence
---

# Encoder un état string restauré via un global int (codes énumérés) en ESPHome

## Context

ESPHome expose un mécanisme `restore_value: true` sur les globals pour persister des valeurs en flash NVS (Non-Volatile Storage) à travers les reboots. Ce mécanisme repose sur des **slots NVS de taille fixe** : il fonctionne de manière fiable pour les scalaires (`int`, `float`, `bool`) dont la taille est connue à la compilation. Pour un `std::string`, dont la taille est variable, le slot NVS alloué ne peut pas garantir la restauration correcte : la chaîne peut être tronquée, corrompue, ou simplement absente après reboot.

Le problème est apparu concrètement dans `packages/ph.yaml` (PR #9, commit eb31048) : le résultat de la dernière calibration pH devait survivre à un reboot pour informer l'utilisateur via Home Assistant. Un global `std::string` semblait naturel, mais `restore_value: true` n'était pas fiable pour ce type.

## Guidance

Encoder l'état à restaurer dans un global `int` représentant un code d'énumération, et dériver la chaîne affichable dans un `text_sensor` template via un lambda `switch/case`.

**Étape 1 — Déclarer le global int avec restore :**

```yaml
globals:
  - id: g_ph_last_result_code
    type: int
    restore_value: True
    initial_value: '0'
```

`initial_value: '0'` est le sentinel "jamais calibré" — la valeur par défaut si le slot NVS est vide (premier boot ou flash effacé).

**Étape 2 — Exposer la chaîne via un text_sensor template :**

```yaml
text_sensor:
  - platform: template
    name: pH Calibration Last Result
    entity_category: diagnostic
    id: ph_last_result_sensor
    lambda: |-
      // Table autoritative des codes (co-localisée avec le switch).
      //   0 -> "Jamais calibré"               (premier boot)
      //   1 -> "OK pente=X.XXX, intercept=Y.YYY"  (succès, recalcul dynamique)
      //   2 -> "Rejet: V_pH7<=V_pH4..."        (R4 garde-fou, bains inversés)
      //   3 -> "Rejet: pente=X.XX hors plage"  (R5 garde-fou, dynamique)
      //   4 -> "Echec: capteur indispo (pH 7)" (NaN sur capture pH 7)
      //   5 -> "Echec: capteur indispo (pH 4)" (NaN sur capture pH 4)
      //   6 -> "Echec: capture pH 7 instable"  (spread > 50 mV pH 7)
      //   7 -> "Echec: capture pH 4 instable"  (spread > 50 mV pH 4)
      //   8 -> "Reset usine"                   (bouton reset)
      char buf[80];
      switch (id(g_ph_last_result_code)) {
        case 1:
          snprintf(buf, sizeof(buf), "OK pente=%.3f, intercept=%.3f",
                   id(g_ph_slope), id(g_ph_intercept));
          return {std::string(buf)};
        case 2:
          return {std::string("Rejet: V_pH7<=V_pH4 (bains inversés ?)")};
        case 3: {
          // Zero-guard sur le denominator : sous partial NVS restore,
          // code=3 peut être restauré avec v7=v4=0. On retourne 0
          // plutôt que +inf.
          float denom = id(g_v_ph7) - id(g_v_ph4);
          float rejected_slope = (denom != 0.0f) ? 3.0f / denom : 0.0f;
          snprintf(buf, sizeof(buf), "Rejet: pente=%.2f hors plage [2.5, 5.0]",
                   rejected_slope);
          return {std::string(buf)};
        }
        case 4:
          return {std::string("Echec: capteur indispo (pH 7)")};
        case 5:
          return {std::string("Echec: capteur indispo (pH 4)")};
        case 6:
          return {std::string("Echec: capture pH 7 instable")};
        case 7:
          return {std::string("Echec: capture pH 4 instable")};
        case 8:
          return {std::string("Reset usine")};
        default:
          // Code inconnu (n > 8 ou négatif) — fallback informatif.
          return {std::string("Jamais calibré")};
      }
```

**Étape 3 — Écrire le code int à chaque chemin de sortie du script :**

```yaml
# Dans le script _ph_calibration :
- lambda: |-
    id(g_ph_last_result_code) = 4;  // "Echec: capteur indispo (pH 7)"
    id(g_ph_abort) = true;
```

Chaque branche du script qui termine la calibration assigne un code différent. Le `text_sensor` est mis à jour via `component.update: ph_last_result_sensor` ou par polling automatique (`update_interval`).

**Convention de table co-localisée :** le commentaire listant tous les codes est positionné dans le lambda du `text_sensor`, pas dans le script. C'est le seul endroit où script et affichage se croisent — placer la table ici réduit le risque de désynchronisation.

## Why This Matters

- **Restore fiable :** un `int` de 4 bytes s'écrit et se relit en NVS de façon déterministe. Un `std::string` ne donne aucune garantie sur la taille du slot alloué ; le firmware peut silencieusement afficher une chaîne vide ou corrompue après reboot.
- **Flash compact :** 4 bytes en NVS vs. la longueur variable de la chaîne. Sur ESP32 avec partition NVS limitée, la différence est non négligeable si plusieurs globals string coexistent.
- **Strings centralisées :** modifier une formulation, ajouter un code, ou préparer une traduction se fait en un seul endroit (le lambda du `text_sensor`). Sans ce pattern, les chaînes seraient dispersées dans le script et en NVS.
- **Default sentinel :** le `default:` du switch attrape les codes oubliés ou futurs. Une valeur inconnue s'affiche lisiblement au lieu de provoquer un affichage vide ou une erreur silencieuse.

Ne pas appliquer ce pattern sur un global `std::string` avec `restore_value: true` peut conduire à un diagnostic trompeur : l'ESP affiche "Jamais calibré" après chaque reboot alors que la calibration avait réussi, ou pire, affiche une chaîne corrompue sans erreur visible.

## When to Apply

- Tout global ESPHome dont la valeur doit survivre au reboot **et** qui sert à afficher un texte dans Home Assistant.
- L'ensemble des états possibles est fini et connu à la compilation (enum de résultats, états machine, codes d'erreur).
- Deux globals float ou int supplémentaires sont acceptables pour porter les parties dynamiques du message (ex. : pente + intercept pour le cas `case 1`).

Ne pas appliquer si l'état à persister est véritablement une chaîne arbitraire de longueur variable — dans ce cas, il faut reconsidérer l'architecture (stocker en SPIFFS/LittleFS, ou ne pas restaurer).

## Examples

**Avant (fragile) :**

```yaml
globals:
  - id: g_ph_last_result
    type: std::string
    restore_value: True
    initial_value: '"Jamais calibré"'

text_sensor:
  - platform: template
    name: pH Calibration Last Result
    lambda: |-
      return {id(g_ph_last_result)};

# Dans le script :
- lambda: |-
    id(g_ph_last_result) = "Echec: capteur indispo (pH 7)";
```

Problème : après reboot, `g_ph_last_result` peut être vide ou tronqué. Le `text_sensor` affiche une chaîne vide sans aucun signal d'erreur.

**Après (pattern int enum, commit eb31048) :**

```yaml
globals:
  - id: g_ph_last_result_code
    type: int
    restore_value: True
    initial_value: '0'

text_sensor:
  - platform: template
    name: pH Calibration Last Result
    entity_category: diagnostic
    lambda: |-
      // 0=Jamais calibré, 1=OK, 2=Rejet bains inversés, 3=Rejet pente,
      // 4=NaN pH 7, 5=NaN pH 4, 6=spread pH 7, 7=spread pH 4, 8=Reset usine
      switch (id(g_ph_last_result_code)) {
        case 1: /* snprintf("OK pente=...") */
        case 2: return {std::string("Rejet: V_pH7<=V_pH4 (bains inversés ?)")};
        case 3: /* snprintf("Rejet: pente=X.XX hors plage") avec zero-guard */
        // cases 4..8 ...
        default: return {std::string("Jamais calibré")};
      }

# Dans le script :
- lambda: |-
    id(g_ph_last_result_code) = 4;
    id(g_ph_abort) = true;
```

Après reboot, le code `4` est restauré fidèlement depuis NVS, et le `text_sensor` affiche "Echec: capteur indispo (pH 7)" sans ambiguïté.

**Fichier de référence :** `packages/ph.yaml`, PR #9, commit eb31048.

## Related

- [packages/ph.yaml](../../packages/ph.yaml) — implémentation complète du pattern
- [docs/solutions/architecture/antifreeze-nan-silent-failure.md](../architecture/antifreeze-nan-silent-failure.md) — autre exemple de défaillance silencieuse dans les lambdas ESPHome
