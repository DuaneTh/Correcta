# Phase 6: UI Kit Integration - Research

**Researched:** 2026-02-02
**Domain:** React UI Component Migration & Design System Implementation
**Confidence:** HIGH

## Summary

Phase 6 involves migrating all application pages from raw HTML/Tailwind patterns to a consistent, type-safe UI Kit. The feat/kourpat1 branch has delivered foundational UI components (Button, Card, Badge, Text, Layout primitives, Form components) that now exist on main. TeacherCoursesClient.tsx serves as the reference implementation pattern.

This research examined modern React 19 component patterns, Next.js App Router best practices, incremental migration strategies, and design system implementation pitfalls. The standard approach for 2026 is an incremental, component-by-component migration using the "strangler fig" pattern, where new UI Kit components coexist with legacy raw HTML/Tailwind code until full migration is complete.

The existing codebase already has partial UI Kit adoption (Drawer, ConfirmModal, CsvUploader used in admin pages) but still contains extensive raw Tailwind markup that should be replaced with typed components. The migration must maintain functionality while improving consistency, reducing bundle size through component reuse, and establishing patterns for future development.

**Primary recommendation:** Migrate incrementally by page grouping (admin/teacher/student/modals), using TeacherCoursesClient.tsx patterns, starting with highest-impact pages (most-used dashboards first).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | Component framework | Modern hooks, concurrent features, ref as prop |
| Next.js | ^16.1.1 | App Router framework | Server/client component patterns, routing |
| TypeScript | 5.x | Type safety | Component prop validation, IDE autocomplete |
| Tailwind CSS | v4 | Utility-first styling | Design tokens, existing codebase standard |
| tailwind-merge | ^3.4.0 | Class merging | Conflict resolution for component variants |
| clsx | ^2.1.1 | Conditional classes | Runtime class composition |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.554.0 | Icon library | All UI icons (already used extensively) |
| @headlessui/react | ^2.2.9 | Unstyled primitives | Complex interactions (dropdowns, dialogs) if needed |
| React Aria | N/A | Accessibility primitives | If UI Kit needs WCAG-compliant unstyled components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom UI Kit | shadcn/ui | shadcn provides copy-paste components but we already have UI Kit |
| Custom UI Kit | Material UI (MUI) | MUI has 50+ components but heavy bundle, different design system |
| tailwind-merge | manual className logic | tailwind-merge handles precedence correctly, avoid bugs |

**Installation:**
```bash
# All dependencies already installed
# UI Kit components exist in components/ui/
# No additional packages needed
```

## Architecture Patterns

### Current Project Structure
```
components/
├── ui/                     # UI Kit components
│   ├── ConfirmModal.tsx   # Existing: confirmation dialogs
│   ├── Drawer.tsx         # Existing: side panels
│   ├── CsvUploader.tsx    # Existing: CSV import
│   ├── DateInput.tsx      # Existing: date pickers
│   ├── DateTimePicker.tsx # Existing: datetime selection
│   └── ImageUpload.tsx    # Existing: image handling
├── admin/                  # Admin-specific components (need migration)
├── teacher/                # Teacher-specific components (need migration)
├── grading/                # Grading modals (need migration)
├── export/                 # Export modals (need migration)
└── exam-*/                 # Exam-related components

app/
├── admin/                  # Admin pages (need migration)
├── teacher/                # Teacher pages (partial migration)
├── student/                # Student pages (need migration)
└── dashboard/              # Dashboard pages (need migration)
```

### Pattern 1: Component Migration - Replace Raw HTML with UI Kit
**What:** Replace raw HTML elements and inline Tailwind with typed UI Kit components
**When to use:** All pages during migration
**Example:**
```typescript
// BEFORE (raw HTML/Tailwind):
<button
  type="button"
  onClick={handleClick}
  className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
>
  Create
</button>

// AFTER (UI Kit):
import { Button } from '@/components/ui/Button'

<Button variant="primary" size="md" onClick={handleClick}>
  Create
</Button>
```

