---
phase: 03-organization
plan: 03
subsystem: organization
tags: [role-promotion, school-admin, server-action, authorization]

dependency-graph:
  requires: []
  provides: [promoteToSchoolAdmin-action, teacher-promotion-ui]
  affects: [04-ai-correction]

tech-stack:
  added: []
  patterns:
    - Server action pattern for role mutation
    - Institution-scoped authorization
    - Optimistic UI update on promotion

key-files:
  created:
    - lib/actions/organization.ts
  modified:
    - app/admin/school/users/SchoolUsersClient.tsx
    - lib/i18n/dictionaries.ts

decisions:
  - decision: Promotion only (no demotion)
    rationale: Research recommends demotion requires platform admin intervention
  - decision: Teachers-only promotion target
    rationale: Students should never be promoted to admin
  - decision: Optimistic UI removal on success
    rationale: Promoted user disappears from teacher list immediately

metrics:
  duration: 6 minutes
  completed: 2026-01-20
---

# Phase 03 Plan 03: Role Promotion Summary

**One-liner:** Server action for teacher-to-admin promotion with institution-scoped authorization and UI button with confirmation modal

## What Was Done

### Task 1: Create promoteToSchoolAdmin server action
- Created `lib/actions/organization.ts` with server action pattern
- Security checks:
  1. Caller must be SCHOOL_ADMIN role
  2. Target user must exist
  3. Target user must be in same institution as caller
  4. Target user must currently be TEACHER
- Revalidates `/admin/school/users` path after promotion
- Placeholder `demoteToTeacher` function for future use

### Task 2: Add promote button to teacher list UI
- Added `rolePromotion` dictionary entries for FR and EN
- Imported `promoteToSchoolAdmin` server action
- Added state for promotion confirmation flow:
  - `promoteConfirmOpen` - modal visibility
  - `pendingPromoteUser` - user being promoted
  - `promoting` - loading state
- Promote button:
  - Visible only when `activeRole === 'teacher'` and user not archived
  - Styled with `brand-900` border to differentiate from other actions
  - Positioned between Edit and Archive buttons
- Confirmation modal with description explaining implications
- `handlePromote` function removes user from teacher list on success

## Key Implementation Details

### Server Action Security
```typescript
// Verify caller is school admin
if (!session?.user || session.user.role !== 'SCHOOL_ADMIN') {
  return { success: false, error: 'Unauthorized' }
}

// Verify target user is in same institution
if (targetUser.institutionId !== session.user.institutionId) {
  return { success: false, error: 'User not in your institution' }
}

// Only teachers can be promoted
if (targetUser.role !== 'TEACHER') {
  return { success: false, error: 'Can only promote teachers' }
}
```

### UI Visibility Logic
```tsx
{activeRole === 'teacher' && !archived && (
  <button onClick={() => {
    setPendingPromoteUser({ id: user.id, name: user.name })
    setPromoteConfirmOpen(true)
  }}>
    {dict.rolePromotion.promoteButton}
  </button>
)}
```

## Deviations from Plan

None - plan executed exactly as written.

## Testing Notes

To verify:
1. Log in as a school admin
2. Navigate to `/admin/school/users?role=teacher`
3. See "Promouvoir Admin" button on non-archived teacher rows
4. Click button, see confirmation modal
5. Confirm, verify user disappears from teacher list
6. Switch to students tab - no promote button visible
7. Check database - promoted user now has SCHOOL_ADMIN role

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `lib/actions/organization.ts` | Created | Server action for role promotion |
| `app/admin/school/users/SchoolUsersClient.tsx` | Modified | Added promote button, state, and modal |
| `lib/i18n/dictionaries.ts` | Modified | Added rolePromotion entries (FR/EN) |

## Commits

| Hash | Message |
|------|---------|
| 68443f2 | feat(03-03): create promoteToSchoolAdmin server action |
| b9bb3a2 | feat(03-02): integrate CSV import into SchoolUsersClient (includes Task 2 changes) |

## Next Phase Readiness

- Server action ready for use by other organization features
- Pattern established for future role-related mutations
- No blockers for Phase 4 (AI Correction)
