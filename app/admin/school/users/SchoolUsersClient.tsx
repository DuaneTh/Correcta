'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { PersonRow, CourseRow, SectionRow } from '@/lib/school-admin-data'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'
import Drawer from '@/components/ui/Drawer'
import ConfirmModal from '@/components/ui/ConfirmModal'
import CsvUploader from '@/components/ui/CsvUploader'
import { promoteToSchoolAdmin } from '@/lib/actions/organization'

type CsvUser = { email: string; name: string }
type CsvUserStatus = 'valid' | 'invalid-email' | 'duplicate'

type SchoolUsersClientProps = {
    dictionary: Dictionary
    institutionId: string
    teachers: PersonRow[]
    students: PersonRow[]
    courses: CourseRow[]
    sections: SectionRow[]
}

const isArchived = (value?: string | null) => Boolean(value)
const normalizeValue = (value: string | null | undefined) => value?.toLowerCase().trim() ?? ''

const emptyUserForm = {
    name: '',
    email: '',
    password: '',
}

export default function SchoolUsersClient({
    dictionary,
    institutionId,
    teachers: initialTeachers,
    students: initialStudents,
    courses,
    sections,
}: SchoolUsersClientProps) {
    const dict = dictionary.admin.school
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const roleParam = searchParams.get('role') || 'teacher'
    const activeRole = roleParam === 'student' ? 'student' : 'teacher'
    const actionParam = searchParams.get('action')
    const userIdParam = searchParams.get('userId')

    const [teachers, setTeachers] = useState(initialTeachers)
    const [students, setStudents] = useState(initialStudents)
    const [search, setSearch] = useState('')
    const [showArchived, setShowArchived] = useState(false)

    const [drawerOpen, setDrawerOpen] = useState(false)
    const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
    const [editingUserId, setEditingUserId] = useState<string | null>(null)
    const [form, setForm] = useState({ ...emptyUserForm })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const [confirmOpen, setConfirmOpen] = useState(false)
    const [pendingArchiveId, setPendingArchiveId] = useState('')

    const [promoteConfirmOpen, setPromoteConfirmOpen] = useState(false)
    const [pendingPromoteUser, setPendingPromoteUser] = useState<{ id: string; name: string | null } | null>(null)
    const [promoting, setPromoting] = useState(false)

    // CSV Import state
    const [csvDrawerOpen, setCsvDrawerOpen] = useState(false)
    const [csvData, setCsvData] = useState<CsvUser[]>([])
    const [csvErrors, setCsvErrors] = useState<string[]>([])
    const [csvImporting, setCsvImporting] = useState(false)
    const [csvResult, setCsvResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)

    const drawerReturnFocusRef = useRef<HTMLElement | null>(null)
    const closingRef = useRef(false)

    const users = activeRole === 'teacher' ? teachers : students
    const setUsers = activeRole === 'teacher' ? setTeachers : setStudents

    const filteredUsers = useMemo(() => {
        const query = normalizeValue(search)
        return users.filter((user) => {
            if (!showArchived && isArchived(user.archivedAt)) return false
            if (!query) return true
            const name = normalizeValue(user.name)
            const email = normalizeValue(user.email)
            return name.includes(query) || email.includes(query)
        })
    }, [users, search, showArchived])

    const buildUrl = useCallback(
        (update: (params: URLSearchParams) => void) => {
            const params = new URLSearchParams(searchParams.toString())
            update(params)
            const query = params.toString()
            return query ? `${pathname}?${query}` : pathname
        },
        [pathname, searchParams]
    )

    const setRoleParam = useCallback((role: 'teacher' | 'student') => {
        const url = buildUrl((params) => {
            params.set('role', role)
            params.delete('action')
            params.delete('userId')
        })
        router.replace(url)
    }, [buildUrl, router])

    const openCreateDrawer = useCallback((trigger?: HTMLElement | null) => {
        setDrawerMode('create')
        setEditingUserId(null)
        setForm({ ...emptyUserForm })
        setError('')
        setDrawerOpen(true)
        if (trigger) drawerReturnFocusRef.current = trigger
        const url = buildUrl((params) => {
            params.set('action', 'add')
            params.delete('userId')
        })
        router.replace(url)
    }, [buildUrl, router])

    const openEditDrawer = useCallback((userId: string, trigger?: HTMLElement | null) => {
        const user = users.find((u) => u.id === userId)
        if (!user) return
        setDrawerMode('edit')
        setEditingUserId(userId)
        setForm({
            name: user.name || '',
            email: user.email || '',
            password: '',
        })
        setError('')
        setDrawerOpen(true)
        if (trigger) drawerReturnFocusRef.current = trigger
        const url = buildUrl((params) => {
            params.delete('action')
            params.set('userId', userId)
        })
        router.replace(url)
    }, [buildUrl, router, users])

    const closeDrawer = useCallback(() => {
        closingRef.current = true
        setDrawerOpen(false)
        const url = buildUrl((params) => {
            params.delete('action')
            params.delete('userId')
        })
        router.replace(url)
    }, [buildUrl, router])

    // Handle URL params on mount/change
    useEffect(() => {
        if (closingRef.current) {
            closingRef.current = false
            return
        }
        if (actionParam === 'add' && !drawerOpen) {
            openCreateDrawer()
        } else if (userIdParam && !drawerOpen) {
            openEditDrawer(userIdParam)
        }
    }, [actionParam, userIdParam, drawerOpen, openCreateDrawer, openEditDrawer])

    const handleSave = async () => {
        if (!form.email.trim()) {
            setError(dict.bulk.missingEmail)
            return
        }

        setSaving(true)
        setError('')

        try {
            const role = activeRole === 'teacher' ? 'TEACHER' : 'STUDENT'
            const payload: Record<string, unknown> = {
                institutionId,
                role,
                name: form.name.trim() || null,
                email: form.email.trim(),
            }
            if (form.password.trim()) {
                payload.password = form.password.trim()
            }

            if (drawerMode === 'create') {
                const result = await fetchJsonWithCsrf<{ user?: { id: string; name: string | null; email: string | null } }>(
                    '/api/admin/school/users',
                    { method: 'POST', body: payload }
                )
                if (result?.user) {
                    setUsers((prev) => [...prev, { ...result.user!, archivedAt: null, enrollments: [] }])
                    // Refresh SSR data so other pages (Enrollments, Dashboard) see the new user
                    router.refresh()
                }
            } else if (editingUserId) {
                await fetchJsonWithCsrf(
                    '/api/admin/school/users',
                    { method: 'PATCH', body: { ...payload, userId: editingUserId } }
                )
                setUsers((prev) =>
                    prev.map((u) =>
                        u.id === editingUserId
                            ? { ...u, name: form.name.trim() || null, email: form.email.trim() }
                            : u
                    )
                )
            }

            closeDrawer()
        } catch (err) {
            console.error('[Users] Save failed', err)
            setError(dict.saveError)
        } finally {
            setSaving(false)
        }
    }

    const handleArchive = async () => {
        if (!pendingArchiveId) return
        try {
            const user = users.find((u) => u.id === pendingArchiveId)
            const isCurrentlyArchived = isArchived(user?.archivedAt)

            await fetchJsonWithCsrf(
                `/api/admin/school/users?userId=${pendingArchiveId}`,
                {
                    method: 'PATCH',
                    body: { archived: !isCurrentlyArchived }
                }
            )

            setUsers((prev) =>
                prev.map((u) =>
                    u.id === pendingArchiveId
                        ? { ...u, archivedAt: isCurrentlyArchived ? null : new Date().toISOString() }
                        : u
                )
            )
        } catch (err) {
            console.error('[Users] Archive failed', err)
            setError(dict.saveError)
        } finally {
            setConfirmOpen(false)
            setPendingArchiveId('')
        }
    }

    const requestArchive = (userId: string) => {
        setPendingArchiveId(userId)
        setConfirmOpen(true)
    }

    const handlePromote = async () => {
        if (!pendingPromoteUser) return

        setPromoting(true)
        try {
            const result = await promoteToSchoolAdmin(pendingPromoteUser.id)
            if (result.success) {
                // Remove user from teachers list (they're now a school admin, not shown in this UI)
                setTeachers(prev => prev.filter(t => t.id !== pendingPromoteUser.id))
                router.refresh()
            } else {
                setError(result.error || dict.rolePromotion.promoteError)
            }
        } catch (err) {
            console.error('[Users] Promote failed', err)
            setError(dict.rolePromotion.promoteError)
        } finally {
            setPromoting(false)
            setPromoteConfirmOpen(false)
            setPendingPromoteUser(null)
        }
    }

    // CSV Import handlers
    const handleCsvParsed = useCallback((data: Record<string, string>[], errors: string[]) => {
        const users = data.map(row => ({
            email: row.email?.trim().toLowerCase() || '',
            name: row.name?.trim() || '',
        }))
        setCsvData(users)
        setCsvErrors(errors)
        setCsvResult(null)
    }, [])

    const getCsvUserStatus = useCallback((user: CsvUser, index: number): CsvUserStatus => {
        if (!user.email || !user.email.includes('@')) {
            return 'invalid-email'
        }
        // Check for duplicates within CSV (same email appears earlier)
        const firstIndex = csvData.findIndex(u => u.email === user.email)
        if (firstIndex !== index) {
            return 'duplicate'
        }
        return 'valid'
    }, [csvData])

    const csvValidUsers = useMemo(() => {
        return csvData.filter((user, index) => getCsvUserStatus(user, index) === 'valid')
    }, [csvData, getCsvUserStatus])

    const csvInvalidCount = useMemo(() => {
        return csvData.filter((user, index) => getCsvUserStatus(user, index) === 'invalid-email').length
    }, [csvData, getCsvUserStatus])

    const csvDuplicateCount = useMemo(() => {
        return csvData.filter((user, index) => getCsvUserStatus(user, index) === 'duplicate').length
    }, [csvData, getCsvUserStatus])

    const handleCsvImport = async () => {
        if (csvValidUsers.length === 0) return

        setCsvImporting(true)
        try {
            const role = activeRole === 'teacher' ? 'TEACHER' : 'STUDENT'
            const result = await fetchJsonWithCsrf<{ createdCount: number; skippedCount: number; errors: string[] }>(
                '/api/admin/school/users',
                { method: 'POST', body: { role, users: csvValidUsers } }
            )
            setCsvResult({
                created: result.createdCount,
                skipped: result.skippedCount,
                errors: result.errors || []
            })
            router.refresh()
        } catch (err) {
            console.error('[Users] CSV import failed', err)
            setCsvResult({ created: 0, skipped: 0, errors: ['Import failed'] })
        } finally {
            setCsvImporting(false)
        }
    }

    const closeCsvDrawer = useCallback(() => {
        setCsvDrawerOpen(false)
        setCsvData([])
        setCsvErrors([])
        setCsvResult(null)
    }, [])

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-brand-900">{dict.nav.users}</h1>
                    <p className="text-sm text-gray-500">
                        {activeRole === 'teacher' ? dict.tabs.teachers : dict.tabs.students}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setCsvDrawerOpen(true)}
                        className="inline-flex items-center rounded-md border border-brand-900 px-4 py-2 text-sm font-medium text-brand-900 hover:bg-brand-50"
                    >
                        {dict.csvImport.button}
                    </button>
                    <button
                        type="button"
                        onClick={(e) => openCreateDrawer(e.currentTarget)}
                        className="inline-flex items-center rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
                    >
                        {activeRole === 'teacher' ? dict.createTeacherButton : dict.createStudentButton}
                    </button>
                </div>
            </div>

            {/* Role tabs + Search */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setRoleParam('teacher')}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${activeRole === 'teacher'
                                ? 'bg-brand-900 text-white'
                                : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {dict.tabs.teachers} ({teachers.filter(t => !isArchived(t.archivedAt)).length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setRoleParam('student')}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${activeRole === 'student'
                                ? 'bg-brand-900 text-white'
                                : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {dict.tabs.students} ({students.filter(s => !isArchived(s.archivedAt)).length})
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={activeRole === 'teacher' ? dict.searchTeachersPlaceholder : dict.searchStudentsPlaceholder}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                        />
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                                type="checkbox"
                                checked={showArchived}
                                onChange={(e) => setShowArchived(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                            />
                            {dict.showArchived}
                        </label>
                    </div>
                </div>
            </div>

            {/* Users table */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                {filteredUsers.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">
                        {activeRole === 'teacher' ? dict.emptyTeachers : dict.emptyStudents}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">{dict.namePlaceholder}</th>
                                    <th className="px-4 py-3">{dict.emailPlaceholder}</th>
                                    <th className="px-4 py-3">{dict.profile.sectionsLabel}</th>
                                    <th className="px-4 py-3 text-right">{dict.users.actions}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredUsers.map((user) => {
                                    const archived = isArchived(user.archivedAt)
                                    const sectionsList = user.enrollments
                                        .map((e) => `${e.class.course.code} - ${e.class.name}`)
                                        .slice(0, 3)
                                        .join(', ')
                                    const moreCount = Math.max(0, user.enrollments.length - 3)

                                    return (
                                        <tr key={user.id} className={archived ? 'bg-gray-50 opacity-60' : ''}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-900">
                                                        {user.name || dict.unknownName}
                                                    </span>
                                                    {archived && (
                                                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                                                            {dict.archivedBadge}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {user.email || dict.unknownEmail}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {sectionsList || dict.none}
                                                {moreCount > 0 && (
                                                    <span className="text-gray-400"> +{moreCount}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => openEditDrawer(user.id, e.currentTarget)}
                                                        className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                                    >
                                                        {dict.users.edit}
                                                    </button>
                                                    {activeRole === 'teacher' && !archived && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setPendingPromoteUser({ id: user.id, name: user.name })
                                                                setPromoteConfirmOpen(true)
                                                            }}
                                                            className="rounded-md border border-brand-900 px-3 py-1 text-xs font-medium text-brand-900 hover:bg-brand-50"
                                                        >
                                                            {dict.rolePromotion.promoteButton}
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => requestArchive(user.id)}
                                                        className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50"
                                                    >
                                                        {archived ? dict.restoreLabel : dict.archiveLabel}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Drawer */}
            <Drawer
                open={drawerOpen}
                onClose={closeDrawer}
                title={drawerMode === 'create'
                    ? (activeRole === 'teacher' ? dict.createTeacherTitle : dict.createStudentTitle)
                    : dict.users.editTitle
                }
                returnFocusRef={drawerReturnFocusRef}
            >
                <div className="grid grid-cols-1 gap-4">
                    <label className="flex flex-col gap-1 text-sm text-gray-700">
                        <span className="font-medium">{dict.namePlaceholder}</span>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-gray-700">
                        <span className="font-medium">{dict.emailPlaceholder} *</span>
                        <input
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-gray-700">
                        <span className="font-medium">{dict.passwordPlaceholder}</span>
                        <input
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            placeholder={drawerMode === 'edit' ? dict.users.passwordHint : ''}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                        />
                    </label>
                </div>

                {error && (
                    <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={closeDrawer}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        {dict.cancelArchiveButton}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {drawerMode === 'create'
                            ? (activeRole === 'teacher' ? dict.createTeacherButton : dict.createStudentButton)
                            : dict.users.saveButton
                        }
                    </button>
                </div>
            </Drawer>

            {/* Archive Confirm Modal */}
            <ConfirmModal
                open={confirmOpen}
                title={dict.users.archiveConfirmTitle}
                description={dict.users.archiveConfirmDescription}
                confirmLabel={dict.confirmArchiveButton}
                cancelLabel={dict.cancelArchiveButton}
                onConfirm={handleArchive}
                onCancel={() => {
                    setConfirmOpen(false)
                    setPendingArchiveId('')
                }}
            />

            {/* Promote Confirm Modal */}
            <ConfirmModal
                open={promoteConfirmOpen}
                title={dict.rolePromotion.promoteConfirmTitle}
                description={dict.rolePromotion.promoteConfirmDescription.replace('{{name}}', pendingPromoteUser?.name || dict.unknownName)}
                confirmLabel={dict.rolePromotion.promoteConfirmLabel}
                cancelLabel={dict.rolePromotion.promoteCancelLabel}
                onConfirm={handlePromote}
                onCancel={() => {
                    setPromoteConfirmOpen(false)
                    setPendingPromoteUser(null)
                }}
            />

            {/* CSV Import Drawer */}
            <Drawer
                open={csvDrawerOpen}
                onClose={closeCsvDrawer}
                title={dict.csvImport.title}
            >
                {csvResult ? (
                    // Result view
                    <div className="flex flex-col gap-4">
                        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                            {dict.csvImport.resultSuccess
                                .replace('{{created}}', String(csvResult.created))
                                .replace('{{skipped}}', String(csvResult.skipped))}
                        </div>
                        {csvResult.errors.length > 0 && (
                            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                <p className="font-medium">{dict.csvImport.resultErrors}</p>
                                <ul className="mt-1 list-inside list-disc">
                                    {csvResult.errors.slice(0, 5).map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                    {csvResult.errors.length > 5 && (
                                        <li>+{csvResult.errors.length - 5} more...</li>
                                    )}
                                </ul>
                            </div>
                        )}
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={closeCsvDrawer}
                                className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
                            >
                                {dict.csvImport.closeButton}
                            </button>
                        </div>
                    </div>
                ) : csvData.length === 0 ? (
                    // Upload view
                    <div className="flex flex-col gap-4">
                        <CsvUploader
                            onParsed={handleCsvParsed}
                            requiredColumns={['email']}
                            optionalColumns={['name']}
                            labels={{
                                dropzone: dict.csvImport.dropzone,
                                selectFile: dict.csvImport.selectFile,
                                parsing: dict.csvImport.parsing,
                                invalidFormat: dict.csvImport.invalidFormat,
                                missingColumns: dict.csvImport.missingColumns,
                                tooManyRows: dict.csvImport.tooManyRows,
                            }}
                        />
                        {csvErrors.length > 0 && (
                            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {csvErrors.map((err, i) => (
                                    <p key={i}>{err}</p>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={closeCsvDrawer}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                {dict.csvImport.cancelButton}
                            </button>
                        </div>
                    </div>
                ) : (
                    // Preview view
                    <div className="flex flex-col gap-4">
                        <p className="text-sm font-medium text-gray-700">
                            {dict.csvImport.previewTitle.replace('{{count}}', String(csvData.length))}
                        </p>
                        <div className="text-xs text-gray-500">
                            {csvValidUsers.length} {dict.csvImport.statusValid.toLowerCase()}
                            {csvInvalidCount > 0 && `, ${csvInvalidCount} ${dict.csvImport.statusInvalidEmail.toLowerCase()}`}
                            {csvDuplicateCount > 0 && `, ${csvDuplicateCount} ${dict.csvImport.statusDuplicate.toLowerCase()}`}
                        </div>
                        <div className="max-h-80 overflow-auto rounded-md border border-gray-200">
                            <table className="min-w-full text-left text-sm">
                                <thead className="sticky top-0 border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="px-3 py-2">{dict.csvImport.previewColumnName}</th>
                                        <th className="px-3 py-2">{dict.csvImport.previewColumnEmail}</th>
                                        <th className="px-3 py-2">{dict.csvImport.previewColumnStatus}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {csvData.slice(0, 50).map((user, index) => {
                                        const status = getCsvUserStatus(user, index)
                                        return (
                                            <tr key={index} className={status !== 'valid' ? 'bg-red-50' : ''}>
                                                <td className="px-3 py-2 text-gray-900">{user.name || '-'}</td>
                                                <td className="px-3 py-2 text-gray-600">{user.email || '-'}</td>
                                                <td className="px-3 py-2">
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                                        status === 'valid'
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {status === 'valid' && dict.csvImport.statusValid}
                                                        {status === 'invalid-email' && dict.csvImport.statusInvalidEmail}
                                                        {status === 'duplicate' && dict.csvImport.statusDuplicate}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                            {csvData.length > 50 && (
                                <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                                    +{csvData.length - 50} more rows...
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeCsvDrawer}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                {dict.csvImport.cancelButton}
                            </button>
                            <button
                                type="button"
                                onClick={handleCsvImport}
                                disabled={csvImporting || csvValidUsers.length === 0}
                                className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {csvImporting
                                    ? dict.csvImport.importing
                                    : dict.csvImport.importButton.replace('{{count}}', String(csvValidUsers.length))}
                            </button>
                        </div>
                    </div>
                )}
            </Drawer>
        </div>
    )
}
