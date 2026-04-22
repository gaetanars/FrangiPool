---
title: "feat: Fusionner frangipool/pcb dans le monorepo FrangiPool + release unifiée"
type: feat
status: active
date: 2026-04-22
---

# feat: Fusionner `frangipool/pcb` dans le monorepo FrangiPool + release unifiée

## Overview

Intégrer le contenu du repo `frangipool/pcb` (sur GitHub, cloné localement sous `../../frangipool/pcb`) dans le dépôt `gaetanars/FrangiPool` sous un répertoire `pcb/`, pour en faire un monorepo firmware + PCB. Ajouter une workflow GitHub Actions qui, à chaque tag `v*.*.*`, zippe les Gerbers PCB en `gerber.zip` et les attache à la GH release, en alimentant un `CHANGELOG.md` racine généré depuis les conventional commits.

## Problem Frame

Aujourd'hui, le firmware ESPHome et son PCB vivent dans deux dépôts GitHub distincts. Le PCB n'est plus maintenu activement (dernier commit : 2023-06-08, un unique release v0.1.0), mais reste la référence matérielle du projet. Les itérations firmware se font exclusivement dans `gaetanars/FrangiPool`, ce qui crée :

- Une asymétrie de maintenance (CI, releases, agents, documentation) entre les deux repos.
- Une friction pour quiconque veut fabriquer la carte ET flasher le firmware : deux clones, deux tags indépendants, deux README.
- Un repo source (`frangipool/pcb`) dont la release v0.1.0 (2023-06-08) et le CHANGELOG référencent des URLs qui tomberont si le repo est supprimé — aucune garantie de pérennité.

Regrouper les deux sous `gaetanars/FrangiPool` avec un tagging/release unifié résout ces points et permet aux futurs changements matériels de suivre le même cycle qu'une modification firmware.

## Requirements Trace

- **R1.** Tout le contenu versionné de `frangipool/pcb` (README, CHANGELOG, `src/` gerbers, `images/Vue_2D.svg`) se retrouve sous `pcb/` dans le monorepo.
- **R2.** Un tag `v*.*.*` poussé sur `main` déclenche une GH release qui attache `gerber.zip` (contenu de `pcb/src/`).
- **R3.** Les release notes sont générées depuis les conventional commits et maintenues dans un `CHANGELOG.md` racine auto-commité.
- **R4.** La CI `validate.yml` existante (matrice 8 presets ESPHome) n'est pas régressée par la fusion, et ne se déclenche pas pour des changements exclusivement PCB.
- **R5.** Les URLs `dashboard_import.package_import_url` des presets (`github://gaetanars/FrangiPool/packages/<name>.yaml@main`) continuent de fonctionner à l'identique.
- **R6.** La nouvelle workflow est durcie au même niveau que `validate.yml` après `fe9a302` : actions SHA-pinnées, permissions minimales explicites.

## Scope Boundaries

- **Hors scope :** migration du tagging existant (les tags `v0.0.1` / `v0.1.0` côté `gaetanars/FrangiPool` restent tels quels — pas de retag historique).
- **Hors scope :** ré-écriture des URLs `dashboard_import` pour qu'elles pointent sur un tag plutôt que `@main` (changement orthogonal, à traiter séparément si souhaité).
- **Hors scope :** compilation firmware en CI (`esphome compile`) et attachement de `.bin` à la release — les utilisateurs flashent via ESPHome dashboard et n'ont pas besoin d'artefacts binaires.
- **Hors scope :** réorganisation de l'arborescence firmware (`packages/`, `salt_*.yaml`, `homeassistant/`) sous un préfixe `firmware/`. Symétrie parfaite non nécessaire ; coût de réécriture des URLs élevé.
- **Non-goal :** préservation de l'historique git des 4 commits de `frangipool/pcb`. Décision utilisateur : copie plate.

### Deferred to Separate Tasks

- **Archivage du repo `frangipool/pcb`** : décision utilisateur — laisser tel quel pour l'instant. À reconsidérer une fois la fusion validée.
- **Pinning des presets sur un tag monorepo** : remplacer `@main` par `@v<x.y.z>` dans les `dashboard_import` pour obtenir une traçabilité tag → firmware. Ouvert en follow-up.

## Context & Research

### Relevant Code and Patterns

- `.github/workflows/validate.yml` (sur `feat/esphome-standalone-filtration`, pas encore mergé dans main via PR #6) : référence interne du niveau de durcissement attendu. Minimal permissions (`contents: read`), `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2` SHA-pinné, pin `esphome==2026.3.3`. Commit de durcissement : `fe9a302`.
- `README.md` (racine) : structure existante — une section PCB viendra s'insérer en bas, au-dessus de la section "Liens utiles" ou "Licence" (à déterminer au moment de l'édition).
- `.gitignore` sur `feat/esphome-standalone-filtration` : `.esphome`, `secrets.yaml`, `todos/`. Pas de conflit avec `pcb/`.
- `secrets.example.yaml` : modèle du pattern "seed factice en CI" que `validate.yml` utilise. La release workflow n'a pas besoin de secrets — la CI PCB est strictement du zip + upload.

### Institutional Learnings

