'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { PersonRow, CourseRow, SectionRow } from '@/lib/school-admin-data'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'
import Drawer from '@/components/ui/Drawer'
import ConfirmModal from '@/components/ui/ConfirmModal'

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
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-brand-900">{dict.nav.enrollments}</h1>
                    <p className="text-sm text-gray-500">{dict.enrollments.subtitle}</p>
                </div>
                <button
                    type="button"
                    onClick={(e) => openAssignDrawer(e.currentTarget)}
                    className="inline-flex items-center rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
                >
                    {dict.assignButton}
                </button>
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setRoleFilter('all')}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${roleFilter === 'all'
                                ? 'bg-brand-900 text-white'
                                : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {dict.enrollments.filterAll} ({enrollments.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setRoleFilter('teacher')}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${roleFilter === 'teacher'
                                ? 'bg-brand-900 text-white'
                                : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {dict.tabs.teachers} ({enrollments.filter(e => e.role === 'TEACHER').length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setRoleFilter('student')}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${roleFilter === 'student'
                                ? 'bg-brand-900 text-white'
                                : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {dict.tabs.students} ({enrollments.filter(e => e.role === 'STUDENT').length})
                        </button>
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={dict.enrollments.searchPlaceholder}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                    />
                </div>
            </div>

            {/* Enrollments table */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                {filteredEnrollments.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">{dict.enrollments.empty}</div>
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
                                            <div className="font-medium text-gray-900">{enrollment.userName}</div>
                                            <div className="text-xs text-gray-500">{enrollment.userEmail}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${enrollment.role === 'TEACHER'
                                                ? 'bg-purple-100 text-purple-700'
                                                : 'bg-blue-100 text-blue-700'
                                            }`}>
                                                {enrollment.role === 'TEACHER' ? dict.assignTeacherLabel : dict.assignStudentLabel}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">{enrollment.courseCode}</td>
                                        <td className="px-4 py-3 text-gray-600">{enrollment.sectionName}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => requestRemove(enrollment.id)}
                                                className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                            >
                                                {dict.removeLabel}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Assign Drawer */}
            <Drawer
                open={drawerOpen}
                onClose={closeDrawer}
                title={dict.assignUserTitle}
                returnFocusRef={drawerReturnFocusRef}
            >
                <div className="grid grid-cols-1 gap-4">
                    <label className="flex flex-col gap-1 text-sm text-gray-700">
                        <span className="font-medium">{dict.enrollments.roleLabel}</span>
                        <select
                            value={assignForm.role}
                            onChange={(e) => setAssignForm({ ...assignForm, role: e.target.value as 'TEACHER' | 'STUDENT', userId: '' })}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                        >
                            <option value="STUDENT">{dict.assignStudentLabel}</option>
                            <option value="TEACHER">{dict.assignTeacherLabel}</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-gray-700">
                        <span className="font-medium">{dict.selectUserPlaceholder} *</span>
                        <select
                            value={assignForm.userId}
                            onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                        >
                            <option value="">{dict.selectUserPlaceholder}</option>
                            {availableUsers.map((u) => (
                                <option key={u.id} value={u.id}>{u.name || u.email}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-gray-700">
                        <span className="font-medium">{dict.selectSectionPlaceholder} *</span>
                        <select
                            value={assignForm.sectionId}
                            onChange={(e) => setAssignForm({ ...assignForm, sectionId: e.target.value })}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                        >
                            <option value="">{dict.selectSectionPlaceholder}</option>
                            {availableSections.map((s) => (
                                <option key={s.id} value={s.id}>{s.course.code} - {s.name}</option>
                            ))}
                        </select>
                    </label>
                </div>

                {error && (
                    <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={closeDrawer} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        {dict.cancelArchiveButton}
                    </button>
                    <button type="button" onClick={handleAssign} disabled={saving} className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60">
                        {dict.assignButton}
                    </button>
                </div>
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
        </div>
    )
}
