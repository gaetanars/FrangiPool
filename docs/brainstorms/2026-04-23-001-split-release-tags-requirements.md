---
date: 2026-04-23
topic: split-release-tags
---

# Split firmware and PCB releases into independent tag-triggered workflows

## Problem Frame

Le monorepo partage aujourd'hui une seule workflow [release.yml](../../.github/workflows/release.yml) déclenchée par les tags `v[0-9]+.[0-9]+.[0-9]+`. Chaque release bundle firmware + `gerber.zip`, même quand le PCB n'a pas changé. L'unique CHANGELOG à la racine mélange les deux historiques et une note conditionnelle `"PCB inchangé depuis X"` est injectée dans le body pour dissiper l'ambiguïté.

Résultat : firmware et PCB partagent un cycle de vie forcé. Un patch PCB oblige à bumper le firmware (et inversement), la release d'un composant pollue les notes de l'autre, et la conditionnelle de composition de body est le genre d'asymétrie qui tend à s'étendre à chaque nouveau cas particulier.

Le changement cible : deux workflows miroirs, chacune déclenchée par son propre préfixe de tag, chacun écrivant dans son propre CHANGELOG. Cycle de vie indépendant, zéro conditionnelle de scope dans la CI.

**Reframe assumé** : la douleur citée (note PCB-inchangé conditionnelle + CHANGELOG mixte) est un symptôme ; le remède choisi est la division des cycles de vie, pas le minimum pour éliminer la conditionnelle actuelle. Ce choix est volontairement plus ambitieux que "simplifier la CI".

**Coût du statu quo** : la conditionnelle `PCB-inchangé` n'a pas encore tiré en production (le monorepo merge est récent, aucune release depuis). Historique PCB depuis `frangipool/pcb@v0.1.0` (2023-06-08) : une seule révision matérielle sur ~3 ans. Cadence PCB attendue ≤1/an. Les deux workflows miroirs introduisent ~20 lignes dupliquées (R3) contre une conditionnelle existante de ~15 lignes dans `release.yml` — coût récurrent similaire. Le gain : la classe entière de conditionnelles "est-ce que l'autre composant a changé" disparaît, pas seulement la conditionnelle existante. À cadence PCB ~1/an le gain est modeste mais durable si la surface PCB s'active.

## Requirements

**Release workflows**

- R1. Le tag `vX.Y.Z` déclenche exclusivement une release firmware (pas de `gerber.zip` attaché).
- R2. Le tag `pcb-X.Y.Z` déclenche exclusivement une release PCB (asset `gerber.zip` obligatoire, validé via le pattern `grep -qE '\.(GTL|GBL|GKO|GBS|GTO|GTS|DRL)$'` hérité de la Garde C12 actuelle de [release.yml](../../.github/workflows/release.yml)).
- R3. Les deux workflows conservent les garde-fous existants de [release.yml](../../.github/workflows/release.yml) : tag-sur-`origin/main`, refus si la release existe déjà, ordering commit-CHANGELOG-puis-publish, heredoc à délimiteur aléatoire, `timeout-minutes: 15`, pinning SHA des actions tierces. Elles partagent un `concurrency:` group `release-main` pour sérialiser tout accès à `main` (auto-commit CHANGELOG) en cas de push simultané de tags `v*` et `pcb-*` sur le même commit.
- R4. La workflow PCB publie avec `makeLatest: false`. La workflow firmware conserve `makeLatest: legacy`.
- R5. La conditionnelle "PCB inchangé depuis X" disparaît (plus de body composé dynamiquement).

**CHANGELOG**

- R6. `CHANGELOG.md` à la racine devient le changelog firmware seul. La workflow firmware invoque `requarks/changelog-action` en mode `fromTag`/`toTag` (voir Key Decisions) avec `excludeScopes: changelog,pcb` et `changelogFilePath: CHANGELOG.md`.
- R7. `pcb/CHANGELOG.md` devient le changelog PCB seul. La workflow PCB invoque `requarks/changelog-action` en mode `fromTag`/`toTag` avec `excludeScopes: changelog` et `changelogFilePath: pcb/CHANGELOG.md`.
- ~~R8~~ (retiré — voir Scope Boundaries). La section "Pre-monorepo history" de `CHANGELOG.md` reste inchangée ; le bootstrap via tag annotated `pcb-0.1.0` (R9) donne à `pcb/CHANGELOG.md` sa baseline reachable sans manipulation manuelle des entrées archivales.

