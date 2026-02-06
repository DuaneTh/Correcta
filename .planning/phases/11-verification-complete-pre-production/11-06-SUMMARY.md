---
phase: 11-verification-complete-pre-production
plan: 06
subsystem: accessibility
tags: [accessibility, wcag, a11y, lang, alt-text, form-labels, keyboard-nav]
requires: ["02", "03"]
provides:
  - Dynamic lang attribute on root layout
  - All images have meaningful alt text
  - All form inputs have label associations
  - Keyboard navigation verified on modals
affects: [accessibility-compliance, lighthouse-score]
tech-stack:
  added: []
  patterns:
    - "Dynamic locale-based lang attribute from cookie"
    - "htmlFor/id label association pattern"
    - "aria-label for inputs without visible labels"
key-files:
  created: []
  modified:
    - app/layout.tsx
    - app/login/LoginForm.tsx
    - app/student/attempts/[attemptId]/ExamRoomClient.tsx
    - components/admin/school/CourseFormModal.tsx
    - components/exam-editor/ExamHeader.tsx
    - components/exam-editor/question-types/MultipleChoiceEditor.tsx
decisions:
  - decision: "Use cookie-based locale detection for lang attribute"
    rationale: "Root layout is async server component, can read cookies directly"
    impact: "HTML lang attribute correctly reflects user's chosen locale"
metrics:
  duration: 8min
  completed: 2026-02-06
---

# Phase 11 Plan 06: Accessibility Audit Summary

**One-liner:** Audited and fixed accessibility issues across all pages — dynamic lang attribute, form label associations, aria-labels, and viewport meta tag.

## What Was Done

### Task 1: Accessibility Fixes (Auto)

**1. Root Layout Accessibility:**
- Added dynamic `lang={locale}` attribute to `<html>` element based on locale cookie
- Added `<meta name="viewport" content="width=device-width, initial-scale=1" />` to `<head>`
- Updated metadata with proper title and description

**2. Image Alt Text Audit:**
- Verified all `<Image>` and `<img>` tags across the codebase
- All images already had meaningful alt text — no fixes needed

**3. Form Label Audit:**
- `app/login/LoginForm.tsx` — Added `htmlFor`/`id` associations to email and password inputs
- `app/student/attempts/[attemptId]/ExamRoomClient.tsx` — Added `aria-label` to honor statement textarea
- `components/admin/school/CourseFormModal.tsx` — Added `htmlFor`/`id` to course name and subject inputs
- `components/exam-editor/ExamHeader.tsx` — Added `aria-label` to exam title input
- `components/exam-editor/question-types/MultipleChoiceEditor.tsx` — Added `aria-label` to MCQ option inputs

**4. Keyboard Navigation Audit:**
- Verified `ConfirmModal.tsx` has focus trap and Escape key handler (via HeadlessUI Dialog)
- Verified `Drawer.tsx` has focus trap and Escape key handler (via HeadlessUI Dialog)
- Verified interactive elements have focus ring styles
- No fixes needed — existing implementation handles keyboard nav correctly

**5. Color Contrast:**
- `brand-900` (#1e1b4b) on white provides ~16:1 contrast ratio (exceeds WCAG AA 4.5:1)
- Badge colors verified as readable on white backgrounds
- No fixes needed

### Task 2: Human Verification Checkpoint

Manual verification checklist for Lighthouse audit:
1. Run `npm run dev` and test Lighthouse accessibility on `/login`, `/student/courses`, `/teacher/courses` (target >= 80)
2. Keyboard navigation: Tab through login form, exam editor, modals
3. Error boundary: Navigate to non-existent URL for 404 page
4. Language switcher: FR/EN toggle shows correct translations
5. Empty states: Pages with no data show EmptyState component

## Verification Results

**Programmatic checks:**
- TypeScript compilation: `npx tsc --noEmit` passed
- All `<Image>` tags have `alt` attributes (grep verified)
- Root layout has `lang={locale}` on `<html>` element
- Viewport meta tag present in `<head>`

## Files Modified

| File | Change |
|------|--------|
| `app/layout.tsx` | Dynamic `lang` attribute, viewport meta, metadata |
| `app/login/LoginForm.tsx` | `htmlFor`/`id` on email and password inputs |
| `app/student/attempts/[attemptId]/ExamRoomClient.tsx` | `aria-label` on honor textarea |
| `components/admin/school/CourseFormModal.tsx` | `htmlFor`/`id` on form inputs |
| `components/exam-editor/ExamHeader.tsx` | `aria-label` on exam title input |
| `components/exam-editor/question-types/MultipleChoiceEditor.tsx` | `aria-label` on MCQ option inputs |

## Commits

- `cff1e28` — feat(11-06): audit and fix accessibility issues

## Deviations from Plan

None — Task 1 executed as planned. Task 2 (human checkpoint) deferred to manual testing.

## Next Phase Readiness

**Blockers:** None
**Concerns:** Lighthouse score should be verified manually before production deploy
