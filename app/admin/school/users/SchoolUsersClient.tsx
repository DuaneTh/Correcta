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
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Stack, Inline } from '@/components/ui/Layout'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Form'
import { SearchField } from '@/components/ui/SearchField'
import { EmptyState } from '@/components/ui/EmptyState'

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

    // User profile drawer state
    const [profileDrawerOpen, setProfileDrawerOpen] = useState(false)
    const [selectedUser, setSelectedUser] = useState<PersonRow | null>(null)

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

    const openProfileDrawer = useCallback((user: PersonRow) => {
        setSelectedUser(user)
        setProfileDrawerOpen(true)
    }, [])

    const closeProfileDrawer = useCallback(() => {
        setProfileDrawerOpen(false)
        setSelectedUser(null)
    }, [])

    return (
        <Stack gap="xl">
            {/* Header */}
            <Inline align="between" gap="md">
                <Stack gap="xs">
                    <Text as="h1" variant="pageTitle">{dict.nav.users}</Text>
                    <Text variant="muted">
                        {activeRole === 'teacher' ? dict.tabs.teachers : dict.tabs.students}
                    </Text>
                </Stack>
                <Inline align="start" gap="xs">
                    <Button
                        onClick={() => setCsvDrawerOpen(true)}
                        variant="secondary"
                    >
                        {dict.csvImport.button}
                    </Button>
                    <Button
                        onClick={(e) => openCreateDrawer(e.currentTarget)}
                        variant="primary"
                    >
                        {activeRole === 'teacher' ? dict.createTeacherButton : dict.createStudentButton}
                    </Button>
                </Inline>
            </Inline>

            {/* Role tabs + Search */}
            <Card>
                <CardBody padding="md">
                    <Inline align="between" gap="md" wrap="wrap">
                        <Inline align="start" gap="xs">
                            <Button
                                onClick={() => setRoleParam('teacher')}
                                variant={activeRole === 'teacher' ? 'primary' : 'secondary'}
                                size="sm"
                            >
                                {dict.tabs.teachers} ({teachers.filter(t => !isArchived(t.archivedAt)).length})
                            </Button>
                            <Button
                                onClick={() => setRoleParam('student')}
                                variant={activeRole === 'student' ? 'primary' : 'secondary'}
                                size="sm"
                            >
                                {dict.tabs.students} ({students.filter(s => !isArchived(s.archivedAt)).length})
                            </Button>
                        </Inline>
                        <Inline align="center" gap="sm">
                            <SearchField
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={activeRole === 'teacher' ? dict.searchTeachersPlaceholder : dict.searchStudentsPlaceholder}
                            />
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={showArchived}
                                    onChange={(e) => setShowArchived(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                />
                                <Text variant="body">{dict.showArchived}</Text>
                            </label>
                        </Inline>
                    </Inline>
                </CardBody>
            </Card>

            {/* Users table */}
            <Card>
                {filteredUsers.length === 0 ? (
                    <CardBody padding="md">
                        <EmptyState
                            title={activeRole === 'teacher' ? dict.emptyTeachers : dict.emptyStudents}
                            size="compact"
                        />
                    </CardBody>
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
                                    const enrollmentCount = user.enrollments.length

                                    return (
                                        <tr
                                            key={user.id}
                                            className={`${archived ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'} cursor-pointer transition-colors`}
                                            onClick={() => openProfileDrawer(user)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-900">
                                                        {user.name || dict.unknownName}
                                                    </span>
                                                    {archived && (
                                                        <Badge variant="neutral">
                                                            {dict.archivedBadge}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {user.email || dict.unknownEmail}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {enrollmentCount > 0 ? (
                                                    <span className="text-brand-700 underline underline-offset-2">
                                                        {enrollmentCount} {enrollmentCount > 1 ? 'cours' : 'cours'}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">{dict.none}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Inline align="end" gap="xs">
                                                    <Button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            openEditDrawer(user.id, e.currentTarget)
                                                        }}
                                                        variant="secondary"
                                                        size="xs"
                                                    >
                                                        {dict.users.edit}
                                                    </Button>
                                                    {activeRole === 'teacher' && !archived && (
                                                        <Button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setPendingPromoteUser({ id: user.id, name: user.name })
                                                                setPromoteConfirmOpen(true)
                                                            }}
                                                            variant="primary"
                                                            size="xs"
                                                        >
                                                            {dict.rolePromotion.promoteButton}
                                                        </Button>
                                                    )}
                                                    <Button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            requestArchive(user.id)
                                                        }}
                                                        variant="ghost"
                                                        size="xs"
                                                    >
                                                        {archived ? dict.restoreLabel : dict.archiveLabel}
                                                    </Button>
                                                </Inline>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

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
                <Stack gap="md">
                    <Stack gap="xs">
                        <Text variant="label">{dict.namePlaceholder}</Text>
                        <Input
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                    </Stack>
                    <Stack gap="xs">
                        <Text variant="label">{dict.emailPlaceholder} *</Text>
                        <Input
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                    </Stack>
                    <Stack gap="xs">
                        <Text variant="label">{dict.passwordPlaceholder}</Text>
                        <Input
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            placeholder={drawerMode === 'edit' ? dict.users.passwordHint : ''}
                        />
                    </Stack>
                </Stack>

                {error && (
                    <Card className="mt-4">
                        <CardBody padding="sm">
                            <Text variant="body" className="text-red-700">{error}</Text>
                        </CardBody>
                    </Card>
                )}

                <Inline align="end" gap="xs" className="mt-6">
                    <Button
                        onClick={closeDrawer}
                        variant="secondary"
                    >
                        {dict.cancelArchiveButton}
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        variant="primary"
                    >
                        {drawerMode === 'create'
                            ? (activeRole === 'teacher' ? dict.createTeacherButton : dict.createStudentButton)
                            : dict.users.saveButton
                        }
                    </Button>
                </Inline>
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

            {/* User Profile Drawer */}
            <Drawer
                open={profileDrawerOpen}
                onClose={closeProfileDrawer}
                title={selectedUser?.name || dict.unknownName}
            >
                {selectedUser && (
                    <div className="flex flex-col gap-6">
                        {/* User Info */}
                        <div className="flex flex-col gap-2">
                            <div className="text-sm text-gray-500">{dict.emailPlaceholder}</div>
                            <div className="text-gray-900">{selectedUser.email || dict.unknownEmail}</div>
                        </div>

                        {/* Enrollments */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium text-gray-900">
                                    {dict.profile.coursesTitle || 'Cours'}
                                </h3>
                                <span className="text-sm text-gray-500">
                                    {selectedUser.enrollments.length} {selectedUser.enrollments.length > 1 ? 'inscriptions' : 'inscription'}
                                </span>
                            </div>

                            {selectedUser.enrollments.length === 0 ? (
                                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                                    {dict.profile.noEnrollments || 'Aucune inscription'}
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-200 rounded-lg border border-gray-200">
                                    {selectedUser.enrollments.map((enrollment, index) => (
                                        <div key={index} className="px-4 py-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="font-medium text-gray-900">
                                                        {enrollment.class.course.code}
                                                    </div>
                                                    <div className="text-sm text-gray-600">
                                                        {enrollment.class.course.name}
                                                    </div>
                                                </div>
                                                {enrollment.class.name !== '__DEFAULT__' && (
                                                    <Badge variant="info">
                                                        {enrollment.class.name}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <Inline align="end" gap="xs" className="border-t border-gray-200 pt-4">
                            <Button
                                onClick={() => {
                                    closeProfileDrawer()
                                    openEditDrawer(selectedUser.id)
                                }}
                                variant="secondary"
                            >
                                {dict.users.edit}
                            </Button>
                            <Button
                                onClick={closeProfileDrawer}
                                variant="primary"
                            >
                                {dict.profile.closeButton || 'Fermer'}
                            </Button>
                        </Inline>
                    </div>
                )}
            </Drawer>

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
                        <Inline align="end" gap="xs">
                            <Button
                                onClick={closeCsvDrawer}
                                variant="primary"
                            >
                                {dict.csvImport.closeButton}
                            </Button>
                        </Inline>
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
                        <Inline align="end" gap="xs">
                            <Button
                                onClick={closeCsvDrawer}
                                variant="secondary"
                            >
                                {dict.csvImport.cancelButton}
                            </Button>
                        </Inline>
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
                                                    <Badge variant={status === 'valid' ? 'success' : 'warning'}>
                                                        {status === 'valid' && dict.csvImport.statusValid}
                                                        {status === 'invalid-email' && dict.csvImport.statusInvalidEmail}
                                                        {status === 'duplicate' && dict.csvImport.statusDuplicate}
                                                    </Badge>
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
                        <Inline align="end" gap="xs">
                            <Button
                                onClick={closeCsvDrawer}
                                variant="secondary"
                            >
                                {dict.csvImport.cancelButton}
                            </Button>
                            <Button
                                onClick={handleCsvImport}
                                disabled={csvImporting || csvValidUsers.length === 0}
                                variant="primary"
                            >
                                {csvImporting
                                    ? dict.csvImport.importing
                                    : dict.csvImport.importButton.replace('{{count}}', String(csvValidUsers.length))}
                            </Button>
                        </Inline>
                    </div>
                )}
            </Drawer>
        </Stack>
    )
}