**Migration et continuité**

- R9. Premier tag PCB sous le nouveau schéma : `pcb-0.1.1` (continuation directe du `v0.1.0` importé depuis `frangipool/pcb`). **Bootstrap** : pousser d'abord un tag annotated `pcb-0.1.0` sur le commit d'import monorepo (`7ea5eab feat(pcb): import hardware design from frangipool/pcb@cfd2e9f`) pour donner à `git tag --list 'pcb-*' --sort=-v:refname` une baseline reachable. Alternative (choix de planning) : la workflow PCB gère explicitement le cas "pas de tag `pcb-*` précédent" en diffant contre ce SHA d'import pour le premier run uniquement — ajoute une branche temporaire à la workflow, décision à trancher en planning.
- R10. Prochain tag firmware sous le nouveau schéma : semver suivant (ex. `v0.2.0` ou `v0.1.1` selon le contenu). Aucun retagging des tags existants `v0.0.1` / `v0.1.0`.

**Documentation**

- R11. La section "Couper une release" de [README.md](../../README.md) est scindée en deux procédures distinctes : une pour firmware (`v*`), une pour PCB (`pcb-*`). La regex de chaque workflow et la procédure de tag initial et de correction forward-looking (delete release + retag après coup) sont documentées par composant — distincte de l'exclusion historique en Scope Boundaries.

## Visual Aid

```
Avant (unifié) :
  tag vX.Y.Z  --->  release.yml  --->  CHANGELOG.md (tout)
                                       + gerber.zip attaché (toujours)
                                       + "PCB inchangé depuis …" si applicable

Après (split) :
  tag vX.Y.Z      --->  release-firmware.yml  --->  CHANGELOG.md (firmware)
                                                    pas d'asset
                                                    fromTag/toTag (prev v*)
                                                    excludeScopes: changelog,pcb
                                                    makeLatest: legacy

  tag pcb-X.Y.Z   --->  release-pcb.yml       --->  pcb/CHANGELOG.md (PCB)
                                                    gerber.zip (validé)
                                                    fromTag/toTag (prev pcb-*)
                                                    excludeScopes: changelog
                                                    makeLatest: false

  concurrency group partagé `release-main` entre les deux workflows.
```

## Success Criteria

- Publier une révision PCB (ex. `pcb-0.1.1`) ne crée aucun effet de bord sur le badge "latest release", sur `CHANGELOG.md`, ou sur les notes d'une future release firmware.
- Publier un firmware (ex. `v0.2.0`) ne produit aucun `gerber.zip` et n'imprime aucune mention de l'état du PCB dans le body.
- Chacune des deux workflows est lisible de haut en bas sans branche conditionnelle liée à "est-ce que l'autre composant a changé".
- Les garde-fous énumérés en R3 sont présents dans les deux fichiers — la duplication est assumée (cf. Key Decisions).

## Scope Boundaries

- **Hors scope : extraire les garde-fous partagés (tag-sur-main, release-exists, heredoc, step summary) en composite action `.github/actions/release-guard`.** La duplication de ~20 lignes entre deux fichiers est acceptée ; une composite action recréerait une dépendance partagée qui pollue exactement la séparation qu'on cherche à établir.
- **Hors scope : splitter `validate.yml`.** Le `paths-ignore` actuel est une optimisation de déclenchement, pas une conditionnelle sémantique. Laisser tel quel.
- **Hors scope : retagging des tags existants `v0.0.1` / `v0.1.0`.** Historiques, non republiables.
- **Hors scope : ajout d'un asset firmware (binaire compilé ESPHome, archive des presets, etc.).** Les presets sont consommés directement depuis `github://` ; une release sans asset reste fonctionnelle.
- **Hors scope : ajout d'une validation CI des Gerbers sur les PR qui touchent `pcb/`.** Peut venir plus tard si la surface PCB s'active, aujourd'hui non justifié.
- **Hors scope : redécouper la section "Pre-monorepo history" de `CHANGELOG.md`.** Le bootstrap via tag annotated `pcb-0.1.0` (R9) donne déjà à `pcb/CHANGELOG.md` une baseline reachable. Les entrées archivales (firmware v0.1.0 + pcb v0.1.0 + URLs `frangipool/pcb`) restent inchangées — aucun édit manuel de contenu archival.