- `docs/solutions/architecture/` contient 3 learnings (antifreeze NaN, script mode queued, redox regulation) — tous firmware. Aucun learning existant sur CI/release. Ce plan peut produire un post-mortem court dans `docs/solutions/` si la release workflow expose un gotcha lors du premier run.
- CLAUDE.md (gitignored, local agent guide) documente la discipline packages ESPHome — rien à préserver côté PCB puisque le PCB est indépendant.

### External References

- Pas de recherche externe conduite. Le terrain (GitHub Actions release + zip, conventional changelog) est bien connu ; les pratiques 2026 usuelles sont : SHA-pin toutes les actions tierces, permissions minimales explicites, préférer `zip` shell natif aux actions wrapper quand c'est trivial. La workflow source `frangipool/pcb/.github/workflows/release.yml` sert de référence de base mais doit être durcie.

## Key Technical Decisions

- **Copie plate plutôt que `git subtree add`** (choix utilisateur) : 4 commits source de faible valeur historique ; un unique commit `feat(pcb): import hardware design from frangipool/pcb` avec mention du SHA source `cfd2e9f` dans le message pour traçabilité suffit.
- **Release PCB uniquement** (choix utilisateur) : le firmware ESPHome est consommé via `dashboard_import` — pas de binaire à distribuer. La workflow zippe uniquement `pcb/src/`.
- **CHANGELOG racine unifié + auto-commit** (choix utilisateur) : `requarks/changelog-action@v1` alimente un `CHANGELOG.md` racine à chaque tag. Les entrées historiques (PCB v0.1.0 2023-06-08 et firmware v0.1.0 2026-04-06) sont inscrites manuellement dans une section "Pre-monorepo history" au bas du fichier. L'action `stefanzweifel/git-auto-commit-action` pousse la mise à jour sur `main`.
- **Actions SHA-pinnées + permissions minimales** : calqué sur `fe9a302`. `contents: write` explicite uniquement sur le job release (nécessaire pour l'auto-commit et la création de release) ; aucune autre permission.
- **Zip via shell natif** plutôt que `thedoctor0/zip-release@0.7.1` : une ligne `zip -r gerber.zip .` dans un job `working-directory: pcb/src` — zéro dépendance tierce, plus simple à auditer.
- **`paths-ignore` sur `validate.yml`** : ajouter `pcb/**`, `CHANGELOG.md`, `docs/**` pour éviter de relancer la matrice 8 presets sur un changement purement PCB/docs.
- **Branche de travail : `feat/monorepo-pcb`, basée sur `main` après merge de PR #6** : l'alternative (stacker sur `feat/esphome-standalone-filtration`) mélangerait deux changements orthogonaux dans une même revue. Si PR #6 traîne, acceptable de stacker en branchant depuis `feat/esphome-standalone-filtration`, avec rebase après merge — décision au moment d'exécuter.
- **Tag Keep-a-Changelog, commits Conventional Commits** : le repo respecte déjà Conventional Commits dans son historique récent (`feat(...)`, `fix(...)`, `chore(...)`). `requarks/changelog-action@v1` parse ces préfixes nativement.

## Open Questions

### Resolved During Planning

- **Stratégie de fusion git** → Copie plate.
- **Scope release** → PCB uniquement.
- **CHANGELOG** → Racine unifié + auto-commit via requarks.
- **Repo source** → Laisser tel quel (pas d'archivage pour l'instant).
- **Durcissement workflow** → SHA-pin + permissions minimales (aligné `fe9a302`).

### Deferred to Implementation

- **Version du prochain tag** : décidé au moment de pousser le tag. Pas de contrainte planification. Candidat naturel : `v0.2.0` (bump mineur — import PCB + release workflow = non breaking sur les URLs).
- **Ligne exacte d'insertion de la section PCB dans `README.md`** : à juger au moment de l'édition selon la structure finale du README (après merge PR #6 qui réécrit la section filtration).
- **Regex d'exclusion dans `validate.yml` paths-ignore** : à ajuster si de faux négatifs apparaissent (ex: changement `README.md` racine doit-il déclencher ou non ?). Décider à l'usage.
- **Q-A1 — Structure du `gerber.zip` compatible avec le fabricant cible** *(reporté depuis ce-doc-review 2026-04-22)* : la workflow actuelle zippe `pcb/src/*` à plat. Certains fabricants (JLCPCB, PCBWay, OSHPark) préfèrent parfois un dossier wrapper (`FrangiPool-PCB/*.GTL`). Action requise avant de merger la PR release : uploader un gerber.zip construit localement (`cd pcb/src && zip -r /tmp/gerber-test.zip .`) sur le quote form du fabricant visé et confirmer qu'il parse les 9 fichiers correctement. Si non, changer la ligne zip en `zip -r gerber.zip pcb/src` (préserve le préfixe) ou créer un dossier intermédiaire (`cp -R pcb/src FrangiPool-PCB && zip -r gerber.zip FrangiPool-PCB`). Noter le choix retenu dans "Key Technical Decisions" au moment de l'édition.
- **Q-F4 — Comportement exact de git-auto-commit-action sur tag push (detached HEAD)** *(reporté depuis ce-doc-review 2026-04-22)* : normalement résolu par la garde de branche A4 (le workflow s'arrête si le tag n'est pas sur main). Reste à confirmer en Unit 6 que le checkout interne de git-auto-commit-action sur un tag-commit ancêtre de main-HEAD produit bien un commit avec le bon parent. Si divergence constatée (main a avancé entre le push du tag et l'exécution du job), envisager `skip_checkout: true` sur le step auto-commit. Vérifier empiriquement au premier run réel ; pas de code à écrire tant que le problème ne se manifeste pas.

## Output Structure

Nouveaux répertoires et fichiers créés par ce plan :

    pcb/
    ├── CHANGELOG.md                    # archivé tel quel depuis frangipool/pcb (liens commits conservés)
    ├── README.md                       # tel quel, image ./images/Vue_2D.svg continue de marcher
    ├── images/
    │   └── Vue_2D.svg
    └── src/
        ├── Drill_NPTH_Through.DRL
        ├── Drill_PTH_Through.DRL
        ├── Drill_PTH_Through_Via.DRL
        ├── Gerber_BoardOutlineLayer.GKO
        ├── Gerber_BottomLayer.GBL
        ├── Gerber_BottomSolderMaskLayer.GBS
        ├── Gerber_TopLayer.GTL
        ├── Gerber_TopSilkscreenLayer.GTO
        └── Gerber_TopSolderMaskLayer.GTS

    CHANGELOG.md                        # racine, nouveau, seed pré-monorepo + "Unreleased"
    .github/workflows/release.yml       # nouveau, triggered on v*.*.*

Fichiers modifiés (pas créés) : `README.md` (ajout section PCB), `.github/workflows/validate.yml` (ajout `paths-ignore`).

## High-Level Technical Design

> *Ces schémas illustrent l'intention ; ils ne sont pas une spécification d'implémentation. L'implémenteur adapte librement tant que le comportement observable est conservé.*

**Flow de la release workflow** (déclenché par `git push --tags` d'un `v[0-9]+.[0-9]+.[0-9]+`) :

```
tag v0.2.0 pushed
      │
      ▼
[checkout@sha v4.2.2]  ───────► full clone (fetch-depth: 0, nécessaire pour changelog-action)
      │
      ▼
[requarks/changelog-action@sha v1.x]  ──► lit les commits depuis dernier tag, produit :
      │                                   ├── CHANGELOG.md mis à jour (entrée en haut)
      │                                   └── outputs.changes (corps de la release note)
      ▼
[shell: cd pcb/src && zip -r ../../gerber.zip .]
      │
      ▼
[ncipollo/release-action@sha v1.x]  ──► crée/met à jour GH release v0.2.0
      │                                 body = steps.changelog.outputs.changes
      │                                 artifacts = gerber.zip
      ▼
[stefanzweifel/git-auto-commit-action@sha v7.x]  ──► git add CHANGELOG.md
                                                     git commit "docs: update CHANGELOG.md for v0.2.0 [skip ci]"
                                                     git push origin main
```

**CHANGELOG racine — structure après fusion :**

```
# Changelog
<notice Keep-a-Changelog + SemVer>

## [Unreleased]
<vide ou WIP>

## Pre-monorepo history

### firmware v0.1.0 - 2026-04-06
<extrait de la GH release note existante>

### pcb v0.1.0 - 2023-06-08
<extrait de pcb/CHANGELOG.md, lien commit 0704aa1 vers frangipool/pcb>
```

Ensuite, chaque tag monorepo ajoute une entrée `## [vX.Y.Z] - YYYY-MM-DD` en haut (sous `[Unreleased]`) via `requarks/changelog-action`.

## Implementation Units

### Unit 1: Import du contenu PCB par copie plate

- [ ] **Goal** : matérialiser `pcb/` avec le contenu intégral de `frangipool/pcb` à l'état `cfd2e9f` (HEAD actuel du repo source).

**Requirements :** R1, R5 (ne pas toucher `packages/` ni les presets `salt_*.yaml` en copiant).

**Dependencies :** aucune. Pré-requis : avoir `../../frangipool/pcb` cloné (déjà le cas) et être sur la branche de travail `feat/monorepo-pcb`.

**Files :**
- Créer : `pcb/README.md`, `pcb/CHANGELOG.md`, `pcb/images/Vue_2D.svg`, `pcb/src/*.DRL` (3 fichiers), `pcb/src/*.GTL`/`*.GBL`/`*.GKO`/`*.GBS`/`*.GTO`/`*.GTS` (6 fichiers Gerber).
- Ne pas copier : `.github/workflows/release.yml` du source (sera réécrit en Unit 4, pas récupéré) ; ni `.git/` (évident).
- **Ne pas toucher** (R5) : `packages/**`, `salt_*.yaml`, `homeassistant/**`, `secrets.example.yaml`.

**Approach :**
- `rsync --archive --exclude='.git' --exclude='.github' ../../frangipool/pcb/ ./pcb/` ou `cp -R` équivalent. Vérifier via `ls pcb/src/` et `git status` que les 9 fichiers `src/` + le `images/Vue_2D.svg` sont présents et non vides.
- Dans le message de commit, mentionner le SHA source exact pour traçabilité : `feat(pcb): import hardware design from frangipool/pcb@cfd2e9f`.
- Vérifier que `pcb/README.md` référence bien `./images/Vue_2D.svg` (chemin relatif préservé par la copie — fonctionne tel quel dans `pcb/`).

**Patterns to follow :**
- Aucun pattern de repo monorepo préexistant ici. Le commit doit suivre la convention Conventional Commits du repo (scope `pcb`).

**Test scenarios :**
- *Happy path* : après la copie, `git diff --stat HEAD` affiche uniquement des ajouts sous `pcb/`, total ~1.4 MB (1.2 MB image + gerbers). `find pcb -type f | wc -l` retourne 12 (1 README + 1 CHANGELOG + 1 SVG + 9 fichiers src).
- *Happy path* : `cat pcb/README.md | head -3` mentionne "FrangiPool PCB" et la ligne image.
- *Edge case* : aucun `.DS_Store`, `.git/`, `.github/`, ou `__MACOSX/` ne s'est glissé dans la copie — vérifier via `find pcb -name '.*' -o -name '__MACOSX'`.

**Verification :**
- `git log --oneline -1 pcb/` affiche le commit d'import.
- `sha1sum pcb/src/*.GTL` correspond à `sha1sum ../../frangipool/pcb/src/*.GTL` (1:1 sur tous les fichiers `src/`).
- **R5** : `git diff HEAD~1 -- packages/ salt_*.yaml homeassistant/ secrets.example.yaml` doit être vide (aucune de ces surfaces n'a bougé).

### Unit 2: Section PCB dans le README racine

- [ ] **Goal** : rendre le PCB découvrable depuis le README principal du monorepo.

**Requirements :** R1 (facette découvrabilité).

**Dependencies :** Unit 1 (le fichier `pcb/README.md` doit exister pour être linké).

**Files :**
- Modifier : `README.md` (racine).
- Pas de nouveau fichier.

**Approach :**
- Ajouter une section dédiée — 3-5 lignes — après la section existante sur le firmware et avant la section "Liens utiles" (ou équivalent structurel du moment de l'édition, puisque PR #6 réécrit le README).
- Contenu : une ligne d'intro ("Le PCB qui héberge l'ESP32 et ses capteurs est sous [pcb/](pcb/). Voir [pcb/README.md](pcb/README.md) pour le détail matériel."), un lien vers le SVG (`![Aperçu 2D](pcb/images/Vue_2D.svg)` en optionnel), et une ligne sur le téléchargement des gerbers ("Les Gerbers prêts pour fabrication sont publiés en tant qu'asset `gerber.zip` sur chaque [GitHub release](https://github.com/gaetanars/FrangiPool/releases).").
- Ne pas dupliquer le README PCB — une accroche qui dirige suffit.

**Patterns to follow :**
- Ton FR concis du README existant. Pas d'emojis (cf. instructions globales).
- Les chemins liens sont relatifs et repo-relatifs.

**Test scenarios :**
- *Happy path* : le README racine rendu sur GitHub affiche la section PCB avec liens cliquables vers `pcb/` et `pcb/README.md` ; l'image `pcb/images/Vue_2D.svg` s'affiche correctement (1.2 MB SVG, GitHub la rend nativement).
- *Edge case* : les liens fonctionnent aussi depuis un clone local (Markdown preview VSCode).

**Verification :**
- Un œil humain scanne le README et trouve la section PCB en <10s sans scroll infini.

### Unit 3: CHANGELOG racine avec seed pré-monorepo

- [ ] **Goal** : créer un `CHANGELOG.md` racine qui (a) servira de cible à `requarks/changelog-action` pour les futurs tags et (b) préserve la mémoire des deux v0.1.0 pré-fusion.

**Requirements :** R3.

**Dependencies :** Unit 1 (`pcb/CHANGELOG.md` présent pour en extraire le contenu historique).

**Files :**
- Créer : `CHANGELOG.md` (racine).

**Approach :**
- En-tête Keep-a-Changelog + SemVer (copier le format depuis `pcb/CHANGELOG.md`).
- Section `## [Unreleased]` vide au sommet — **convention Keep-a-Changelog pour la lisibilité humaine**, pas un requirement technique. `requarks/changelog-action` insère sa nouvelle entrée au sommet du fichier sans exiger de marqueur particulier (cf. README action : "Will not mess up with any header or instructions you already have at the top of your CHANGELOG.md").
- Section `## Pre-monorepo history` en bas, avec deux sous-sections :
  - `### firmware v0.1.0 — 2026-04-06` : extrait des release notes GH existantes (récupérables via `gh release view v0.1.0 --repo gaetanars/FrangiPool --json body`).
  - `### pcb v0.1.0 — 2023-06-08` : entrée extraite de `pcb/CHANGELOG.md`. **Garder le lien commit vers `frangipool/pcb`** — il fonctionnera tant que le repo source existe (décision utilisateur : laisser tel quel). Ajouter une note "imported from [frangipool/pcb](https://github.com/frangipool/pcb) @ cfd2e9f" pour attribution.
- **Ne pas supprimer `pcb/CHANGELOG.md`** — le conserver comme archive figée pour compatibilité avec les liens dans `pcb/README.md` et les lecteurs qui resteraient dans `pcb/`.

**Patterns to follow :**
- Format Keep-a-Changelog (déjà utilisé dans `pcb/CHANGELOG.md`).

**Test scenarios :**
- *Happy path* : `CHANGELOG.md` s'ouvre avec l'en-tête Keep-a-Changelog puis `## [Unreleased]` (convention lisibilité, pas une condition technique).
- *Happy path* : les liens commit vers `frangipool/pcb` sont valides (200 OK sur `https://github.com/frangipool/pcb/commit/0704aa1`).
- *Edge case* : l'action changelog, quand elle parse ce fichier au prochain tag, ne casse pas la section `Pre-monorepo history` (cette section reste intouchée — l'action insère au-dessus).

**Verification :**
- Après run de la workflow en Unit 6, `CHANGELOG.md` contient `## [v0.2.0] - 2026-MM-DD` au-dessus de `Pre-monorepo history`.

### Unit 4: Workflow GitHub Actions de release

- [ ] **Goal** : automatiser la production de `gerber.zip` + création/update de la GH release + mise à jour du `CHANGELOG.md` à chaque tag `v*.*.*`.

**Requirements :** R2, R3, R6.

**Dependencies :** Unit 1 (source des gerbers) et Unit 3 (CHANGELOG cible). Pas de dépendance sur Unit 2 (README découplé).

**Files :**
- Créer : `.github/workflows/release.yml`.

**Approach :**
- Trigger : `on.push.tags: ['v[0-9]+.[0-9]+.[0-9]+']` (même regex que la source, évite qu'un tag `v0.1-rc1` déclenche par erreur).
- Un seul job `release`, `runs-on: ubuntu-latest`.
- **Permissions minimales explicites** sur le job : `contents: write` (nécessaire pour `release-action` + `git-auto-commit-action` + push). Rien d'autre. Pas de `id-token`, `packages`, etc.
- Steps, dans l'ordre :
  1. `actions/checkout@<sha v4.2.2>` avec `fetch-depth: 0` (changelog-action lit tout l'historique).
  2. **Garde de branche (A4)** : `run: git branch -r --contains ${{ github.sha }} | grep -q 'origin/main$' || (echo "::error::Tag pushed from a commit not on main — refusing to release" && exit 1)`. Empêche un tag accidentel depuis une feat branch de polluer `CHANGELOG.md` sur main avec une entrée pour un commit absent de main.
  3. `requarks/changelog-action@<sha v1>` avec `id: changelog` — inputs : `token: ${{ secrets.GITHUB_TOKEN }}`, `tag: ${{ github.ref_name }}`, `excludeTypes: 'chore,style,build'` (bruit standard), `excludeScopes: 'changelog'` (A5 — évite la récursion sur l'auto-commit `docs: update CHANGELOG.md` ; v1.10+ supporte `excludeScopes`). Outputs : `changes` (body) + met à jour `CHANGELOG.md` sur disque. **Le `id: changelog` est obligatoire** — l'étape release-action référence `steps.changelog.outputs.changes`.
  4. `run: cd pcb/src && zip -r ../../gerber.zip .` (shell natif, `shell: bash` implicite). Produit `gerber.zip` à la racine du workspace.
  5. **Décoration release notes (A2)** : `run` shell qui teste `git log --name-only <prev-tag>..HEAD pcb/ | grep -q .`. Si aucun commit depuis le dernier tag ne touche `pcb/`, préfixer `steps.changelog.outputs.changes` avec la ligne `> **Note matérielle** : PCB inchangé depuis v0.1.0 (2023-06-08). Le \`gerber.zip\` attaché est identique à celui du précédent release.` via une variable d'env (`$GITHUB_ENV` ou `$GITHUB_OUTPUT`).
  6. `ncipollo/release-action@<sha v1>` — inputs : `allowUpdates: true`, `makeLatest: true`, `name: ${{ github.ref_name }}`, `body: ${{ steps.release_notes.outputs.body }}` (output du step 5 ; fallback : `steps.changelog.outputs.changes`), `artifacts: 'gerber.zip'`, `token: ${{ secrets.GITHUB_TOKEN }}`.
  7. `stefanzweifel/git-auto-commit-action@<sha v7>` — inputs : `branch: main`, `commit_message: 'docs(changelog): update CHANGELOG.md for ${{ github.ref_name }} [skip ci]'`, `file_pattern: CHANGELOG.md`. **Scope `changelog`** pour que `excludeScopes: 'changelog'` l'ignore au prochain run.
- **Toutes les actions tierces SHA-pinnées** avec le commentaire `# vX.Y.Z` à côté (convention `fe9a302`). Versions à résoudre au moment de l'édition (choisir la dernière stable publiée) — ne pas accepter `@master` ni `@main` ni `@v1` (tag floating).
- **Source à cloner pour inspiration** : `.github/workflows/release.yml` dans `frangipool/pcb` — même logique, à durcir. Deltas à appliquer : SHA pins, permissions explicites, remplacer `thedoctor0/zip-release` par `zip` shell natif, trigger regex identique.

**Patterns to follow :**
- `.github/workflows/validate.yml` (commit `fe9a302`) pour le style de SHA pinning et permissions.
- `frangipool/pcb/.github/workflows/release.yml` pour la structure globale.

**Test scenarios :**
- *Happy path* : `act -W .github/workflows/release.yml` (si `act` installé) ou un `esphome config`-like `gh workflow run` en dry-run valide la syntaxe du YAML.
- *Happy path* : un push de tag de test (voir Unit 6) déclenche le workflow qui se termine en `success`.
- *Happy path* : `gerber.zip` contient exactement les 9 fichiers de `pcb/src/` à plat (pas de sous-dossier `src/`), vérifiable via `unzip -l gerber.zip`.
- *Error path* : si le tag ne matche pas le regex (ex: `v0.2.0-rc1`), la workflow ne s'exécute pas — vérifier côté Actions UI.
- *Error path (A4)* : si un tag est poussé depuis un commit absent de `origin/main`, le step "Garde de branche" échoue avec `::error::Tag pushed from a commit not on main`. Tester en taguant une feat branch et en confirmant que le job s'arrête avant de modifier `CHANGELOG.md`.
- *Integration (A5)* : après une première release v0.1.99, lancer une deuxième release v0.2.0 et vérifier que le body **ne contient pas** le commit `docs(changelog): update CHANGELOG.md for v0.1.99 [skip ci]` (filtré par `excludeScopes: 'changelog'`).
- *Integration (A2)* : tester le cas "firmware-only" — lancer une release sur un commit range qui ne touche pas `pcb/` et vérifier que la note `PCB inchangé depuis v0.1.0` apparaît dans le corps de la release.
- *Integration* : l'auto-commit final ne déclenche pas une seconde release (le tag n'est pas réémis ; le `[skip ci]` coupe `validate.yml`).
- *Edge case* : sur un retag (`git tag -f v0.2.0 && git push -f --tags`), `allowUpdates: true` permet au release-action de remplacer l'asset. Tester sur un tag jetable.

**Verification :**
- Après push d'un tag `v0.2.0-test` (cf. Unit 6), la GH release existe avec `gerber.zip` attaché et un corps non-vide généré depuis les commits.
- `git log --oneline main -3` montre un commit `docs: update CHANGELOG.md for v0.2.0-test [skip ci]` de l'auto-commit.

### Unit 5: Exclure pcb/** et changelog de validate.yml

- [ ] **Goal** : éviter de relancer la matrice 8-presets ESPHome (≈2-5 min CI) pour un changement purement PCB ou CHANGELOG.

**Requirements :** R4 (non-régression CI).

**Dependencies :** le `validate.yml` doit exister sur `main`. Si PR #6 n'est pas encore mergée, cette unit peut soit (a) être intégrée dans la même PR monorepo si basée sur `feat/esphome-standalone-filtration`, soit (b) être faite en follow-up après merge de #6.

**Files :**
- Modifier : `.github/workflows/validate.yml`.

**Approach :**
- Ajouter sous `on.push` ET `on.pull_request` :
  ```
  paths-ignore:
    - 'pcb/**'
    - 'CHANGELOG.md'
    - 'docs/**'
    - 'README.md'
  ```
- Débat possible sur `README.md` : l'inclure signifie qu'un typo-fix README ne relance pas 8 compiles, mais si un changement README pointe vers une entité renommée dans un package, on ne s'en rendra pas compte. Comme le README est découplé des lambdas, inclure `README.md` est défendable. **Décision : inclure.**
- **Ne pas** ajouter `*.md` globalement : certains `.md` futurs pourraient être couplés au firmware (exemple : `homeassistant/README.md`). Préciser les chemins.

**Patterns to follow :**
- GitHub Actions docs sur `paths` / `paths-ignore`. Aucun pattern local préexistant.

**Test scenarios :**
- *Happy path* : un commit qui touche uniquement `pcb/src/Gerber_TopLayer.GTL` (edit simulé) n'affiche pas de run `validate.yml` dans l'onglet Actions de la PR.
- *Happy path* : un commit qui touche `packages/filtration.yaml` déclenche toujours les 8 validations.
- *Edge case* : un commit mixte (`pcb/` + `packages/`) déclenche les validations — GitHub fait l'union des paths non ignorés.
- *Edge case* : un commit qui touche seulement `.github/workflows/release.yml` déclenche `validate.yml` ? Non, car `.github/workflows/` n'est pas dans paths-ignore, donc oui — c'est OK (modifier la CI mérite un re-check). Confirmer.

**Verification :**
- Dans la PR de ce plan, créer un commit factice `pcb/CHANGELOG.md` → observer l'absence de run `validate.yml`.

### Unit 6: Test end-to-end de la release workflow

- [ ] **Goal** : prouver que la chaîne tag → release → gerber.zip → CHANGELOG auto-commit fonctionne avant de la considérer comme livrée.

**Requirements :** R2, R3, R6.

**Dependencies :** Units 1-4 mergées sur `main`.

**Files :**
- Aucun fichier créé/modifié dans le repo — c'est un test opérationnel.

**Approach :**
- **Choix du tag de test** : utiliser `v0.1.99` — il matche la regex `v[0-9]+.[0-9]+.[0-9]+` (un suffixe `-test` la ferait échouer silencieusement sans déclencher la workflow). **Ne PAS utiliser `v0.2.0-test` ou équivalent.**
- **Attention — requarks/changelog-action requiert un tag précédent** : l'action exit-error si elle ne trouve pas de tag précédent dans le repo. v0.0.1 et v0.1.0 existent déjà, donc v0.1.99 trouvera v0.1.0 comme précédent et couvrira **tous les commits depuis 2026-04-06** (PR #6 entière + la fusion PCB + le seed CHANGELOG). Le body de release sera volumineux mais one-shot.
- Pousser `v0.1.99` sur un commit déjà sur `main` (sinon la garde A4 avorte) : `git tag v0.1.99 && git push origin v0.1.99`.
- Observer l'exécution de `release.yml` dans l'onglet Actions.
- Vérifier la GH release créée, télécharger `gerber.zip`, l'ouvrir, vérifier 9 fichiers à plat (ou structure retenue selon [Q-A1 en Deferred to Implementation]).
- Vérifier le commit auto `docs(changelog): update CHANGELOG.md for v0.1.99 [skip ci]` sur `main`.
- **Nettoyage OBLIGATOIRE AVANT de tagger le vrai v0.2.0** : sinon v0.1.99 reste le "previous tag" pour v0.2.0 et contamine son changelog. Faire dans l'ordre :
  1. `git push --delete origin v0.1.99` (supprime le tag remote)
  2. `git tag -d v0.1.99` (supprime le tag local)
  3. `gh release delete v0.1.99 --yes` (supprime la GH release)
  4. Vérifier : `gh release list --repo gaetanars/FrangiPool` ne doit plus lister v0.1.99.
  5. Le commit `docs(changelog): update CHANGELOG.md for v0.1.99 [skip ci]` reste sur main — le revert manuellement (`git revert <sha>`) ou laisser et nettoyer l'entrée dans CHANGELOG.md avant v0.2.0.
- Si tout passe, le vrai tag `v0.2.0` peut être poussé — mais c'est une décision séparée (voir "Deferred to Implementation").

**Patterns to follow :**
- Tests de CI par push de tag jetable — pattern standard GitHub.

**Test scenarios :**
- *Happy path* : release créée en <2 min, asset présent, body non-vide.
- *Error path* : si le CHANGELOG n'est pas mis à jour (ex: permission `contents: write` oubliée), l'auto-commit fail visiblement — réparer et re-tester.
- *Error path* : si le zip est vide ou mal structuré, le remarquer avant le vrai tag. Garder les unit tests conceptuels sur `unzip -l gerber.zip` avant de fermer la PR.

**Verification :**
- Checklist manuelle :
  - [ ] Workflow run = `success`
  - [ ] GH release `v0.1.99` visible
  - [ ] `gerber.zip` téléchargeable, contenu conforme à la structure retenue
  - [ ] `CHANGELOG.md` sur `main` contient une entrée `## [v0.1.99]` avec les commits depuis v0.1.0
  - [ ] Body de la release ne contient pas de ligne `docs(changelog):` (A5 — filtre appliqué)
  - [ ] Commit auto `docs(changelog): update CHANGELOG.md for v0.1.99 [skip ci]` présent
  - [ ] Nettoyage effectué (tag local + tag remote + release GH + éventuel revert du commit CHANGELOG)

## System-Wide Impact

- **Interaction graph :** deux surfaces externes touchées — (a) le système de tags `v*.*.*` qui déclenche désormais un workflow (avant : déclenchait rien côté firmware ; côté pcb source : déclenchait le release workflow de `frangipool/pcb`, inchangé), (b) les GH releases qui gagnent des assets `gerber.zip` systématiquement. Aucune interaction avec les URLs `dashboard_import` des presets.
- **Error propagation :** si `requarks/changelog-action` échoue (malformed CHANGELOG), toute la release échoue → pas de gerber.zip publié → pas de confusion. Comportement safe.
- **State lifecycle risks :** l'auto-commit sur main crée un commit supplémentaire après chaque tag. Si un autre workflow écoute `push.branches: [main]`, il se déclenche — c'est pour ça que le commit est tagué `[skip ci]` (convention reconnue par GitHub Actions). `validate.yml` ne se relance donc pas.
- **API surface parity :** les URLs `github://gaetanars/FrangiPool/packages/*.yaml@main` restent stables. Aucun utilisateur firmware n'est cassé.
- **Integration coverage :** couvert par Unit 6 (dry-run bout en bout).
- **Unchanged invariants :** rien de la matrice de validation 8 presets ne change (R4). Le `packages/` reste au même endroit. Les presets `salt_*.yaml` ne bougent pas. Les workflows existants (`validate.yml`) continuent de se déclencher sur les mêmes events, avec l'ajout d'un `paths-ignore` qui ne peut que *réduire* les runs, jamais en ajouter.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Collision de tags (v0.0.1 / v0.1.0 existent des deux côtés) | Le prochain tag monorepo partira de v0.2.0 minimum. Les v0.x existants côté destination restent intacts. La release v0.1.0 du source frangipool/pcb reste sur son repo (utilisateur a choisi de ne pas archiver). |
| `requarks/changelog-action` a un bug ou change de comportement en version >v1 | Figer au SHA de la version v1.x la plus récente au moment de l'implémentation. Fallback en cas d'abandon : **n'est pas un drop-in** — `gh release create --generate-notes` ne produit que le body de la release et ne met pas à jour `CHANGELOG.md`. Pour préserver R3 (fichier CHANGELOG versionné), remplacer par `git-cliff` (generator conventional-commits → fichier) ou `conventional-changelog-cli`, plus une étape commit manuelle. Accepter de dropper R3 est l'autre option. |
| L'auto-commit du CHANGELOG crée un conflit si l'utilisateur push simultanément sur main | Mono-contributeur → probabilité très basse. En cas de conflit, la workflow fail proprement ; il suffit de re-push le tag après résolution. Pas de mitigation proactive. |
| Les liens commits vers `frangipool/pcb` dans le CHANGELOG cassent si le repo source est un jour supprimé | Accepté. L'utilisateur a choisi "laisser tel quel" ; si ça change, documenter la casse dans une PR séparée qui patche les liens. |
| Le SVG de 1.2 MB dans `pcb/images/` gonfle le clone du repo | Acceptable : 1.2 MB reste modeste et Git gère bien les SVG texte (delta-compression efficace). Pas de Git LFS nécessaire. |
| `thedoctor0/zip-release` ou `ncipollo/release-action` abandonnés | `zip` shell élimine le premier risque. Pour `ncipollo/release-action`, alternative officielle : `softprops/action-gh-release` (très populaire en 2026) — swap possible en follow-up si nécessaire. |
| Durant l'exécution, les permissions par défaut du `GITHUB_TOKEN` pourraient être en lecture seule (paramètre repo) | Vérifier Settings → Actions → General → Workflow permissions avant Unit 6. Si en read-only, passer en read+write (ou utiliser un PAT — mais pas nécessaire ici). |

## Documentation / Operational Notes

- **Sequencing avec PR #6** : PR #6 (`feat/esphome-standalone-filtration`) est ouverte et introduit `validate.yml`, `CLAUDE.md` agent guide, `docs/`, et réécrit `README.md`. Cette fusion PCB devrait idéalement se faire **après** le merge de PR #6 pour éviter :
  - Les conflits sur `README.md` (PR #6 réécrit la section filtration ; cette fusion ajoute une section PCB).
  - La duplication de décisions (où exactement insérer la section PCB dans un README qui est en train d'être refondu).
  - Les conflits sur `.github/workflows/` (PR #6 crée `validate.yml` ; cette fusion ajoute `release.yml` et modifie `validate.yml`).
  - Si l'attente de PR #6 bloque, alternative : brancher `feat/monorepo-pcb` depuis `feat/esphome-standalone-filtration` et rebaser après merge. Le coût de conflit reste à `README.md` + `validate.yml`.
- **Secret GitHub Actions** : aucun secret custom requis — `GITHUB_TOKEN` natif suffit pour les 3 actions tierces (changelog, release, auto-commit).
- **Runbook release future** : documenter dans le README racine (ou dans un nouveau `docs/releases.md`) comment couper une release :
  1. S'assurer qu'il y a des commits conventional sur `main` depuis le dernier tag.
  2. **Toujours tagger un commit déjà sur `main`** (A4) — jamais depuis une feat branch ou un état détaché. Workflow : `git checkout main && git pull && git tag v<x.y.z> && git push origin main v<x.y.z>` (push tag + branche ensemble).
  3. Vérifier la GH release générée et l'asset `gerber.zip`.
  4. Si le dernier commit pcb remonte à v0.1.0, la note "PCB inchangé depuis v0.1.0" est injectée automatiquement dans le body (A2).
- **Pas de `docs/solutions/architecture/` à produire** pour ce plan sauf si la première release réelle expose un gotcha (ex: permissions insuffisantes, comportement inattendu de changelog-action). Si c'est le cas, capturer en post-mortem court.

## Sources & References

- **Repo source** : `git@github.com:frangipool/pcb.git` (HEAD `cfd2e9f`, tags v0.0.1 + v0.1.0).
- **Repo source local** : `../../frangipool/pcb` (relatif à `gaetanars/FrangiPool`).
- **Workflow de référence pour le durcissement** : `.github/workflows/validate.yml` après commit `fe9a302` (sur branche `feat/esphome-standalone-filtration`, PR #6).
- **Workflow source à adapter** : `../../frangipool/pcb/.github/workflows/release.yml`.
- **Release firmware existante à extraire pour le seed CHANGELOG** : `gh release view v0.1.0 --repo gaetanars/FrangiPool --json body`.
- **CHANGELOG PCB source** : `../../frangipool/pcb/CHANGELOG.md`.
- **Conventional Commits** : https://www.conventionalcommits.org/
- **Keep a Changelog** : https://keepachangelog.com/en/1.0.0/
- **PR en flight** : https://github.com/gaetanars/FrangiPool/pull/6 (PR #6, `feat/esphome-standalone-filtration`).
