---
phase: 03-organization
plan: 01
subsystem: organization-hierarchy
tags: [subgroups, class-hierarchy, sections, nested-groups]

dependency-graph:
  requires:
    - "Existing Class model in Prisma schema"
    - "Sections API at /api/admin/school/sections"
    - "SchoolClassesClient component with sections tab"
  provides:
    - "Hierarchical subgroup support for Class model"
    - "Parent-child relationships between sections"
    - "Visual hierarchy in sections table"
    - "Subgroup creation UI with parent dropdown"
  affects:
    - "Enrollment workflows (students can be in subgroups)"
    - "Exam assignment (can target subgroups)"

tech-stack:
  added: []
  patterns:
    - "Self-referencing relation (parentId -> Class)"
    - "Single level hierarchy (max 1 depth)"
    - "Hierarchical display with grouping in memo"
    - "Cascading dropdown (course -> parent section)"

key-files:
  created: []
  modified:
    - prisma/schema.prisma (Class model with parentId)
    - app/api/admin/school/sections/route.ts (subgroup CRUD)
    - lib/school-admin-data.ts (SectionRow type with parent/children)
    - app/admin/school/classes/SchoolClassesClient.tsx (hierarchical UI)
    - lib/i18n/dictionaries.ts (subgroup labels FR/EN)

decisions:
  - id: SINGLE-LEVEL-HIERARCHY
    choice: "Max 1 level of nesting (parent -> children, no grandchildren)"
    rationale: "Simpler to manage, covers typical use cases (TD1/TD2 under Finance 2026)"
  - id: NULLABLE-PARENTID
    choice: "parentId is nullable, root sections have null"
    rationale: "Non-breaking change, existing sections remain valid"
  - id: SAME-COURSE-VALIDATION
    choice: "Parent must be in same course as child"
    rationale: "Prevents cross-course relationships which would be confusing"
  - id: VISUAL-INDENTATION
    choice: "Subgroups indented with dash prefix and lighter background"
    rationale: "Clear visual hierarchy without complex tree rendering"

metrics:
  duration: "8 minutes"
  completed: "2026-01-20"
---

# Phase 03 Plan 01: Hierarchical Subgroups Summary

**One-liner:** Self-referencing parentId on Class model enables Finance 2026 > TD1/TD2/TD3 hierarchy with indented display and parent dropdown in section form.

## What Changed

### Schema
- Added `parentId` nullable field to Class model
- Added `parent` and `children` self-relations using "ClassHierarchy" name
- Non-breaking migration: existing sections get null parentId

### API (sections route)
- **GET**: Returns parentId, parent {id, name}, and children array
- **POST**: Accepts optional parentId, validates:
  - Parent exists in same course
  - Parent is not itself a subgroup (max 1 level)
  - Parent is not archived
- **PATCH**: Supports parentId update with same validations

### UI (SchoolClassesClient)
- Sections displayed hierarchically: parents first, children indented below
- Subgroup count badge on parent sections (e.g., "3 sous-groupe(s)")
- Parent section dropdown in create/edit drawer
- Search includes parent name
- Course selection resets parent dropdown

### Internationalization
- Added FR: "Groupe parent (optionnel)", "Aucun (section racine)", etc.
- Added EN: "Parent group (optional)", "None (root section)", etc.

## Verification Results

1. **Schema**: `npx prisma validate` passes
2. **TypeScript**: `npx tsc --noEmit` passes
3. **API**: POST with parentId creates subgroup correctly
4. **UI**: Sections tab shows hierarchy, drawer has parent dropdown

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 58eb329 | feat(03-01): add parentId to Class schema for subgroup hierarchy |
| 2 | 386f370 | feat(03-01): extend sections API for subgroup CRUD |
| 3 | be53e20 | (merged with 03-02 commit) UI hierarchical display |

## Next Phase Readiness

**Ready for Phase 03 Plan 02 (CSV Upload) and beyond.**

- Subgroup functionality complete
- Students can be enrolled in specific subgroups
- Exams can target subgroups via classId/classIds