### Pattern 2: Layout Primitives - Stack, Grid, Inline
**What:** Use Layout components for spacing and arrangement instead of flex/grid classes
**When to use:** All layout composition
**Example:**
```typescript
// BEFORE:
<div className="flex flex-col gap-6">
  <div className="flex items-center justify-between">
    <h1 className="text-3xl font-bold text-brand-900">Title</h1>
    <button>Action</button>
  </div>
</div>

// AFTER:
import { Stack, Inline } from '@/components/ui/Layout'
import { Text } from '@/components/ui/Text'

<Stack gap="6">
  <Inline align="center" justify="between">
    <Text variant="heading-xl" color="brand">Title</Text>
    <Button>Action</Button>
  </Inline>
</Stack>
```

### Pattern 3: Card Pattern - Consistent Container Styling
**What:** Use Card and CardBody for all card-like containers
**When to use:** Lists, panels, content blocks
**Example:**
```typescript
// BEFORE:
<div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
  <div className="text-sm text-gray-500">Content</div>
</div>

// AFTER:
import { Card, CardBody } from '@/components/ui/Card'

<Card>
  <CardBody>
    <Text variant="body-sm" color="secondary">Content</Text>
  </CardBody>
</Card>
```

### Pattern 4: Badge Pattern - Status Indicators
**What:** Use Badge component with variants instead of custom span styling
**When to use:** Status indicators, tags, labels
**Example:**
```typescript
// BEFORE (CourseCodeBadge.tsx):
<span className="inline-flex items-center rounded-full border border-brand-900/20 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-900">
  {code}
</span>

// AFTER:
import { Badge } from '@/components/ui/Badge'

<Badge variant="brand" size="md">{code}</Badge>
```

### Pattern 5: Modal/Drawer Consolidation
**What:** Use existing Drawer and ConfirmModal consistently, potentially wrap in UI Kit pattern
**When to use:** All modals and side panels
**Example:**
```typescript
// Source: Current codebase (SchoolUsersClient.tsx)
import Drawer from '@/components/ui/Drawer'
import ConfirmModal from '@/components/ui/ConfirmModal'

// Drawer for forms/details:
<Drawer open={drawerOpen} onClose={closeDrawer} title="Edit User">
  <Stack gap="4">
    <Input label="Name" value={name} onChange={setName} />
    <Button onClick={handleSave}>Save</Button>
  </Stack>
</Drawer>

// ConfirmModal for destructive actions:
<ConfirmModal
  open={confirmOpen}
  title="Archive User?"
  description="This will archive the user."
  confirmLabel="Archive"
  cancelLabel="Cancel"
  onConfirm={handleArchive}
  onCancel={closeConfirm}
/>
```

### Pattern 6: Form Components Pattern
**What:** Use Form components (Input, Select, Textarea) from UI Kit
**When to use:** All form inputs
**Example:**
```typescript
// Assuming UI Kit has these (mentioned in phase context):
import { Input, Select, Textarea } from '@/components/ui/Form'

<Stack gap="4">
  <Input
    label="Email"
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    required
  />
  <Select
    label="Role"
    value={role}
    onChange={(e) => setRole(e.target.value)}
    options={roleOptions}
  />
  <Textarea
    label="Notes"
    value={notes}
    onChange={(e) => setNotes(e.target.value)}
    rows={4}
  />
</Stack>
```

### Pattern 7: Incremental Migration - Strangler Fig
**What:** Migrate page by page, keeping old and new patterns coexisting
**When to use:** During Phase 6 execution
**Example:**
```typescript
// Page can mix old and new during transition:
import { Button } from '@/components/ui/Button'  // NEW

export default function MyPage() {
  return (
    <div className="flex flex-col gap-6">  {/* OLD: not yet migrated */}
      <Button variant="primary">New UI Kit Button</Button>  {/* NEW */}
      <button className="rounded-md bg-brand-900...">Old Button</button>  {/* OLD */}
    </div>
  )
}
// Gradually replace old patterns with UI Kit components
```

