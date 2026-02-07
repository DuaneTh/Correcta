# Requirements: Correcta

**Defined:** 2026-01-18
**Core Value:** Les professeurs peuvent creer un examen et obtenir une correction IA de qualite avec feedback personnalise

## v1 Requirements

Requirements pour le pilote ESSEC. Amelioration de l'existant, pas reconstruction.

### Editeur Mathematique (MATH)

- [x] **MATH-01**: Editeur WYSIWYG avec boutons pour inserer symboles (pas de LaTeX visible)
- [x] **MATH-02**: Support fractions, exposants, racines carrees via boutons
- [x] **MATH-03**: Support symboles grecs (alpha, beta, theta, pi, etc.) via palette
- [x] **MATH-04**: Support integrales, sommes, limites avec positions cliquables (indices sup/inf)
- [x] **MATH-05**: Rendu coherent KaTeX dans reponses, correction et export PDF

### Creation d'Examen (EXAM)

- [x] **EXAM-01**: Interface intuitive de creation (refonte UX de l'existant)
- [x] **EXAM-02**: Questions ouvertes avec bareme configurable
- [x] **EXAM-03**: QCM avec options multiples et correction automatique
- [x] **EXAM-04**: Questions avec image (upload photo dans l'enonce)
- [x] **EXAM-05**: Reponses isolees par question (pas de PDF entier)

### Correction IA (CORR)

- [x] **CORR-01**: Correction automatique via GPT-4 selon bareme defini
- [x] **CORR-02**: Feedback personnalise genere pour chaque reponse d'etudiant
- [x] **CORR-03**: Review optionnel par prof avant publication des notes (peut publier directement)
- [x] **CORR-04**: Interface de review pour valider/modifier notes et feedback
- [x] **CORR-05**: Support des reponses mathematiques (LaTeX) dans le prompt IA

### Export (EXPO)

- [x] **EXPO-01**: Export CSV des notes (colonnes: etudiant, question, note, total)
- [x] **EXPO-02**: Export PDF rapport avec details (notes, feedback, reponses)
- [x] **EXPO-03**: Filtrage export par classe/sous-groupe
- [x] **EXPO-04**: Rendu math coherent dans PDF (MathJax SVG)

### Gestion Organisation (ORG)

- [x] **ORG-01**: Creation de classes par admin ecole
- [x] **ORG-02**: Creation de sous-groupes dans une classe (TD, TP, etc.)
- [x] **ORG-03**: Affectation d'etudiants aux classes et sous-groupes
- [x] **ORG-04**: Import CSV/Excel pour creation massive d'utilisateurs
- [x] **ORG-05**: Attribution des roles (professeur, admin ecole)

### UI Kit (UIKIT)

- [x] **UIKIT-01**: cn() utility and base design tokens
- [x] **UIKIT-02**: Migrate admin pages (school admin, platform admin) to UI Kit components
- [x] **UIKIT-03**: Migrate teacher pages (courses, exams, grading) to UI Kit components
- [x] **UIKIT-04**: Migrate student pages (courses, exams, results) to UI Kit components
- [x] **UIKIT-05**: Consolidate modals (grading, export, confirm) using UI Kit patterns
- [x] **UIKIT-06**: UI Kit showcase page at /internal/ui-kit

### Proctoring Intelligent (PROCT)

- [x] **PROCT-01**: Mode webcam dissuasif (invite permission camera + indicateur actif, pas d'enregistrement)
- [x] **PROCT-02**: Proctoring activable/desactivable par examen (webcam + lockdown independants)
- [x] **PROCT-03**: Detection lockdown navigateur (changements d'onglet, perte de focus, detection collage externe)
- [x] **PROCT-04**: Analyse des patterns de perte de focus (correlation avec timing des reponses = suspicieux)
- [x] **PROCT-05**: Journalisation d'activite avec evenements horodates pour review prof
- [x] **PROCT-06**: Dashboard proctoring prof (timeline par etudiant, score suspicion, patterns)

## v2 Requirements

Defere apres pilote ESSEC.

### Correction IA Avancee

- **CORR-06**: Seuil de confiance avec flag auto pour review (< 80%)
- **CORR-07**: Historique des corrections et revisions
- **CORR-08**: Templates de rubrique par type de question

### UX Avancee

- **EXAM-06**: Previsualisation examen avant publication
- **EXAM-07**: Duplication d'examen existant
- **EXAM-08**: Banque de questions reutilisables

### Analytics

- **ANAL-01**: Dashboard statistiques par examen
- **ANAL-02**: Comparaison de performance entre groupes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Upload PDF entier comme examen | Reponses doivent etre isolees pour meilleure correction IA |
| Ecriture LaTeX directe par etudiant | Cible non-technique, boutons uniquement |
| SSO/Annuaire pour import utilisateurs | CSV/Excel suffit pour pilote |
| Matrices et vecteurs | Pas prioritaire pour pilote ESSEC |
| Application mobile | Web-first |
| Chat temps reel | Hors perimetre examen |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MATH-01 | Phase 1 - Math Foundation | Complete |
| MATH-02 | Phase 1 - Math Foundation | Complete |
| MATH-03 | Phase 1 - Math Foundation | Complete |
| MATH-04 | Phase 1 - Math Foundation | Complete |
| MATH-05 | Phase 1 - Math Foundation | Complete |
| EXAM-01 | Phase 2 - Exam Creation | Complete |
| EXAM-02 | Phase 2 - Exam Creation | Complete |
| EXAM-03 | Phase 2 - Exam Creation | Complete |
| EXAM-04 | Phase 2 - Exam Creation | Complete |
| EXAM-05 | Phase 2 - Exam Creation | Complete |
| ORG-01 | Phase 3 - Organization | Complete |
| ORG-02 | Phase 3 - Organization | Complete |
| ORG-03 | Phase 3 - Organization | Complete |
| ORG-04 | Phase 3 - Organization | Complete |
| ORG-05 | Phase 3 - Organization | Complete |
| CORR-01 | Phase 4 - AI Correction | Complete |
| CORR-02 | Phase 4 - AI Correction | Complete |
| CORR-03 | Phase 4 - AI Correction | Complete |
| CORR-04 | Phase 4 - AI Correction | Complete |
| CORR-05 | Phase 4 - AI Correction | Complete |
| EXPO-01 | Phase 5 - Export | Complete |
| EXPO-02 | Phase 5 - Export | Complete |
| EXPO-03 | Phase 5 - Export | Complete |
| EXPO-04 | Phase 5 - Export | Complete |
| UIKIT-01 | Phase 6 - UI Kit Integration | Complete |
| UIKIT-02 | Phase 6 - UI Kit Integration | Complete |
| UIKIT-03 | Phase 6 - UI Kit Integration | Complete |
| UIKIT-04 | Phase 6 - UI Kit Integration | Complete |
| UIKIT-05 | Phase 6 - UI Kit Integration | Complete |
| UIKIT-06 | Phase 6 - UI Kit Integration | Complete |
| PROCT-01 | Phase 7 - Intelligent Proctoring | Complete |
| PROCT-02 | Phase 7 - Intelligent Proctoring | Complete |
| PROCT-03 | Phase 7 - Intelligent Proctoring | Complete |
| PROCT-04 | Phase 7 - Intelligent Proctoring | Complete |
| PROCT-05 | Phase 7 - Intelligent Proctoring | Complete |
| PROCT-06 | Phase 7 - Intelligent Proctoring | Complete |

**Coverage:**
- v1 requirements: 24 total (all complete)
- UI Kit requirements: 6 total (all complete)
- Proctoring requirements: 6 total (all complete)
- Mapped to phases: 36
- Unmapped: 0

---
*Requirements defined: 2026-01-18*
*Last updated: 2026-02-02 after Phase 7 completion - ALL REQUIREMENTS COMPLETE (v1 + UIKIT + PROCT)*
