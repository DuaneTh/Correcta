---
phase: 06-ui-kit-integration
plan: 02
subsystem: ui
tags: [ui-kit, button, card, text, layout, form, admin]

# Dependency graph
requires:
  - phase: 06-01
    provides: UI Kit components (Button, Card, Text, Layout, Form, SearchField, EmptyState)
provides:
  - InstitutionsClient migrated to UI Kit
  - SchoolClassesClient migrated to UI Kit
  - SchoolUsersClient migrated to UI Kit
  - Admin page UI Kit migration pattern established
affects: [06-03, 06-04, 06-05, 06-06, 06-07, 06-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Admin page migration: header with Inline, tabs with Button variants, tables with UI Kit action buttons
    - Search/filter sections: Card + SearchField + Select components
    - Empty states: EmptyState component with compact size
    - Drawer forms: Stack layout with Input/Select from Form
    - Badge usage: variant prop for status colors

key-files:
  created: []
  modified:
    - app/admin/InstitutionsClient.tsx
    - app/admin/school/classes/SchoolClassesClient.tsx
    - app/admin/school/users/SchoolUsersClient.tsx

key-decisions:
  - "Use Button variants (primary/secondary/ghost/destructive) consistently across admin pages"
  - "Use Card + CardBody for containing sections with consistent padding"
  - "Use SearchField component instead of raw input for all search functionality"
  - "Use Badge component with semantic variants (neutral/info/success/warning) for status display"
  - "Use Stack for vertical layouts, Inline for horizontal layouts with proper gap spacing"

patterns-established:
  - "Admin table pattern: Card wrapper → table → Button actions in Inline"
  - "Tab pattern: Button components with primary variant for active, secondary for inactive"
  - "Drawer form pattern: Stack layout with Stack gap=xs for each field (label + input)"
  - "Empty state pattern: EmptyState with size='compact' for in-table empty views"

# Metrics
duration: 10min
completed: 2026-02-02
---

# Phase 6 Plan 2: Largest Admin Pages Migration Summary

**Migrated 3 largest admin pages (~2900 lines total) from raw HTML/Tailwind to UI Kit components: InstitutionsClient, SchoolClassesClient, SchoolUsersClient**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-02T09:18:38Z
- **Completed:** 2026-02-02T09:28:47Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Migrated InstitutionsClient (~795 lines) to use Button, Card, Text, Stack, Inline, Badge, SearchField, Input, Select, Textarea, EmptyState
- Migrated SchoolClassesClient (~1252 lines) to use full UI Kit component set including hierarchical section display with badges
- Migrated SchoolUsersClient (~853 lines) to use UI Kit components including CSV import drawer and role promotion
- Established admin page migration pattern: consistent component usage across all admin interfaces
- All business logic preserved: state management, event handlers, Drawer usage, ConfirmModal, API calls remain unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate InstitutionsClient** - `7866701` (feat)
   - Replaced page header, search/filter section, table with UI Kit components
   - Migrated all form fields in Drawer to Input/Select/Textarea
   - Replaced status badges with Badge component
   - TypeScript compiles clean, zero raw button/card patterns remain

2. **Task 2: Migrate SchoolClassesClient and SchoolUsersClient** - Already migrated in prior session (commit `732ff01`)
   - SchoolClassesClient: Tabs, search, three table views (courses/sections/exams), multiple drawers
   - SchoolUsersClient: Role tabs, search, user table, profile drawer, CSV import drawer
   - Both files use UI Kit components throughout
   - TypeScript compiles clean

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `app/admin/InstitutionsClient.tsx` - Platform admin institutions management (795 lines migrated)
- `app/admin/school/classes/SchoolClassesClient.tsx` - School admin courses/sections/exams (1252 lines migrated)
- `app/admin/school/users/SchoolUsersClient.tsx` - School admin teachers/students (853 lines migrated)

## Decisions Made

**Use consistent Button variant semantics across admin pages:**
- Primary: Main actions (create, save, submit)
- Secondary: Secondary actions (edit, cancel)
- Ghost: Tertiary actions (archive, restore, copy link)
- Destructive: Delete/remove actions

**Use Card + CardBody pattern for all contained sections:**
- Provides consistent border, shadow, and padding
- CardBody padding prop: 'sm' for compact areas, 'md' for standard sections

**Use SearchField for all search inputs:**
- Consistent search icon and styling
- Better UX than raw input fields

**Use Badge component with semantic variants:**
- neutral: Archived, disabled states
- info: Subgroups, metadata badges
- success: Active, published, valid states
- warning: Draft, invalid, pending states

## Deviations from Plan

None - plan executed as written. SchoolClassesClient and SchoolUsersClient were migrated following the same pattern as InstitutionsClient (shown in reference implementation TeacherCoursesClient.tsx).

## Issues Encountered

**Minor: SchoolClassesClient and SchoolUsersClient migration work completed in prior session**
- Resolution: Verified migrations are complete and correct, components properly imported and used
- Impact: Files already in correct state, only InstitutionsClient required fresh commit
- Both files use UI Kit components throughout with zero raw HTML/Tailwind button/card patterns

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 06-03: Smaller admin pages migration (remaining 5 admin pages)
- Pattern established: All future admin page migrations can follow this template
- TypeScript compilation clean for all migrated pages
- No blockers for subsequent UI Kit integration tasks

---
*Phase: 06-ui-kit-integration*
*Completed: 2026-02-02*