### Pattern 8: cn() Utility for Custom Styling
**What:** Use cn() utility for merging Tailwind classes when customization needed
**When to use:** Component variants, conditional styling
**Example:**
```typescript
// Source: Mentioned in phase context (components/ui/cn.ts)
import { cn } from '@/components/ui/cn'

<Button
  className={cn(
    "custom-class",
    isActive && "bg-brand-700",
    disabled && "opacity-50"
  )}
>
  Click
</Button>
```

### Anti-Patterns to Avoid
- **Inconsistent component usage:** Don't mix UI Kit Button with raw HTML buttons in same page - commit to UI Kit once started
- **Bypassing cn() utility:** Don't manually concatenate className strings - use cn() for proper precedence handling
- **Over-customization:** Don't add className overrides to every UI Kit component - if pattern repeats, extend UI Kit instead
- **Breaking existing UI Kit patterns:** Don't modify existing Drawer/ConfirmModal APIs - maintain backward compatibility
- **Big-bang migration:** Don't try to migrate all pages at once - incremental by page grouping is safer

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Class name merging | String concatenation or template literals | tailwind-merge (cn() utility) | Handles Tailwind precedence rules correctly, prevents style conflicts |
| Modal focus management | Manual focus trap with useEffect | Existing ConfirmModal/Drawer components | Already implements ARIA, keyboard nav, focus trap, body scroll lock |
| Icon sizing/styling | Inline Tailwind on each icon | lucide-react components with size prop | Consistent sizing, accessibility labels, tree-shakeable |
| Badge variants | Multiple custom badge components | Single Badge component with variants | DRY principle, consistent styling, easier theme updates |
| Form validation state | Inline error spans | UI Kit Input/Select with error prop | Consistent error styling, ARIA attributes, accessibility |
| Loading states | Custom spinners | UI Kit Button with loading prop | Consistent UX, prevents duplicate clicks, ARIA live regions |
| Empty states | Raw div with text | EmptyState component (from kourpat1) | Consistent messaging, optional illustration support |
| Status indicators | Custom span styling per status | Badge or StatusBadge component | Type-safe variants, consistent color system |

**Key insight:** UI migration isn't about recreating every pattern from scratch - most common UI problems have established component solutions. The goal is recognizing when to use existing UI Kit components vs. when you truly need custom logic. Custom styling should be exceptional, not the default.

## Common Pitfalls

### Pitfall 1: Forcing UI Kit Before Merge Confirmation
**What goes wrong:** Planning documents assume feat/kourpat1 components exist, but migration happens before merge confirmation
**Why it happens:** Asynchronous branch merging vs. planning timelines
**How to avoid:** Verify UI Kit components exist in main branch before starting migration tasks
**Warning signs:** Import errors for Button, Card, Badge, Text, Layout components

### Pitfall 2: Inconsistent Migration Boundaries
**What goes wrong:** Half-migrating a page leaves inconsistent UI patterns (some buttons are UI Kit, some raw HTML)
**Why it happens:** Developer fatigue, unclear task boundaries, time pressure
**How to avoid:** Define migration boundary per task: migrate entire page/section at once, not scattered components
**Warning signs:** Same page has mix of `<Button>` and `<button className="rounded-md...">`, inconsistent spacing

### Pitfall 3: Breaking Existing Functionality During Migration
**What goes wrong:** Replacing raw HTML changes behavior (form submission, event bubbling, focus management)
**Why it happens:** UI Kit components may have different default behaviors than raw HTML
**How to avoid:** Test all interactions after migration (click handlers, form submission, keyboard nav), use React DevTools to verify event handlers
**Warning signs:** Forms not submitting, click handlers not firing, keyboard navigation broken

### Pitfall 4: Overriding UI Kit Styles Too Freely
**What goes wrong:** Every component has custom className overrides, defeating UI Kit purpose
**Why it happens:** Designer pixel-perfect requirements, resistance to standardization
**How to avoid:** Use UI Kit variants first, only add className for truly exceptional cases, propose new variants if pattern repeats
**Warning signs:** Most UI Kit components have className prop with 5+ Tailwind classes, inline styles appearing