## Key Decisions

- **Tag firmware reste `vX.Y.Z`** : préserve la continuité avec l'historique (`v0.0.1`, `v0.1.0`) et la convention usuelle "v = code release". L'asymétrie avec `pcb-X.Y.Z` est le prix à payer pour ne pas casser deux tags.
- **Deux CHANGELOGs séparés** : seul moyen d'avoir un vrai cycle de vie indépendant sans scope-filtering acrobatique. `pcb/CHANGELOG.md` existe déjà (archive de l'ancien dépôt), il devient le changelog vivant du PCB.
- **Filtrage par range scopée au composant (`fromTag`/`toTag`)** : les deux workflows utilisent le mode `fromTag`/`toTag` de `requarks/changelog-action` avec le `toTag` précalculé par une step shell `git tag --list '<prefix>*' --sort=-v:refname | sed -n '2p'`. Le mode `tag:` par défaut du action fait un `git describe` non-préfixé — il renverrait le dernier tag toutes catégories confondues (ex : `v0.2.0` lors d'un run sur `pcb-0.1.1`), provoquant soit un échec `Provided tag doesn't match latest tag`, soit un changelog PCB rempli de commits firmware. `fromTag`/`toTag` court-circuitent ce lookup. Firmware exclut aussi `scope(pcb)` pour couvrir les rares commits touchant `pcb/` en dehors d'un tag PCB.
- **PCB `makeLatest: false`** : les releases PCB ne doivent jamais déplacer le badge "latest release" de GitHub, qui reste réservé au firmware — composant avec le cycle de vie le plus actif.
- **Pas d'extraction en composite action** : YAGNI. Deux fichiers, ~20 lignes dupliquées. L'alternative crée un couplage qu'on supprime justement.
- **Co-location du code, indépendance des releases** : le merge monorepo (`b5573bb`) a unifié la source-of-truth et l'outillage — acquis préservé. Ce split réintroduit uniquement l'axe de release ; aucun fichier ne bouge, aucune référence croisée ne casse. Firmware et PCB sont deux composants qui co-évoluent sur des cadences différentes, et les deux workflows reflètent cette asymétrie sans la recréer au niveau du code.

## Dependencies / Assumptions

- `requarks/changelog-action@v1.10.3` accepte l'input `changelogFilePath` (default `CHANGELOG.md`) qui supporte un chemin arbitraire incluant `pcb/CHANGELOG.md` — vérifié dans l'action.yml au SHA `b78a3354`.
- Le mode `fromTag`/`toTag` de `requarks/changelog-action` accepte des valeurs de tag arbitraires (bypass du lookup GraphQL par commit-date). Le `toTag` vide (premier run d'un préfixe, avant le tag bootstrap) doit être géré explicitement par la step shell — cf. R9.
- Les guards actuels (tag-on-main, release-exists, heredoc) sont portables tels quels dans les deux nouvelles workflows — aucune dépendance à la nature "firmware vs PCB" du tag.
- Aucune automatisation externe (GitHub Apps, webhooks downstream) ne consomme actuellement les releases avec une attente sur le prefix `v*`. Si cette supposition est fausse, ajouter une note de compatibilité dans R11.

## Outstanding Questions

### Resolve Before Planning

_(aucune — toutes les décisions produit sont prises)_

### Deferred to Planning

- [Affects R6, R7][Technical] L'input `changelogFilePath` est confirmé comme supportant `pcb/CHANGELOG.md`. Reste à valider en planning que l'action génère un body cohérent quand le fichier cible n'existe pas encore à la racine attendue (comportement initial).
- [Affects R9][Technical] Choix entre (a) tag annotated `pcb-0.1.0` baseline sur le commit d'import, (b) branche de workflow gérant le cas "pas de tag `pcb-*` précédent". Option (a) recommandée par simplicité — à trancher en planning.
- [Affects R11][Technical] Le `dashboard_import.package_import_url` des presets pointe sur `@main` ; faut-il ajouter une recommandation dans README pour épingler au dernier tag firmware ? Lié mais non bloquant.

## Next Steps

-> `/ce-plan` for structured implementation planning
