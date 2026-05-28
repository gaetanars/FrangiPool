# /release — FrangiPool Release Orchestrator

Orchestre un release firmware ou PCB propre : vérification de l'état git, suggestion de version, aperçu du changelog, tag + push.

**Usage** : `/release [firmware|pcb] [X.Y.Z|pcb-X.Y.Z]`

Arguments optionnels :
- `firmware` ou `pcb` — composant à releaser (demandé si absent)
- version explicite — bypass la suggestion automatique

---

## Étapes — exécute dans l'ordre, stoppe net si une vérification échoue

### 1. Pré-vol (exécuter en parallèle)

```bash
rtk git branch --show-current
rtk git status --porcelain
rtk git fetch origin main --quiet && rtk git log HEAD..origin/main --oneline
```

Conditions requises :
- Branche courante = `main`
- Arbre de travail propre (aucune sortie de `git status --porcelain`)
- Aucun commit upstream non récupéré

Si l'une échoue → stopper, expliquer, proposer le correctif.

### 2. Composant à releaser

Si `$ARGUMENTS` contient `firmware` ou `pcb`, utiliser directement.  
Sinon demander : **firmware** (tag `*.*.*`) ou **pcb** (tag `pcb-*.*.*`) ?

### 3. Dernier tag et commits en attente

**Firmware :**
```bash
rtk git tag --list '[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -1
```

**PCB :**
```bash
rtk git tag --list 'pcb-[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -1
```

Puis lister les commits depuis ce tag :
```bash
rtk git log <prev_tag>..HEAD --oneline
```

Si aucun tag précédent → stopper : la CI exige un tag de base (voir `release-firmware.yml` step "Compute previous firmware tag").

Si aucun commit depuis le dernier tag → signaler et demander confirmation avant de continuer.

### 4. Suggestion de version bump

Analyser les sujets de commits depuis le dernier tag :
- Contient `BREAKING CHANGE` ou `!` avant `:` → **MAJOR**
- Contient `feat:` ou `feat(...):` → **MINOR**
- Sinon → **PATCH**

Appliquer au numéro de version du dernier tag (retirer le préfixe `pcb-` si applicable).

### 5. Aperçu du changelog

Afficher les commits qui apparaîtront dans les release notes, en excluant :
- Types : `chore`, `style`, `build`
- Scope `changelog` (commits auto-générés par la CI)
- Pour firmware : scope `pcb`
- Pour PCB : commits sans rapport PCB

Grouper par type en format Keep a Changelog :
- **Added** (feat)
- **Fixed** (fix)
- **Changed** (refactor, perf)
- **Documentation** (docs)
- **CI** (ci)

### 6. Confirmation

Proposer :
```
Version suggérée : <X.Y.Z>   (ou pcb-<X.Y.Z>)
Commits inclus   : N commits
```

Si `$ARGUMENTS` contient une version explicite, l'utiliser directement mais confirmer quand même.

Demander explicitement : **Confirmes-tu ce tag et ce push ?**  
→ Ne procéder qu'avec un "oui" explicite.

### 7. Tag et push

```bash
rtk git tag <X.Y.Z>
rtk git push origin main <X.Y.Z>
```

Après push, indiquer à l'utilisateur :
- La CI `release-firmware.yml` (ou `release-pcb.yml`) va maintenant :
  1. Générer la section CHANGELOG depuis les commits
  2. Auto-committer `CHANGELOG.md` sur main
  3. Créer la GitHub Release
- Surveiller avec : `rtk gh run list --workflow=release-firmware.yml --limit=3`