### Pitfall 5: Not Using cn() Utility for Class Merging
**What goes wrong:** Manual string concatenation causes Tailwind precedence bugs (e.g., "bg-red-500 bg-blue-500" shows blue, not red)
**Why it happens:** Developer unfamiliar with tailwind-merge, copy-paste from old code
**How to avoid:** Always import cn() for className merging, code review to catch string concatenation
**Warning signs:** Template literals like `className={\`base-class \${conditional ? 'override' : ''}\`}` without cn()

### Pitfall 6: Ignoring TypeScript Errors During Migration
**What goes wrong:** TypeScript errors suppressed with @ts-ignore, losing type safety benefits
**Why it happens:** UI Kit component props don't match raw HTML attributes, quick workaround instead of proper fix
**How to avoid:** Fix TypeScript errors properly by reading UI Kit component types, adjust prop names/values
**Warning signs:** Multiple @ts-ignore or @ts-expect-error comments in migrated files

### Pitfall 7: Neglecting Accessibility During Migration
**What goes wrong:** Keyboard navigation breaks, screen readers lose context, focus management incorrect
**Why it happens:** Raw HTML had implicit ARIA, UI Kit components need explicit props
**How to avoid:** Test with keyboard-only navigation, use Lighthouse accessibility audit, verify ARIA labels
**Warning signs:** Tab order wrong, no focus indicators, screen reader announces wrong information

### Pitfall 8: Component Prop API Inconsistency
**What goes wrong:** Different pages use different prop patterns for same component (size="md" vs size="medium", variant="primary" vs color="primary")
**Why it happens:** UI Kit lacks documentation, developers guess prop names
**How to avoid:** Document UI Kit prop APIs clearly, use TeacherCoursesClient.tsx as reference, code review for consistency
**Warning signs:** PropType warnings in console, components not rendering as expected

### Pitfall 9: Missing Mobile Responsiveness
**What goes wrong:** Desktop looks great, mobile layout breaks or has usability issues
**Why it happens:** Migration focused on desktop view, Tailwind responsive classes not applied
**How to avoid:** Test mobile viewport during migration, use responsive Tailwind variants (sm:, md:, lg:), verify touch targets
**Warning signs:** Horizontal scroll on mobile, buttons too small for touch, overlapping elements

### Pitfall 10: Not Testing Edge Cases
**What goes wrong:** UI breaks with long text, empty states, many items, loading states
**Why it happens:** Only tested with happy path data during migration
**How to avoid:** Test with extreme data (0 items, 1000 items, very long names, special characters), verify loading/error states
**Warning signs:** Text overflow, layout breaks with many items, loading state flashes incorrectly

## Code Examples

Verified patterns from official sources and existing codebase:

### TeacherCoursesClient.tsx - Reference Implementation
```typescript
// Source: app/teacher/courses/TeacherCoursesClient.tsx (existing codebase)
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CourseCodeBadge } from '@/components/teacher/CourseCodeBadge'
import { ExamStatusBadge } from '@/components/teacher/ExamStatusBadge'
import { Search, LayoutGrid, List, Plus, ArrowUpRight } from 'lucide-react'

export default function TeacherCoursesClient({ courses, dictionary }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  return (
    <div className="space-y-8">
      {/* Header with search and filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-brand-900">{dict.title}</h1>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          {/* Search input with icon */}
          <div className="relative w-full sm:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* View mode toggle */}
          <div className="inline-flex rounded-md border border-gray-300 bg-white p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
                viewMode === 'grid' ? 'bg-brand-900 text-white' : 'text-gray-600'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Grid</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
                viewMode === 'list' ? 'bg-brand-900 text-white' : 'text-gray-600'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Course cards - migration target */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <div
              key={course.id}
              className="group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow"
            >
              {/* Card content with badges */}
              <div className="flex flex-col px-4 py-4 sm:p-5">
                <CourseCodeBadge code={course.code} />
                <h3 className="text-base font-semibold text-gray-900">{course.name}</h3>
                <ExamStatusBadge label={status} className="..." />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
```

