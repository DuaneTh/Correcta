# Correcta

## What This Is

Plateforme SaaS multi-tenant permettant aux établissements d'enseignement de créer des examens, les faire passer aux étudiants, et les corriger automatiquement par IA (GPT-4). Destinée aux écoles, universités et grandes écoles. Premier pilote prévu avec l'ESSEC.

## Core Value

Les professeurs peuvent créer un examen complet et obtenir une correction automatisée de qualité avec feedback personnalisé pour chaque étudiant — sans effort manuel de notation.

## Requirements

### Validated

Fonctionnalités existantes dans le codebase :

- ✓ Authentification multi-tenant (credentials + SSO) — existing
- ✓ Gestion des rôles (PLATFORM_ADMIN, SCHOOL_ADMIN, TEACHER, STUDENT) — existing
- ✓ Interface admin plateforme — existing
- ✓ Interface admin école (base) — existing
- ✓ Interface professeur (base) — existing
- ✓ Interface étudiant (base) — existing
- ✓ Création d'examen (partielle, QCM + questions ouvertes) — existing
- ✓ Passage d'examen par étudiant — existing
- ✓ Correction IA partielle (BullMQ job queue) — existing
- ✓ Protection CSRF — existing
- ✓ Internationalisation (i18n) — existing
- ✓ Rate limiting (Redis) — existing

### Active

Requis pour le pilote ESSEC :

**Éditeur Étudiant**
- [ ] Éditeur mathématique WYSIWYG avec boutons pour symboles
- [ ] Fractions, exposants, racines carrées
- [ ] Symboles grecs (α, β, θ, etc.)
- [ ] Intégrales, sommes, limites avec positions cliquables
- [ ] Intégration dans les réponses d'examen

**Création d'Examen**
- [ ] Interface intuitive de création d'examen (refonte UX)
- [ ] Support questions ouvertes avec barème
- [ ] Support QCM avec options multiples
- [ ] Support photo + texte comme question
- [ ] Prévisualisation de l'examen avant publication

**Correction IA**
- [ ] Correction fonctionnelle avec GPT-4
- [ ] Notation automatique selon barème défini
- [ ] Feedback personnalisé par étudiant (optionnel mais souhaité)
- [ ] Gestion des réponses mathématiques

**Export Résultats**
- [ ] Export CSV des notes
- [ ] Export PDF rapport de correction

**Gestion Organisation (Admin École)**
- [ ] Création de classes
- [ ] Création de sous-groupes (TD, TP, etc.)
- [ ] Affectation des étudiants aux classes/sous-groupes
- [ ] Attribution des rôles (professeur, admin)
- [ ] Import CSV/Excel des utilisateurs

### Out of Scope

- Upload de PDF entier comme examen — réponses doivent être isolées pour meilleure correction IA
- Écriture LaTeX directe par étudiant — cible non-technique, boutons uniquement
- SSO/Annuaire pour import utilisateurs — CSV/Excel suffit pour pilote
- Matrices et vecteurs dans éditeur math — pas prioritaire pour pilote
- Application mobile — web-first

## Context

**Codebase existant :**
- Next.js 16.1.1 avec App Router, React 19.2.0
- Prisma + PostgreSQL, BullMQ + Redis pour jobs
- mathlive 0.108.2 déjà installé (éditeur équations)
- Architecture multi-tenant avec isolation par institution

**Pilote ESSEC :**
- Grande école + BBA
- Étudiants habitués aux examens exigeants
- Échéance : quelques semaines

**État actuel :**
- Code existe pour toutes les fonctionnalités mais qualité insuffisante pour vente
- Interface création d'examen confuse
- Éditeur mathématique commencé mais incomplet
- Correction IA partielle

## Constraints

- **Stack**: Next.js App Router, React, Prisma, PostgreSQL — existant
- **IA**: OpenAI GPT-4 pour correction
- **UX Éditeur**: Boutons uniquement, pas de LaTeX visible, positions cliquables
- **Isolation réponses**: Pas de PDF entier, réponses individuelles pour correction IA
- **Timeline**: Pilote ESSEC dans quelques semaines

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| mathlive pour éditeur math | Déjà installé, WYSIWYG, bon support | — Pending |
| GPT-4 pour correction | Qualité de correction, déjà prévu | — Pending |
| Pas de PDF entier | Isolation réponses = meilleure correction IA | — Pending |
| Boutons (pas LaTeX) | Étudiants non-techniques | — Pending |
| Import CSV (pas SSO) | Simplicité pour pilote | — Pending |

---
*Last updated: 2026-01-18 after initialization*
