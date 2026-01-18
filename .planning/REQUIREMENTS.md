# Requirements: Correcta

**Defined:** 2026-01-18
**Core Value:** Les professeurs peuvent créer un examen et obtenir une correction IA de qualité avec feedback personnalisé

## v1 Requirements

Requirements pour le pilote ESSEC. Amélioration de l'existant, pas reconstruction.

### Éditeur Mathématique (MATH)

- [ ] **MATH-01**: Éditeur WYSIWYG avec boutons pour insérer symboles (pas de LaTeX visible)
- [ ] **MATH-02**: Support fractions, exposants, racines carrées via boutons
- [ ] **MATH-03**: Support symboles grecs (α, β, θ, π, etc.) via palette
- [ ] **MATH-04**: Support intégrales, sommes, limites avec positions cliquables (indices sup/inf)
- [ ] **MATH-05**: Rendu cohérent KaTeX dans réponses, correction et export PDF

### Création d'Examen (EXAM)

- [ ] **EXAM-01**: Interface intuitive de création (refonte UX de l'existant)
- [ ] **EXAM-02**: Questions ouvertes avec barème configurable
- [ ] **EXAM-03**: QCM avec options multiples et correction automatique
- [ ] **EXAM-04**: Questions avec image (upload photo dans l'énoncé)
- [ ] **EXAM-05**: Réponses isolées par question (pas de PDF entier)

### Correction IA (CORR)

- [ ] **CORR-01**: Correction automatique via GPT-4 selon barème défini
- [ ] **CORR-02**: Feedback personnalisé généré pour chaque réponse d'étudiant
- [ ] **CORR-03**: Review optionnel par prof avant publication des notes (peut publier directement)
- [ ] **CORR-04**: Interface de review pour valider/modifier notes et feedback
- [ ] **CORR-05**: Support des réponses mathématiques (LaTeX) dans le prompt IA

### Export (EXPO)

- [ ] **EXPO-01**: Export CSV des notes (colonnes: étudiant, question, note, total)
- [ ] **EXPO-02**: Export PDF rapport avec détails (notes, feedback, réponses)
- [ ] **EXPO-03**: Filtrage export par classe/sous-groupe
- [ ] **EXPO-04**: Rendu math cohérent dans PDF (KaTeX)

### Gestion Organisation (ORG)

- [ ] **ORG-01**: Création de classes par admin école
- [ ] **ORG-02**: Création de sous-groupes dans une classe (TD, TP, etc.)
- [ ] **ORG-03**: Affectation d'étudiants aux classes et sous-groupes
- [ ] **ORG-04**: Import CSV/Excel pour création massive d'utilisateurs
- [ ] **ORG-05**: Attribution des rôles (professeur, admin école)

## v2 Requirements

Déféré après pilote ESSEC.

### Correction IA Avancée

- **CORR-06**: Seuil de confiance avec flag auto pour review (< 80%)
- **CORR-07**: Historique des corrections et révisions
- **CORR-08**: Templates de rubrique par type de question

### UX Avancée

- **EXAM-06**: Prévisualisation examen avant publication
- **EXAM-07**: Duplication d'examen existant
- **EXAM-08**: Banque de questions réutilisables

### Analytics

- **ANAL-01**: Dashboard statistiques par examen
- **ANAL-02**: Comparaison de performance entre groupes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Upload PDF entier comme examen | Réponses doivent être isolées pour meilleure correction IA |
| Écriture LaTeX directe par étudiant | Cible non-technique, boutons uniquement |
| SSO/Annuaire pour import utilisateurs | CSV/Excel suffit pour pilote |
| Matrices et vecteurs | Pas prioritaire pour pilote ESSEC |
| Application mobile | Web-first |
| Chat temps réel | Hors périmètre examen |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MATH-01 | Phase 1 | Pending |
| MATH-02 | Phase 1 | Pending |
| MATH-03 | Phase 1 | Pending |
| MATH-04 | Phase 1 | Pending |
| MATH-05 | Phase 1 | Pending |
| EXAM-01 | Phase 2 | Pending |
| EXAM-02 | Phase 2 | Pending |
| EXAM-03 | Phase 2 | Pending |
| EXAM-04 | Phase 2 | Pending |
| EXAM-05 | Phase 2 | Pending |
| ORG-01 | Phase 3 | Pending |
| ORG-02 | Phase 3 | Pending |
| ORG-03 | Phase 3 | Pending |
| ORG-04 | Phase 3 | Pending |
| ORG-05 | Phase 3 | Pending |
| CORR-01 | Phase 4 | Pending |
| CORR-02 | Phase 4 | Pending |
| CORR-03 | Phase 4 | Pending |
| CORR-04 | Phase 4 | Pending |
| CORR-05 | Phase 4 | Pending |
| EXPO-01 | Phase 5 | Pending |
| EXPO-02 | Phase 5 | Pending |
| EXPO-03 | Phase 5 | Pending |
| EXPO-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-18*
*Last updated: 2026-01-18 after initial definition*