### Drawer Pattern - Form in Side Panel
```typescript
// Source: app/admin/school/users/SchoolUsersClient.tsx (existing codebase)
import Drawer from '@/components/ui/Drawer'

export default function SchoolUsersClient() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '' })

  return (
    <>
      <button onClick={() => setDrawerOpen(true)}>Create User</button>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Create User"
      >
        <div className="grid grid-cols-1 gap-4">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            <span className="font-medium">Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            <span className="font-medium">Email *</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-brand-900 px-4 py-2 text-sm text-white"
          >
            Create
          </button>
        </div>
      </Drawer>
    </>
  )
}
```

### ConfirmModal Pattern - Destructive Actions
```typescript
// Source: components/ui/ConfirmModal.tsx (existing codebase)
import ConfirmModal from '@/components/ui/ConfirmModal'

export default function UserManagement() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState('')

  const requestDelete = (userId: string) => {
    setPendingDeleteId(userId)
    setConfirmOpen(true)
  }

  const handleDelete = async () => {
    // Perform deletion
    await deleteUser(pendingDeleteId)
    setConfirmOpen(false)
  }

  return (
    <>
      <button onClick={() => requestDelete(user.id)}>Delete</button>

      <ConfirmModal
        open={confirmOpen}
        title="Delete User?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
```

### Badge Component Pattern
```typescript
// Source: components/teacher/CourseCodeBadge.tsx (existing codebase)
// BEFORE migration to UI Kit:
interface CourseCodeBadgeProps {
  code: string
  className?: string
}

export function CourseCodeBadge({ code, className = '' }: CourseCodeBadgeProps) {
  const baseClasses = "inline-flex items-center rounded-full border border-brand-900/20 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-900"

  return (
    <span className={className ? `${baseClasses} ${className}` : baseClasses}>
      {code}
    </span>
  )
}

// AFTER migration (assuming UI Kit Badge component):
import { Badge } from '@/components/ui/Badge'

export function CourseCodeBadge({ code }: { code: string }) {
  return <Badge variant="brand" size="md">{code}</Badge>
}
```

### Modal Focus Trap Pattern
```typescript
// Source: components/ui/ConfirmModal.tsx (existing pattern - don't recreate)
const getFocusable = (container: HTMLElement | null): HTMLElement[] => {
  if (!container) return []
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ]
  return Array.from(container.querySelectorAll<HTMLElement>(selectors.join(',')))
}

// Focus trap keyboard handler:
const handleTrap = (event: React.KeyboardEvent<HTMLDivElement>) => {
  if (event.key !== 'Tab') return
  const focusable = getFocusable(panelRef.current)
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

// DON'T HAND-ROLL THIS - use existing ConfirmModal/Drawer components
```

