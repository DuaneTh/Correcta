'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { PersonRow, CourseRow, SectionRow } from '@/lib/school-admin-data'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'
import Drawer from '@/components/ui/Drawer'
import ConfirmModal from '@/components/ui/ConfirmModal'

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

    const drawerReturnFocusRef = useRef<HTMLElement | null>(null)

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
        setDrawerOpen(false)
        const url = buildUrl((params) => {
            params.delete('action')
            params.delete('userId')
        })
        router.replace(url)
    }, [buildUrl, router])

    // Handle URL params on mount/change
    useEffect(() => {
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
                }
            } else if (editingUserId) {
                await fetchJsonWithCsrf(
                    `/api/admin/school/users?userId=${editingUserId}`,
                    { method: 'PATCH', body: payload }
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
                <button
                    type="button"
                    onClick={(e) => openCreateDrawer(e.currentTarget)}
                    className="inline-flex items-center rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
                >
                    {activeRole === 'teacher' ? dict.createTeacherButton : dict.createStudentButton}
                </button>
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
        </div>
    )
}
