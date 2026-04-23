---
title: "refactor: Split firmware and PCB releases into independent tag-triggered workflows"
type: refactor
status: active
date: 2026-04-23
origin: docs/brainstorms/2026-04-23-001-split-release-tags-requirements.md
---

# refactor: Split firmware and PCB releases into independent tag-triggered workflows

## Overview

Remplace la workflow unifiée [release.yml](../../.github/workflows/release.yml) (tag `v*.*.*`, bundle firmware + `gerber.zip`, note conditionnelle "PCB inchangé") par deux workflows miroirs — `release-firmware.yml` sur les tags `v*.*.*` et `release-pcb.yml` sur les tags `pcb-*.*.*`. Chaque workflow écrit dans son propre CHANGELOG, publie un asset correspondant à son composant (aucun pour firmware, `gerber.zip` pour PCB), et partage un `concurrency:` group `release-main` pour sérialiser les commits CHANGELOG sur `main` en cas de push simultané de tags. Le filtrage des release notes se fait via le mode `fromTag`/`toTag` de `requarks/changelog-action` avec le tag précédent précalculé par prefix, éliminant la prefix-blindness de `git describe`.

## Problem Frame

Voir [l'origine](../brainstorms/2026-04-23-001-split-release-tags-requirements.md#problem-frame) pour la motivation produit. Synthèse : firmware et PCB partagent un cycle de vie forcé, la release d'un composant pollue les notes de l'autre, et la conditionnelle de body introduit une asymétrie qui tend à s'étendre. Ce plan matérialise le choix "deux workflows, deux tags, deux CHANGELOGs" décidé dans le brainstorm.

## Requirements Trace

- R1. Tag `vX.Y.Z` déclenche exclusivement une release firmware (pas d'asset) — Unit 2.
- R2. Tag `pcb-X.Y.Z` déclenche exclusivement une release PCB (asset `gerber.zip` validé via Garde C12) — Unit 3.
- R3. Garde-fous hérités + concurrency group `release-main` partagé — Units 2, 3.
- R4. Firmware `makeLatest: legacy`, PCB `makeLatest: false` — Units 2, 3.
- R5. La conditionnelle "PCB inchangé depuis X" disparaît (suppression de release.yml) — Unit 4.
- R6. `CHANGELOG.md` firmware seul, mode `fromTag`/`toTag`, `excludeScopes: changelog,pcb` — Unit 2.
- R7. `pcb/CHANGELOG.md` PCB seul, mode `fromTag`/`toTag`, `excludeScopes: changelog` — Unit 3.
- R9. Premier tag PCB `pcb-0.1.1`, bootstrap via seed `pcb-0.1.0` annotated — Units 1, 3.
- R10. Prochain tag firmware semver suivant ; pas de retagging — Unit 5 (runbook) + Documentation/Operational Notes (checklist post-merge).
- R11. README "Couper une release" scindé en deux procédures — Unit 5.

(R8 retiré du plan, cf. Scope Boundaries.)

## Scope Boundaries

- **Hors scope : extraction des garde-fous partagés en composite action.** ~20 lignes dupliquées entre les deux workflows ; l'alternative recréerait un couplage qu'on supprime justement.
- **Hors scope : splitter `validate.yml`.** Le `paths-ignore` existant reste tel quel.
- **Hors scope : retagging de `v0.0.1` / `v0.1.0`.** Historiques, intouchés.
- **Hors scope : ajout d'un asset sur les releases firmware.** Les presets sont consommés via `github://`, pas besoin d'archive.
- **Hors scope : validation CI des Gerbers sur les PRs qui touchent `pcb/`.** À faire plus tard si la surface PCB s'active.
- **Hors scope : redécouper la section "Pre-monorepo history" de `CHANGELOG.md`.** Le seed tag `pcb-0.1.0` donne à `pcb/CHANGELOG.md` sa baseline reachable sans édit manuel.
- **Hors scope : recommandation de pinning `@main` → tag firmware dans les presets.** Concern séparé, non bloquant.

## Context & Research

### Relevant Code and Patterns

- [.github/workflows/release.yml](../../.github/workflows/release.yml) — workflow actuel (117 lignes, 8 failure modes mitigés en commit `cf1d2c3`). Sert de base dont les deux nouvelles héritent les garde-fous.
- [.github/workflows/validate.yml](../../.github/workflows/validate.yml) — pattern pour SHA-pinning et minimal permissions.
- [CHANGELOG.md](../../CHANGELOG.md) + [pcb/CHANGELOG.md](../../pcb/CHANGELOG.md) — déjà existants ; `pcb/CHANGELOG.md` contient un `## [v0.1.0] - 2023-06-08` archival qui sert d'ancre d'insertion pour `requarks/changelog-action`.
- [README.md](../../README.md) ligne 254 "Couper une release" — section à scinder en deux.

### Institutional Learnings

- [docs/solutions/architecture/tag-triggered-release-workflow-hardening.md](../solutions/architecture/tag-triggered-release-workflow-hardening.md) — les 8 garde-fous hardenés (heredoc délimiteur aléatoire, commit-avant-publish, fail-fast si release existe, makeLatest legacy, timeout, asset validation, prev-tag via git describe, README runbook) transfèrent verbatim aux deux nouvelles workflows. Le document mentionne aussi 5 residual risks dont `concurrency:` group — ce plan résout celui-là via le group partagé.

### External References

- Vérification directe du source `Requarks/changelog-action@b78a3354` : l'action expose `fromTag` + `toTag` comme inputs alternatifs au mode `tag:`, bypassant le lookup GraphQL `refs(first: 2, orderBy: TAG_COMMIT_DATE)` qui est la cause racine de la prefix-blindness. Input de fichier : `changelogFilePath` (default `CHANGELOG.md`).

## Key Technical Decisions

- **Mode `fromTag`/`toTag` avec tag précédent calculé en shell step** (R6, R7). Le mode par défaut `tag:` utilise `git describe` sans filtre de préfixe, ce qui sur `pcb-0.1.1` renvoie le dernier tag toutes catégories (`v0.2.0`) et pollue le changelog ou fait échouer l'action (`latestTag.name !== tag`). Pattern shell hardené : `prev_tag=$(git tag --list '<prefix>*' --sort=-v:refname | grep -v -Fx "${github.ref_name}" | head -n1)` suivi d'un guard `if [ -z "$prev_tag" ]; then echo '::error::No previous <prefix>-* tag found.'; exit 1; fi`. Le `grep -v -Fx` retire le tag courant par nom (pas par position), ce qui reste correct sur un retag forward-looking d'une version non-latest ; le guard empty rend l'erreur de bootstrap (seed tag manquant, tag supprimé manuellement) bruyante au lieu de silencieuse.
- **Concurrency group `release-main` partagé entre les deux workflows** (R3). Sérialise tout accès à `main` (auto-commit CHANGELOG) en cas de push simultané `git push origin main v0.2.0 pcb-0.1.1`. `cancel-in-progress: false` pour queuer, pas interrompre. Per-workflow groups (`release-firmware` vs `release-pcb`) ne résoudraient PAS la race : elles serialisent les retags d'un même composant, pas la contention sur `main` entre composants.
- **Bootstrap PCB via seed tag annotated `pcb-0.1.0` sur le commit `b5573bb`** (R9). **Note d'implémentation (2026-04-23) :** le commit d'import original `7ea5eab` a été squash-merged dans PR #7 et est devenu unreachable depuis `main`. Le seed est donc posé sur le squash-merge `b5573bb feat: fusionner frangipool/pcb dans le monorepo + release workflow (#7)` — premier commit de `main` qui contient `pcb/`. Alternative (workflow-level special case "no previous tag") rejetée : ajoute une branche conditionnelle dans la workflow exercée une seule fois, coût permanent vs coût one-shot d'un tag push. Le seed tag reste protégé par un guard `if: github.ref_name != 'pcb-0.1.0'` au niveau job dans release-pcb.yml, rendant la workflow idempotente à un push du seed fait par erreur après merge — l'ordering Unit 1 avant PR merge devient une recommandation, plus une dépendance dure.
- **Tag-on-main guard refname-exact** (R3, inherited-and-upgraded). Au lieu de `git branch -r --contains "$SHA" | grep -q 'origin/main$'` (faux positif si un autre remote ou une branche `feat-main` existe — résidu connu de la learning doc), utiliser `git branch -r --contains "$SHA" --format='%(refname)' | grep -Fxq 'refs/remotes/origin/main'`. Match exact sur le refspec complet, immunisé au suffixe.
- **Conservation du glob de trigger identique au regex de l'origine** : `v[0-9]+.[0-9]+.[0-9]+` et `pcb-[0-9]+.[0-9]+.[0-9]+`. Rejette les suffixes `-rc`, `-test`, `-beta` — alignement avec la procédure documentée dans le README actuel.
- **Retrait de release.yml dans la même PR que l'ajout des deux nouvelles workflows** (Unit 5). Évite la fenêtre temporelle où (a) ajouter avant retirer déclencherait DEUX workflows sur le même tag `v*`, ou (b) retirer avant ajouter perdrait la release. Atomicité via PR unique.

## Open Questions

### Resolved During Planning

- **`changelogFilePath` supporte-t-il un chemin imbriqué (`pcb/CHANGELOG.md`) ?** Oui — vérifié dans action.yml à SHA `b78a3354` durant le review.
- **Le fichier cible doit-il préexister pour que l'action génère un body cohérent ?** Oui et c'est déjà le cas — `pcb/CHANGELOG.md` contient un H2 archival `## [v0.1.0] - 2023-06-08` qui sert d'ancre d'insertion. L'action insère les nouvelles entrées au-dessus du premier H2.
- **Sort stability de `git tag --list --sort=-v:refname` pour préfixes différents ?** Le glob `--list 'pcb-*'` filtre avant le sort. `-v:refname` gère correctement le tri semver à préfixe constant (ex : `pcb-0.1.10` > `pcb-0.1.2`). Le pattern shell hardené (skip-by-name via `grep -v -Fx`) est en plus indépendant de la position du tag courant, donc correct pour retag non-monotonique.
- **Le seed tag `pcb-0.1.0` déclenche-t-il un workflow existant ?** Non — le trigger actuel de release.yml est `v[0-9]+.[0-9]+.[0-9]+`, qui ne matche pas `pcb-*`. Seed push safe.

### Deferred to Implementation

- **Exact wording** de `permissions:` pour release-pcb.yml — à dériver du current release.yml (`contents: write`) qui couvre à la fois `release-action` et `git-auto-commit-action`.
- **Comportement de `ncipollo/release-action` avec `makeLatest: false` + `allowUpdates: true`** sur un retag — à observer au premier retag PCB réel. Pattern attendu : replace assets sans bouger le badge latest. Fallback : `gh release delete` puis retag.
- **Dry-run mechanism via `workflow_dispatch`** — pour dé-risquer la première release réelle, évaluer l'ajout d'un input booléen `dry_run` aux deux workflows qui saute l'auto-commit et release-create en imprimant le plan au `$GITHUB_STEP_SUMMARY`. Ajouté ~20 lignes/workflow + une sous-section README. Laissé en deferred : évaluer après la première release réelle ou si un bug post-merge justifie le coût d'ajout. Réduirait le résidual risk "no dry-run path" identifié dans la learning doc.

## High-Level Technical Design

> *Ce diagramme illustre les flux après le split — directional guidance pour review, pas spécification d'implémentation.*

```
Push commit --> main
                 │
                 ├── Push tag v0.2.0 ────────────────────┐
                 │                                        │
                 └── Push tag pcb-0.1.1 ───────────┐      │
                                                    │      │
                                                    ▼      ▼
                                   release-pcb.yml    release-firmware.yml
                                       │                   │
                                       ├── guard: tag on origin/main
                                       ├── guard: release-exists pre-check
                                       ├── shell: prev_tag=git tag --list 'pcb-*' ...
                                       ├── changelog-action (fromTag/toTag)
                                       │     → pcb/CHANGELOG.md
                                       ├── zip Gerbers + validate C12
                                       ├── compose body (heredoc randomisé)
                                       ├── git-auto-commit-action pcb/CHANGELOG.md
                                       │        ├────── concurrency: release-main ───────┤
                                       │                                                  │
                                       └── ncipollo/release-action                        │
                                            - makeLatest: false                           │
                                            - gerber.zip asset                            │
                                                                                          │
                                                                         shell: prev_tag=git tag --list 'v*' ...
                                                                         changelog-action (fromTag/toTag)
                                                                             → CHANGELOG.md (excludeScopes: changelog,pcb)
                                                                         compose body
                                                                         git-auto-commit-action CHANGELOG.md
                                                                         ncipollo/release-action
                                                                             - makeLatest: legacy
                                                                             - aucun asset
```

Le `concurrency: release-main` serialise les jobs de bout en bout : une seule workflow à la fois depuis le checkout jusqu'à la publication de release. C'est une sur-mitigation volontaire — on accepte la latence additionnelle sur un push combiné pour éliminer toute fenêtre de race sur `main`, et les releases GitHub n'ayant pas d'état partagé, la sérialisation complète n'introduit aucun coût de correction.

## Implementation Units

- [ ] **Unit 1: Push seed annotated tag `pcb-0.1.0`**

**Goal:** Donner à `git tag --list 'pcb-*' --sort=-v:refname` une baseline reachable pour le premier vrai tag PCB sous le nouveau schéma.

**Requirements:** R9.

**Dependencies:** Aucune (doit précéder Unit 2, mais no-op pour la CI actuelle).

**Files:**
- Aucun fichier modifié. Action locale `git tag -a pcb-0.1.0 b5573bb -m "..." && git push origin pcb-0.1.0`. (Cible `b5573bb` plutôt que `7ea5eab` parce que l'import original a été squash-merged et est unreachable depuis `main` — cf. note dans Key Technical Decisions.)

**Approach:**
- Tag annotated (pas lightweight) pour porter le message descriptif "Baseline imported from frangipool/pcb@v0.1.0 — seed for post-monorepo pcb-* release series".
- Cible le squash-merge `b5573bb feat: fusionner frangipool/pcb dans le monorepo + release workflow (#7)` — le premier commit reachable sur `main` où `pcb/` a atterri.
- Push avant le merge de la PR qui introduit `release-pcb.yml` : le trigger actuel `v[0-9]+.[0-9]+.[0-9]+` ne matche pas `pcb-*`, donc aucun workflow ne s'exécute.

**Patterns to follow:**
- Procédure de tag documentée dans [README.md "Couper une release"](../../README.md) (à scinder par Unit 5).

**Test scenarios:**
- Test expectation: none — opération one-shot de bootstrap tag, pas de comportement à couvrir.

**Verification:**
- `git ls-remote --tags origin | grep pcb-0.1.0` retourne le tag.
- Aucun run GitHub Actions ne s'est déclenché sur le push (vérifier l'onglet Actions).

---

- [ ] **Unit 2: Create `.github/workflows/release-firmware.yml`**

**Goal:** Workflow tag-triggered pour les releases firmware, miroir du current release.yml sans la logique PCB.

**Requirements:** R1, R3, R4, R6.

**Dependencies:** Unit 1 (pour l'atomicité PR).

**Files:**
- Create: `.github/workflows/release-firmware.yml`

**Approach:**
- Trigger : `on: push: tags: ['v[0-9]+.[0-9]+.[0-9]+']` — identique au current.
- `permissions: contents: write`, `timeout-minutes: 15`, SHA-pinned actions (copier les SHAs du current release.yml).
- `concurrency: { group: release-main, cancel-in-progress: false }`.
- Steps, dans l'ordre :
  1. `actions/checkout@...` avec `fetch-depth: 0` (requis pour `git describe` et l'historique complet).
  2. Guard tag-on-main (refname-exact, cf. Key Decisions) : `git fetch origin main && git branch -r --contains "${github.sha}" --format='%(refname)' | grep -Fxq 'refs/remotes/origin/main'`.
  3. Guard release-already-exists : `gh release view "${github.ref_name}" || proceed`.
  4. Shell pre-step : calcul du `prev_tag` hardené via `git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | grep -v -Fx "${github.ref_name}" | head -n1` → stocker dans `$GITHUB_OUTPUT`. Ajouter un guard `if [ -z "$prev_tag" ]; then echo '::error::No previous v-* tag found. Push a baseline tag first.'; exit 1; fi`.
  5. `requarks/changelog-action` en mode `fromTag`/`toTag` : `fromTag: ${github.ref_name}`, `toTag: ${steps.prev.outputs.prev_tag}`, `excludeScopes: changelog,pcb`, `excludeTypes: chore,style,build` (hérité du current release.yml pour préserver le filtre de bruit), `changelogFilePath: CHANGELOG.md`.
  6. Compose body (heredoc délimiteur `BODY_$(openssl rand -hex 16)`). PAS de note "PCB inchangé" — elle disparaît avec le split.
  7. `stefanzweifel/git-auto-commit-action` : `branch: main`, `commit_message: 'docs(changelog): update CHANGELOG.md for ${github.ref_name} [skip ci]'`, `file_pattern: CHANGELOG.md`.
  8. `ncipollo/release-action` : `allowUpdates: true`, `makeLatest: legacy`, `body: ${release_notes}`, **pas d'input `artifacts`** (firmware sans asset).
  9. Step summary logs à chaque étape significative.

**Patterns to follow:**
- [.github/workflows/release.yml](../../.github/workflows/release.yml) pour les SHAs pinned, la forme du heredoc, la procédure d'ordering commit-avant-publish, et les step summary.
- [docs/solutions/architecture/tag-triggered-release-workflow-hardening.md](../solutions/architecture/tag-triggered-release-workflow-hardening.md) §1–§8 pour les 8 garde-fous à reproduire.

**Test scenarios:**
- Happy path : push `v0.2.0` déclenche le run, `CHANGELOG.md` contient une nouvelle entrée `## [v0.2.0] - 2026-04-XX` avec les commits depuis `v0.1.0` excluant scopes `changelog` et `pcb`, une release GitHub est créée avec le body mais sans asset. ("Test" ici est end-to-end sur première release réelle — voir Unit 7.)
- Edge case : `prev_tag` vide (seed manquant, tag supprimé manuellement) → le guard shell remonte un `::error::No previous v-* tag found` et le job échoue avant toute mutation. L'opérateur pousse le tag baseline manquant ou répare la situation, puis retag.
- Edge case : retag forward-looking d'une version non-latest (ex : hotfix `v0.2.2` après que `v0.3.0` ait shipped) → le `grep -v -Fx` retire le tag courant par nom, donc `head -n1` renvoie le vrai prédécesseur sémantique même si le tag courant n'est pas en position 1 du sort.
- Error path : push tag depuis une feat branch non mergée → guard step 2 doit échouer avec `::error::Tag ... points to a commit absent from origin/main.`
- Error path : retag sans suppression préalable de la release → guard step 3 doit échouer avec message explicite de retag.

**Verification:**
- `esphome config` / linters YAML parsent le fichier sans erreur (`actionlint` optionnel si installé).
- Dry-run conceptuel : relire le fichier contre la checklist des 8 garde-fous dans la learning doc.

---

- [ ] **Unit 3: Create `.github/workflows/release-pcb.yml`**

**Goal:** Workflow tag-triggered pour les releases PCB, avec zip Gerbers validé, écriture dans `pcb/CHANGELOG.md`, et badge `latest` inchangé.

**Requirements:** R2, R3, R4, R7, R9.

**Dependencies:** Unit 1 (seed `pcb-0.1.0` doit exister pour que le shell pre-step trouve un prev tag sur `pcb-0.1.1`).

**Files:**
- Create: `.github/workflows/release-pcb.yml`

**Approach:**
- Trigger : `on: push: tags: ['pcb-[0-9]+.[0-9]+.[0-9]+']`.
- **Seed-tag idempotence guard** : au niveau job, `if: github.ref_name != 'pcb-0.1.0'` pour que le push du seed tag (accidentel ou volontaire) ne produise aucune release. Imprimer une ligne `$GITHUB_STEP_SUMMARY` explicite quand le guard saute ("Seed baseline tag skipped — no release created."). Rend la workflow idempotente à un push post-merge du seed, supprimant la dépendance d'ordering dure vs Unit 1.
- `permissions`, `timeout`, SHA-pinning, `concurrency: { group: release-main }` identiques à Unit 2.
- Steps additionnels vs Unit 2 :
  - Pre-step calcule le prev tag avec glob `pcb-*` au lieu de `v*` — même pattern hardené (grep -v -Fx + head -n1 + guard empty).
  - Guard tag-on-main refname-exact (identique à Unit 2).
  - Après l'action changelog, insère **avant le git-auto-commit** : `cd pcb/src && zip -r ../../gerber.zip .` puis validation C12 via `unzip -l gerber.zip | grep -qE '\.(GTL|GBL|GKO|GBS|GTO|GTS|DRL)$'`.
  - Compose body : PAS de note "PCB inchangé" non plus (un tag `pcb-*` implique que le PCB a changé par construction).
  - `git-auto-commit-action` avec `file_pattern: pcb/CHANGELOG.md` et `commit_message: 'docs(changelog): update pcb/CHANGELOG.md for ${github.ref_name} [skip ci]'` (nommage explicite du fichier touché pour l'audit trail).
  - `ncipollo/release-action` avec `makeLatest: false`, `artifacts: gerber.zip`.
- `changelog-action` inputs : `excludeScopes: changelog`, `excludeTypes: chore,style,build` (hérité du current release.yml), `changelogFilePath: pcb/CHANGELOG.md`.

**Patterns to follow:**
- Identique à Unit 2 — le squelette est le même, seules les valeurs diffèrent (glob, chemin CHANGELOG, makeLatest, présence de l'asset).

**Test scenarios:**
- Happy path : push `pcb-0.1.1` → run, `pcb/CHANGELOG.md` gagne une nouvelle entrée insérée au-dessus du `## [v0.1.0] - 2023-06-08` archival, release GitHub créée avec `gerber.zip` attaché, badge "latest release" reste sur le dernier firmware.
- Edge case : `pcb/src/` accidentellement vide → zip produit, `unzip -l` ne matche pas le pattern C12 → step échoue avec `::error::gerber.zip is missing Gerber/DRL files`.
- Error path : tag poussé sur feat branch → guard tag-on-main échoue.
- Error path : `pcb-0.1.1` retagé sans supprimer la release → guard release-exists échoue.
- Integration : après le run, `git log origin/main` contient `docs(changelog): update pcb/CHANGELOG.md for pcb-0.1.1 [skip ci]` (nom explicite du fichier, cf. Approach).
- Edge case : push accidentel de `pcb-0.1.0` après merge → le guard `if: github.ref_name != 'pcb-0.1.0'` fait skipper le job ; step summary affiche "Seed baseline tag skipped" ; aucune release créée.

**Verification:**
- Lint YAML OK.
- Checklist des 8 garde-fous + asset validation C12 présente.

---

- [ ] **Unit 4: Remove `.github/workflows/release.yml`**

**Goal:** Supprimer la workflow unifiée pour éviter le double-déclenchement sur tag `v*`.

**Requirements:** R5 (suppression de la conditionnelle PCB-inchangé, qui vit dans release.yml).

**Dependencies:** Units 2, 3 — doit être **dans le même commit / PR** que l'ajout des deux nouvelles workflows pour éviter :
- (a) fenêtre avec release.yml + release-firmware.yml tous deux actifs → double release sur `v0.2.0`
- (b) fenêtre sans release.yml avant release-firmware.yml → release perdue

**Files:**
- Delete: `.github/workflows/release.yml`

**Approach:**
- Suppression simple via `git rm`. Tout le contenu migre dans les deux nouvelles workflows.

**Patterns to follow:**
- N/A (suppression).

**Test scenarios:**
- Test expectation: none — suppression atomique dans la même PR que Units 2 et 3.

**Verification:**
- `git diff --stat` montre release.yml supprimé, release-firmware.yml + release-pcb.yml ajoutés dans le même commit ou la même PR.
- `gh workflow list` après merge : plus de "Release" standalone, seulement les deux nouvelles.

---

- [ ] **Unit 5: Update [README.md](../../README.md) "Couper une release" section**

**Goal:** Scinder la procédure actuelle en deux runbooks — un firmware, un PCB — distincts et auto-suffisants.

**Requirements:** R11.

**Dependencies:** Units 2, 3 (les procédures référencent les fichiers créés).

**Files:**
- Modify: `README.md` (section "Couper une release", autour ligne 254).

**Approach:**
- Remplacer la section unique par deux sous-sections : `### Couper une release firmware (v*)` et `### Couper une release PCB (pcb-*)`.
- Chaque sous-section documente : regex de trigger, checklist de pré-vol (`git status`, vérifier les commits Conventional Commits depuis le dernier tag matching), commande de tag push (`git tag vX.Y.Z && git push origin main vX.Y.Z`), commande de retag forward-looking (`gh release delete <tag> --yes && git tag -d <tag> && git push origin :refs/tags/<tag>` puis re-tagger), et vérification post-run (Actions tab + Releases page).
- Distinguer clairement retag forward-looking (en scope) vs. retag historique `v0.0.1`/`v0.1.0` (hors scope, cité ailleurs).
- **Guardrail seed tag PCB (critique) :** ajouter un encart explicite dans la sous-section PCB : `Le tag pcb-0.1.0 est un seed baseline immutable — NE JAMAIS le supprimer, le déplacer, ni le retagger. Il sert d'ancre pour git tag --list 'pcb-*' et sa disparition casse le prev_tag lookup de toutes les releases PCB futures.` La procédure de retag documentée s'applique explicitement aux tags `pcb-0.1.1` et suivants.
- Mettre à jour la phrase "Une release unifiée (firmware + `gerber.zip`)" qui ne s'applique plus.

**Patterns to follow:**
- Le runbook actuel dans [README.md:254](../../README.md) — structure à préserver (mêmes puces, mêmes types de garde-fou documentés), seulement dupliqué.

**Test scenarios:**
- Test expectation: none — document d'utilisateur, verif. humaine lors de la review.

**Verification:**
- Lecture par un opérateur qui ne connaît pas le changement : doit pouvoir couper une release firmware ET PCB sans chercher ailleurs.
- Pas de référence résiduelle à `release.yml` (singulier) ni à "release unifiée".

## System-Wide Impact

- **Interaction graph:** Les deux workflows interagissent uniquement via `main` (auto-commit CHANGELOG) et via le mécanisme `concurrency:`. Pas d'autre point de synchronisation. Le dashboard HA (homeassistant/dashboard/frangipool.yaml) n'est pas impacté — il ne consomme pas de release artifacts.
- **Error propagation:** Un guard qui échoue tôt (tag-on-main, release-exists) fait échouer le job entier avant toute mutation visible — comportement identique au current release.yml. La nouveauté : si `release-firmware.yml` échoue à committer `CHANGELOG.md` à cause d'une race `main` (normalement bloquée par concurrency), le `git-auto-commit-action` remonte l'erreur et la release GitHub n'est pas créée (ordering commit-avant-publish préservé).
- **State lifecycle risks:** Double-trigger si Unit 4 ne land pas dans la même PR que Units 2-3. Mitigation : atomicité PR explicite dans les dépendances d'Unit 4.
- **API surface parity:** Les consommateurs éventuels du badge `latest release` voient un comportement équivalent (firmware continue à déterminer "latest" via semver). Les consommateurs de `gerber.zip` ne voient plus l'asset sur les tags `v*` — seulement sur `pcb-*`. À signaler dans la description de release si des utilisateurs externes pinnaient sur l'asset firmware pour récupérer les Gerbers.
- **Integration coverage:** Unit 7 couvre le seul scénario cross-layer réaliste (push simultané).
- **Unchanged invariants:** `validate.yml` reste identique. La matrice des 8 presets ESPHome continue à s'exécuter sur PR/push de firmware comme avant. Le `paths-ignore: ['pcb/**', 'CHANGELOG.md', 'docs/**', 'README.md']` reste correct.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Double-trigger de workflows sur tag `v*` si release.yml n'est pas retiré dans la même PR que l'ajout de release-firmware.yml | Unit 4 dependency explicit sur atomicité ; revue PR doit vérifier le `git diff --stat`. |
| Seed tag `pcb-0.1.0` pushé APRÈS le merge de la PR | Guard `if: github.ref_name != 'pcb-0.1.0'` au niveau job de release-pcb.yml rend la workflow idempotente à ce scénario (pas de release créée, step summary explicite). Unit 1 reste ordonné avant le merge par recommendation. |
| Seed tag `pcb-0.1.0` supprimé par erreur (housekeeping, confusion avec v0.1.0 historique) → tous les pcb-* suivants cassent | Encart explicite "NE JAMAIS supprimer" dans la section PCB du README (Unit 5). Le guard empty du shell pre-step remonte un `::error::` bruyant si le cas arrive malgré tout. |
| `makeLatest: false` + `allowUpdates: true` interaction inattendue sur retag PCB | Observer au premier retag réel ; fallback documenté dans Unit 5 (delete + retag via `gh release delete`). |
| Step `git-auto-commit-action` sur `pcb/CHANGELOG.md` pourrait inclure par erreur d'autres fichiers si `file_pattern` est mal paramétré | `file_pattern` explicite pour chaque workflow (`CHANGELOG.md` vs `pcb/CHANGELOG.md`) ; lint PR. |
| Concurrency group `release-main` bloque sur un run zombie (p.ex. runner crash) → nouvelle release en queue indéfiniment | `timeout-minutes: 15` libère le slot après 15 min max. GitHub UI permet de cancel manuellement si besoin. |
| Sed/sort behavior diffère sur macOS vs Linux CI runner | CI tourne sur `ubuntu-latest` ; pattern `sed -n '2p'` + `sort -v:refname` portable Linux. |

## Documentation / Operational Notes

- README.md "Couper une release" (Unit 5) est la source canonique de la procédure runtime.
- Les docs de solutions existantes (hardening learning) restent valides — les 8 patterns qu'elles décrivent sont préservés dans les deux nouvelles workflows (dont 2 upgrades : refname-exact grep, shell prev_tag hardené).
- Pas de monitoring externe à mettre en place. L'onglet GitHub Actions suffit pour le MVP.
- Post-merge, mettre à jour la section `## [Unreleased]` de `CHANGELOG.md` pour noter "CI: split release workflow into firmware + PCB streams" sous type `chore` (le scope `changelog` sera filtré du changelog auto-généré grâce à `excludeScopes: changelog,pcb`).

### Post-merge validation checklist

Non-bloquant pour le merge — à exécuter sur la première paire de releases réelles (`v0.2.0` firmware ou `pcb-0.1.1` PCB, selon ce qui ship en premier). Couvre R10 (prochain tag firmware sous nouveau schéma, pas de retagging des historiques).

- Couper la première release firmware selon la nouvelle procédure du README :
  - Vérifier que release-firmware.yml déclenche seul, pas release-pcb.yml.
  - Vérifier que `CHANGELOG.md` a une nouvelle entrée `## [v0.2.0]`, SANS les commits scopés `pcb(*)` ou `changelog(*)` ou types `chore/style/build`.
  - Vérifier que la release GitHub n'a **aucun asset** attaché.
  - Vérifier que le badge "latest release" pointe sur `v0.2.0`.
- Couper la première release PCB selon la procédure PCB :
  - release-pcb.yml déclenche seul.
  - `pcb/CHANGELOG.md` reçoit l'entrée `## [pcb-0.1.1]` avec les commits depuis `pcb-0.1.0`, `gerber.zip` attaché et validé C12.
  - Badge "latest release" **ne bouge pas** — reste sur `v0.2.0` (ou plus récent firmware).
- Si les deux sont poussés sur le même SHA (`git push origin main v0.2.1 pcb-0.1.2`), vérifier que `concurrency: release-main` sérialise les auto-commits sans non-fast-forward.
- Si anomalie : archiver screenshots ou logs GitHub Actions dans une issue de suivi et itérer.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-23-001-split-release-tags-requirements.md](../brainstorms/2026-04-23-001-split-release-tags-requirements.md)
- Related code: [.github/workflows/release.yml](../../.github/workflows/release.yml), [.github/workflows/validate.yml](../../.github/workflows/validate.yml), [README.md](../../README.md)
- Learning: [docs/solutions/architecture/tag-triggered-release-workflow-hardening.md](../solutions/architecture/tag-triggered-release-workflow-hardening.md)
- External: `Requarks/changelog-action@b78a3354` — action.yml inspected for `fromTag`/`toTag` + `changelogFilePath` inputs
- Related PRs: #7 (monorepo merge) — squash-merge `b5573bb` is the Unit 1 seed target.
