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

- [ ] **EXAM-01**: Interface intuitive de creation (refonte UX de l'existant)
- [ ] **EXAM-02**: Questions ouvertes avec bareme configurable
- [ ] **EXAM-03**: QCM avec options multiples et correction automatique
- [ ] **EXAM-04**: Questions avec image (upload photo dans l'enonce)
- [ ] **EXAM-05**: Reponses isolees par question (pas de PDF entier)

### Correction IA (CORR)

- [ ] **CORR-01**: Correction automatique via GPT-4 selon bareme defini
- [ ] **CORR-02**: Feedback personnalise genere pour chaque reponse d'etudiant
- [ ] **CORR-03**: Review optionnel par prof avant publication des notes (peut publier directement)
- [ ] **CORR-04**: Interface de review pour valider/modifier notes et feedback
- [ ] **CORR-05**: Support des reponses mathematiques (LaTeX) dans le prompt IA

### Export (EXPO)

- [ ] **EXPO-01**: Export CSV des notes (colonnes: etudiant, question, note, total)
- [ ] **EXPO-02**: Export PDF rapport avec details (notes, feedback, reponses)
- [ ] **EXPO-03**: Filtrage export par classe/sous-groupe
- [ ] **EXPO-04**: Rendu math coherent dans PDF (KaTeX)

### Gestion Organisation (ORG)

- [ ] **ORG-01**: Creation de classes par admin ecole
- [ ] **ORG-02**: Creation de sous-groupes dans une classe (TD, TP, etc.)
- [ ] **ORG-03**: Affectation d'etudiants aux classes et sous-groupes
- [ ] **ORG-04**: Import CSV/Excel pour creation massive d'utilisateurs
- [ ] **ORG-05**: Attribution des roles (professeur, admin ecole)

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
| EXAM-01 | Phase 2 - Exam Creation | Pending |
| EXAM-02 | Phase 2 - Exam Creation | Pending |
| EXAM-03 | Phase 2 - Exam Creation | Pending |
| EXAM-04 | Phase 2 - Exam Creation | Pending |
| EXAM-05 | Phase 2 - Exam Creation | Pending |
| ORG-01 | Phase 3 - Organization | Pending |
| ORG-02 | Phase 3 - Organization | Pending |
| ORG-03 | Phase 3 - Organization | Pending |
| ORG-04 | Phase 3 - Organization | Pending |
| ORG-05 | Phase 3 - Organization | Pending |
| CORR-01 | Phase 4 - AI Correction | Pending |
| CORR-02 | Phase 4 - AI Correction | Pending |
| CORR-03 | Phase 4 - AI Correction | Pending |
| CORR-04 | Phase 4 - AI Correction | Pending |
| CORR-05 | Phase 4 - AI Correction | Pending |
| EXPO-01 | Phase 5 - Export | Pending |
| EXPO-02 | Phase 5 - Export | Pending |
| EXPO-03 | Phase 5 - Export | Pending |
| EXPO-04 | Phase 5 - Export | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-01-18*
*Last updated: 2026-01-18 after roadmap creation*