### Migration Example - Admin Page
```typescript
// BEFORE migration (raw HTML/Tailwind):
export default function SchoolDashboardClient({ stats }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-brand-900">Dashboard</h1>
        <button className="rounded-md bg-brand-900 px-4 py-2 text-sm text-white hover:bg-brand-800">
          Create Course
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-500">Total Students</div>
          <div className="text-3xl font-bold text-gray-900">{stats.students}</div>
        </div>
      </div>
    </div>
  )
}

// AFTER migration (UI Kit):
import { Stack, Grid, Inline } from '@/components/ui/Layout'
import { Text } from '@/components/ui/Text'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function SchoolDashboardClient({ stats }) {
  return (
    <Stack gap="6">
      <Inline align="center" justify="between">
        <Text variant="heading-3xl" color="brand">Dashboard</Text>
        <Button variant="primary" size="md">Create Course</Button>
      </Inline>

      <Grid cols={{ base: 1, sm: 2, lg: 4 }} gap="6">
        <Card>
          <CardBody>
            <Text variant="body-sm" color="secondary">Total Students</Text>
            <Text variant="heading-3xl" color="primary">{stats.students}</Text>
          </CardBody>
        </Card>
      </Grid>
    </Stack>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Class components | Function components + hooks | React 16.8 (2019) | All new code uses functions, migrations still happening |
| forwardRef for refs | ref as prop | React 19 (2024) | Simpler component APIs, less boilerplate |
| Multiple component libraries | Copy-paste components (shadcn pattern) | 2023-2024 | Ownership of code, customization freedom, smaller bundles |
| CSS-in-JS (styled-components) | Tailwind utility-first | 2020-2024 | Faster builds, no runtime overhead, better DX |
| Global state (Redux) for everything | Local state + Context | 2020-present | Simpler state management, less boilerplate for simple cases |
| Component libraries via npm | UI Kit in codebase | 2024-2026 | Full control, no version conflicts, easier customization |

**Deprecated/outdated:**
- **@apply directive in Tailwind:** Modern pattern is components, not CSS extraction (still works but not preferred)
- **React.FC type:** Removed from Create React App templates, just use `function Component(props: Props)`
- **index.ts barrel exports:** Can slow down build times, import directly from component files
- **forwardRef:** React 19 accepts ref as prop, forwardRef only needed for backward compatibility
- **PropTypes:** Removed from React 19, migrate to TypeScript for type checking

## Open Questions

Things that couldn't be fully resolved:

1. **feat/kourpat1 Component APIs**
   - What we know: Branch has Button, Card, Badge, Text, Layout (Stack, Grid, Inline), Form components
   - What's unclear: Exact prop APIs, variant names, size options, TypeScript types
   - Recommendation: Wait for merge to main, then audit actual component APIs before planning detailed migration tasks

2. **SearchField vs. Input Component**
   - What we know: Phase context mentions SearchField.tsx from kourpat1
   - What's unclear: Should search inputs use Input or SearchField? When to use which?
   - Recommendation: Check UI Kit reference page at /internal/ui-kit after merge for guidance

3. **SegmentedControl Usage**
   - What we know: SegmentedControl.tsx exists from kourpat1
   - What's unclear: When to use SegmentedControl vs. tabs vs. button groups (like view mode toggle in TeacherCoursesClient)
   - Recommendation: Document SegmentedControl use cases in UI Kit showcase

4. **StatPill Component**
   - What we know: StatPill.tsx exists for dashboard stats
   - What's unclear: How it differs from Card + CardBody pattern for stat displays
   - Recommendation: Use StatPill for dashboard metrics, Card for other content blocks

5. **TextLink vs. Link vs. Button**
   - What we know: TextLink.tsx exists, Next.js has Link component
   - What's unclear: When to use TextLink vs. Next.js Link vs. Button with link styling
   - Recommendation: TextLink for inline text links, Button for actions, Next.js Link for navigation (wrap with TextLink if needed)

6. **Modal Consolidation Strategy**
   - What we know: Multiple modal types exist (GradeEditModal, RubricReviewModal, ExportProgressModal, etc.)
   - What's unclear: Should they all extend a base Modal component, or remain specialized?
   - Recommendation: Keep specialized modals if they have unique layouts, extract common patterns into hooks (useModalFocus, useBodyScrollLock)

7. **Grid Responsive Breakpoints**
   - What we know: UI Kit has Grid component
   - What's unclear: Breakpoint naming convention (base/sm/md/lg or xs/sm/md/lg/xl)
   - Recommendation: Check Layout.tsx after merge for exact breakpoint prop API

8. **Icon Size Standardization**
   - What we know: lucide-react used extensively, icons have h-4 w-4, h-5 w-5, etc.
   - What's unclear: Should UI Kit Button handle icon sizing, or manual className on each icon?
   - Recommendation: If Button accepts icon prop, it should handle sizing; otherwise document standard sizes

9. **Loading States Pattern**
   - What we know: Current code doesn't have consistent loading indicators
   - What's unclear: Does UI Kit Button support loading prop? Should there be Spinner component?
   - Recommendation: Check Button API for loading support, add Spinner if missing

10. **Empty State Illustrations**
    - What we know: EmptyState.tsx exists from kourpat1
    - What's unclear: Does it support illustrations/images, or just text?
    - Recommendation: Check EmptyState API for illustration prop, add if user feedback is positive

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `app/teacher/courses/TeacherCoursesClient.tsx`, `app/admin/school/users/SchoolUsersClient.tsx`, `components/ui/ConfirmModal.tsx`, `components/ui/Drawer.tsx`, `components/teacher/CourseCodeBadge.tsx`, `components/teacher/ExamStatusBadge.tsx`, `components/grading/GradeEditModal.tsx`
- package.json dependencies: React 19.2.0, Next.js 16.1.1, Tailwind CSS v4, tailwind-merge 3.4.0, clsx 2.1.1, lucide-react 0.554.0

### Secondary (MEDIUM confidence)
- [15 Best React UI Libraries for 2026](https://www.builder.io/blog/react-component-libraries-2026) - Modern UI library patterns
- [React Stack Patterns](https://www.patterns.dev/react/react-2026/) - 2026 React architecture patterns
- [14 Best React UI Component Libraries in 2026](https://www.untitledui.com/blog/react-component-libraries) - TypeScript support trends
- [React 19 and TypeScript Best Practices Guide (2025)](https://medium.com/@CodersWorld99/react-19-typescript-best-practices-the-new-rules-every-developer-must-follow-in-2025-3a74f63a0baf) - React 19 component patterns
- [Next.js App Router — Advanced Patterns for 2026](https://medium.com/@beenakumawat002/next-js-app-router-advanced-patterns-for-2026-server-actions-ppr-streaming-edge-first-b76b1b3dcac7) - Server/client component patterns
- [Tailwind CSS Best Practices 2025-2026](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns) - Design token patterns
- [Common Mistakes When Upgrading to React 19](https://blog.openreplay.com/common-mistakes-upgrading-react-19-avoid/) - Migration pitfalls
- [5 Things to avoid when building a design system](https://backlight.dev/blog/5-things-to-avoid-when-building-a-design-system) - Design system mistakes
- [Design Systems Pitfalls](https://medium.com/@withinsight1/design-systems-pitfalls-6b3113fa0898) - Implementation anti-patterns

### Tertiary (LOW confidence)
- [Pro Tips for Design System Migration in Large Projects](https://medium.com/@houhoucoop/pro-tips-for-ui-library-migration-in-large-projects-d54f0fbcd083) - Migration strategy (single blog post)
- [Migration strategies in large codebases](https://www.scottberrevoets.com/2022/11/15/migration-strategies-in-large-codebases/) - Older article (2022) but solid principles
- [Incremental Migrations with Microfrontends](https://vercel.com/kb/guide/incremental-migrations-with-microfrontends) - Vercel guide (may be overkill for this project)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies verified in package.json, React 19 and Next.js 16 confirmed
- Architecture: HIGH - TeacherCoursesClient.tsx provides concrete reference pattern, existing Drawer/ConfirmModal well-documented
- Patterns: MEDIUM-HIGH - Core patterns clear from codebase, but feat/kourpat1 component APIs need verification post-merge
- Pitfalls: HIGH - Sourced from 2026 articles and verified against existing codebase patterns
- Migration strategy: HIGH - Strangler fig pattern is industry standard, confirmed by multiple sources

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - UI migration patterns are relatively stable)

**Notes:**
- feat/kourpat1 branch merge status should be confirmed before detailed task planning
- UI Kit component APIs should be audited from actual code post-merge, not assumed
- TeacherCoursesClient.tsx is the gold standard reference for migration patterns
- Incremental migration (page-by-page) is strongly recommended over big-bang approach
- Focus on high-traffic pages first for maximum user impact
