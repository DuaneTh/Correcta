'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { PersonRow, CourseRow, SectionRow } from '@/lib/school-admin-data'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'
import Drawer from '@/components/ui/Drawer'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Form'
import { Inline, Stack } from '@/components/ui/Layout'
import { Text } from '@/components/ui/Text'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/components/ui/cn'

type SchoolEnrollmentsClientProps = {
    dictionary: Dictionary
    teachers: PersonRow[]
    students: PersonRow[]
    courses: CourseRow[]
    sections: SectionRow[]
}

const DEFAULT_SECTION_NAME = '__DEFAULT__'
const isDefaultSection = (section: SectionRow) => section.name === DEFAULT_SECTION_NAME
const isArchived = (value?: string | null) => Boolean(value)
const normalizeValue = (value: string | null | undefined) => value?.toLowerCase().trim() ?? ''

type EnrollmentView = {
    id: string
    userName: string
    userEmail: string
    userId: string
    role: 'TEACHER' | 'STUDENT'
    sectionName: string
    sectionId: string
    courseCode: string
    courseName: string
}

export default function SchoolEnrollmentsClient({
    dictionary,
    teachers: initialTeachers,
    students: initialStudents,
    courses,
    sections: initialSections,
}: SchoolEnrollmentsClientProps) {
    const dict = dictionary.admin.school
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [sections, setSections] = useState(initialSections)
    const [teachers, setTeachers] = useState(initialTeachers)
    const [students, setStudents] = useState(initialStudents)
    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState<'all' | 'teacher' | 'student'>('all')

    const [drawerOpen, setDrawerOpen] = useState(false)
    const [assignForm, setAssignForm] = useState({
        role: 'STUDENT' as 'TEACHER' | 'STUDENT',
        userId: '',
        sectionId: '',
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const [confirmOpen, setConfirmOpen] = useState(false)
    const [pendingRemoveId, setPendingRemoveId] = useState('')

    const drawerReturnFocusRef = useRef<HTMLElement | null>(null)

    // Build flat list of enrollments
    const enrollments = useMemo(() => {
        const result: EnrollmentView[] = []
        for (const section of sections) {
            if (isDefaultSection(section) || isArchived(section.archivedAt)) continue
            for (const enrollment of section.enrollments) {
                if (isArchived(enrollment.user.archivedAt)) continue
                result.push({
                    id: enrollment.id,
                    userName: enrollment.user.name || dict.unknownName,
                    userEmail: enrollment.user.email || dict.unknownEmail,
                    userId: enrollment.user.id,
                    role: enrollment.role as 'TEACHER' | 'STUDENT',
                    sectionName: section.name,
                    sectionId: section.id,
                    courseCode: section.course.code,
                    courseName: section.course.name,
                })
            }
        }
        return result
    }, [sections, dict])

    const filteredEnrollments = useMemo(() => {
        const query = normalizeValue(search)
        return enrollments.filter((e) => {
            if (roleFilter !== 'all') {
                const expected = roleFilter === 'teacher' ? 'TEACHER' : 'STUDENT'
                if (e.role !== expected) return false
            }
            if (!query) return true
            return normalizeValue(e.userName).includes(query) ||
                normalizeValue(e.userEmail).includes(query) ||
                normalizeValue(e.sectionName).includes(query) ||
                normalizeValue(e.courseCode).includes(query)
        })
    }, [enrollments, search, roleFilter])

    const availableSections = useMemo(() => {
        return sections.filter(s => !isDefaultSection(s) && !isArchived(s.archivedAt))
    }, [sections])

    const availableUsers = useMemo(() => {
        const list = assignForm.role === 'TEACHER' ? teachers : students
        return list.filter(u => !isArchived(u.archivedAt))
    }, [assignForm.role, teachers, students])

    const buildUrl = useCallback(
        (update: (params: URLSearchParams) => void) => {
            const params = new URLSearchParams(searchParams.toString())
            update(params)
            const query = params.toString()
            return query ? `${pathname}?${query}` : pathname
        },
        [pathname, searchParams]
    )

    const refreshUsers = useCallback(async () => {
        try {
            const [teachersRes, studentsRes] = await Promise.all([
                fetch('/api/admin/school/users?role=TEACHER&includeArchived=false'),
                fetch('/api/admin/school/users?role=STUDENT&includeArchived=false'),
            ])
            const [teachersData, studentsData] = await Promise.all([teachersRes.json(), studentsRes.json()])
            if (!teachersRes.ok || !studentsRes.ok) {
                throw new Error('Failed to load users')
            }
            setTeachers(teachersData.users ?? [])
            setStudents(studentsData.users ?? [])
        } catch (err) {
            console.error('[Enrollments] Load users failed', err)
            setError(dict.loadError)
        }
    }, [dict.loadError])

    useEffect(() => {
        void refreshUsers()
    }, [refreshUsers])

    const openAssignDrawer = useCallback((trigger?: HTMLElement | null) => {
        void refreshUsers()
        setAssignForm({ role: 'STUDENT', userId: '', sectionId: '' })
        setError('')
        setDrawerOpen(true)
        if (trigger) drawerReturnFocusRef.current = trigger
        const url = buildUrl((params) => params.set('action', 'assign'))
        router.replace(url)
    }, [buildUrl, refreshUsers, router])

    const closeDrawer = useCallback(() => {
        setDrawerOpen(false)
        const url = buildUrl((params) => params.delete('action'))
        router.replace(url)
    }, [buildUrl, router])

    const handleAssign = async () => {
        if (!assignForm.userId || !assignForm.sectionId) {
            setError(dict.enrollments.missingFields)
            return
        }

        setSaving(true)
        setError('')

        try {
            await fetchJsonWithCsrf('/api/admin/school/enrollments', {
                method: 'POST',
                body: {
                    userId: assignForm.userId,
                    classId: assignForm.sectionId,
                    role: assignForm.role,
                }
            })

            // Refresh sections data
            const user = availableUsers.find(u => u.id === assignForm.userId)
            if (user) {
                setSections(prev => prev.map(s => {
                    if (s.id !== assignForm.sectionId) return s
                    return {
                        ...s,
                        enrollments: [
                            ...s.enrollments,
                            {
                                id: `temp-${Date.now()}`,
                                role: assignForm.role,
                                user: {
                                    id: user.id,
                                    name: user.name,
                                    email: user.email,
                                    archivedAt: null,
                                }
                            }
                        ]
                    }
                }))
            }

            closeDrawer()
        } catch (err) {
            console.error('[Enrollments] Assign failed', err)
            setError(dict.saveError)
        } finally {
            setSaving(false)
        }
    }

    const handleRemove = async () => {
        if (!pendingRemoveId) return

        try {
            await fetchJsonWithCsrf(`/api/admin/school/enrollments?enrollmentId=${pendingRemoveId}`, {
                method: 'DELETE',
            })

            setSections(prev => prev.map(s => ({
                ...s,
                enrollments: s.enrollments.filter(e => e.id !== pendingRemoveId)
            })))
        } catch (err) {
            console.error('[Enrollments] Remove failed', err)
            setError(dict.saveError)
        } finally {
            setConfirmOpen(false)
            setPendingRemoveId('')
        }
    }

    const requestRemove = (enrollmentId: string) => {
        setPendingRemoveId(enrollmentId)
        setConfirmOpen(true)
    }

    return (
        <Stack gap="lg">
            {/* Header */}
            <Inline align="between" gap="md" wrap="nowrap">
                <Stack gap="xs">
                    <Text as="h1" variant="pageTitle">
                        {dict.nav.enrollments}
                    </Text>
                    <Text variant="muted">{dict.enrollments.subtitle}</Text>
                </Stack>
                <Button
                    type="button"
                    onClick={(e) => openAssignDrawer(e.currentTarget)}
                >
                    {dict.assignButton}
                </Button>
            </Inline>

            {/* Filters */}
            <Card>
                <CardBody padding="md">
                    <Inline align="between" gap="md">
                        <Inline align="start" gap="sm">
                            <Button
                                type="button"
                                onClick={() => setRoleFilter('all')}
                                variant={roleFilter === 'all' ? 'primary' : 'secondary'}
                                size="xs"
                            >
                                {dict.enrollments.filterAll} ({enrollments.length})
                            </Button>
                            <Button
                                type="button"
                                onClick={() => setRoleFilter('teacher')}
                                variant={roleFilter === 'teacher' ? 'primary' : 'secondary'}
                                size="xs"
                            >
                                {dict.tabs.teachers} ({enrollments.filter(e => e.role === 'TEACHER').length})
                            </Button>
                            <Button
                                type="button"
                                onClick={() => setRoleFilter('student')}
                                variant={roleFilter === 'student' ? 'primary' : 'secondary'}
                                size="xs"
                            >
                                {dict.tabs.students} ({enrollments.filter(e => e.role === 'STUDENT').length})
                            </Button>
                        </Inline>
                        <Input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={dict.enrollments.searchPlaceholder}
                            size="sm"
                        />
                    </Inline>
                </CardBody>
            </Card>

            {/* Enrollments table */}
            <Card>
                {filteredEnrollments.length === 0 ? (
                    <CardBody padding="md">
                        <Text variant="muted">{dict.enrollments.empty}</Text>
                    </CardBody>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">{dict.namePlaceholder}</th>
                                    <th className="px-4 py-3">{dict.enrollments.roleLabel}</th>
                                    <th className="px-4 py-3">{dict.tabs.courses}</th>
                                    <th className="px-4 py-3">{dict.tabs.sections}</th>
                                    <th className="px-4 py-3 text-right">{dict.users.actions}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredEnrollments.map((enrollment) => (
                                    <tr key={enrollment.id}>
                                        <td className="px-4 py-3">
                                            <Stack gap="xs">
                                                <Text variant="body">{enrollment.userName}</Text>
                                                <Text variant="xsMuted">{enrollment.userEmail}</Text>
                                            </Stack>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant={enrollment.role === 'TEACHER' ? 'info' : 'neutral'}>
                                                {enrollment.role === 'TEACHER' ? dict.assignTeacherLabel : dict.assignStudentLabel}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Text variant="body">{enrollment.courseCode}</Text>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Text variant="muted">{enrollment.sectionName}</Text>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                type="button"
                                                onClick={() => requestRemove(enrollment.id)}
                                                variant="destructive"
                                                size="xs"
                                            >
                                                {dict.removeLabel}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Assign Drawer */}
            <Drawer
                open={drawerOpen}
                onClose={closeDrawer}
                title={dict.assignUserTitle}
                returnFocusRef={drawerReturnFocusRef}
            >
                <Stack gap="md">
                    <label className="flex flex-col gap-1">
                        <Text variant="label">{dict.enrollments.roleLabel}</Text>
                        <Select
                            value={assignForm.role}
                            onChange={(e) => setAssignForm({ ...assignForm, role: e.target.value as 'TEACHER' | 'STUDENT', userId: '' })}
                        >
                            <option value="STUDENT">{dict.assignStudentLabel}</option>
                            <option value="TEACHER">{dict.assignTeacherLabel}</option>
                        </Select>
                    </label>
                    <label className="flex flex-col gap-1">
                        <Text variant="label">{dict.selectUserPlaceholder} *</Text>
                        <Select
                            value={assignForm.userId}
                            onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })}
                        >
                            <option value="">{dict.selectUserPlaceholder}</option>
                            {availableUsers.map((u) => (
                                <option key={u.id} value={u.id}>{u.name || u.email}</option>
                            ))}
                        </Select>
                    </label>
                    <label className="flex flex-col gap-1">
                        <Text variant="label">{dict.selectSectionPlaceholder} *</Text>
                        <Select
                            value={assignForm.sectionId}
                            onChange={(e) => setAssignForm({ ...assignForm, sectionId: e.target.value })}
                        >
                            <option value="">{dict.selectSectionPlaceholder}</option>
                            {availableSections.map((s) => (
                                <option key={s.id} value={s.id}>{s.course.code} - {s.name}</option>
                            ))}
                        </Select>
                    </label>
                </Stack>

                {error && (
                    <Card className="mt-4">
                        <CardBody padding="sm">
                            <Text variant="muted" className="text-red-700">
                                {error}
                            </Text>
                        </CardBody>
                    </Card>
                )}

                <Inline align="end" gap="sm" className="mt-6">
                    <Button type="button" onClick={closeDrawer} variant="secondary">
                        {dict.cancelArchiveButton}
                    </Button>
                    <Button type="button" onClick={handleAssign} disabled={saving}>
                        {dict.assignButton}
                    </Button>
                </Inline>
            </Drawer>

            {/* Remove Confirm Modal */}
            <ConfirmModal
                open={confirmOpen}
                title={dict.enrollments.removeConfirmTitle}
                description={dict.enrollments.removeConfirmDescription}
                confirmLabel={dict.removeLabel}
                cancelLabel={dict.cancelArchiveButton}
                onConfirm={handleRemove}
                onCancel={() => {
                    setConfirmOpen(false)
                    setPendingRemoveId('')
                }}
            />
        </Stack>
    )
}
