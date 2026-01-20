'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { CourseRow, SectionRow, ExamRow, PersonRow } from '@/lib/school-admin-data'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'
import Drawer from '@/components/ui/Drawer'
import ConfirmModal from '@/components/ui/ConfirmModal'

type SchoolClassesClientProps = {
    dictionary: Dictionary
    institutionId: string
    courses: CourseRow[]
    sections: SectionRow[]
    exams: ExamRow[]
    students: PersonRow[]
}

const DEFAULT_SECTION_NAME = '__DEFAULT__'
const isDefaultSection = (section: SectionRow) => section.name === DEFAULT_SECTION_NAME
const isArchived = (value?: string | null) => Boolean(value)
const normalizeValue = (value: string | null | undefined) => value?.toLowerCase().trim() ?? ''

type TabType = 'courses' | 'sections' | 'exams'

export default function SchoolClassesClient({
    dictionary,
    institutionId,
    courses: initialCourses,
    sections: initialSections,
    exams: initialExams,
    students: initialStudents,
}: SchoolClassesClientProps) {
    const dict = dictionary.admin.school
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const tabParam = searchParams.get('tab') as TabType | null
    const activeTab: TabType = tabParam === 'sections' ? 'sections' : tabParam === 'exams' ? 'exams' : 'courses'
    const actionParam = searchParams.get('action')

    const [courses, setCourses] = useState(initialCourses)
    const [sections, setSections] = useState(initialSections)
    const [exams] = useState(initialExams)
    const [students] = useState(initialStudents)
    const [search, setSearch] = useState('')
    const [showArchived, setShowArchived] = useState(false)

    const [drawerOpen, setDrawerOpen] = useState(false)
    const [drawerType, setDrawerType] = useState<'course' | 'section'>('course')
    const [courseForm, setCourseForm] = useState({ code: '', name: '' })
    const [sectionForm, setSectionForm] = useState({ courseId: '', name: '', parentId: '' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [editTarget, setEditTarget] = useState<{ type: 'course' | 'section'; id: string } | null>(null)

    const [confirmOpen, setConfirmOpen] = useState(false)
    const [pendingArchive, setPendingArchive] = useState<{ type: 'course' | 'section'; id: string } | null>(null)

    // Roster management state
    const [rosterDrawerOpen, setRosterDrawerOpen] = useState(false)
    const [rosterSection, setRosterSection] = useState<SectionRow | null>(null)
    const [rosterSearch, setRosterSearch] = useState('')
    const [addStudentsDrawerOpen, setAddStudentsDrawerOpen] = useState(false)
    const [addStudentsSearch, setAddStudentsSearch] = useState('')
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set())
    const [rosterSaving, setRosterSaving] = useState(false)
    const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
    const [pendingRemoveEnrollmentId, setPendingRemoveEnrollmentId] = useState('')

    const drawerReturnFocusRef = useRef<HTMLElement | null>(null)
    const rosterReturnFocusRef = useRef<HTMLElement | null>(null)
    const closingRef = useRef(false)

    const filteredCourses = useMemo(() => {
        const query = normalizeValue(search)
        return courses.filter((course) => {
            if (!showArchived && isArchived(course.archivedAt)) return false
            if (!query) return true
            return normalizeValue(course.code).includes(query) || normalizeValue(course.name).includes(query)
        })
    }, [courses, search, showArchived])

    const filteredSections = useMemo(() => {
        const query = normalizeValue(search)
        return sections.filter((section) => {
            if (isDefaultSection(section)) return false
            if (!showArchived && isArchived(section.archivedAt)) return false
            if (!query) return true
            return normalizeValue(section.name).includes(query) ||
                normalizeValue(section.course.code).includes(query) ||
                normalizeValue(section.course.name).includes(query) ||
                normalizeValue(section.parent?.name).includes(query)
        })
    }, [sections, search, showArchived])

    // Group sections into hierarchy: root sections first, then their children
    const hierarchicalSections = useMemo(() => {
        const rootSections = filteredSections.filter(s => !s.parentId)
        const childrenByParent = new Map<string, typeof filteredSections>()

        filteredSections.forEach(section => {
            if (section.parentId) {
                const children = childrenByParent.get(section.parentId) || []
                children.push(section)
                childrenByParent.set(section.parentId, children)
            }
        })

        const result: Array<typeof filteredSections[0] & { isSubgroup: boolean; childCount: number }> = []

        rootSections.forEach(root => {
            const children = childrenByParent.get(root.id) || []
            result.push({ ...root, isSubgroup: false, childCount: children.length })
            children.forEach(child => {
                result.push({ ...child, isSubgroup: true, childCount: 0 })
            })
        })

        // Add orphan subgroups (parent not in filtered list)
        filteredSections.forEach(section => {
            if (section.parentId && !result.find(s => s.id === section.id)) {
                result.push({ ...section, isSubgroup: true, childCount: 0 })
            }
        })

        return result
    }, [filteredSections])

    // Available parent sections for the dropdown (root sections without parentId, in the selected course)
    const availableParentSections = useMemo(() => {
        if (!sectionForm.courseId) return []
        return sections.filter(s =>
            !isDefaultSection(s) &&
            !isArchived(s.archivedAt) &&
            s.course.id === sectionForm.courseId &&
            !s.parentId &&
            s.id !== editTarget?.id
        )
    }, [sections, sectionForm.courseId, editTarget])

    const filteredExams = useMemo(() => {
        const query = normalizeValue(search)
        return exams.filter((exam) => {
            if (!showArchived && isArchived(exam.archivedAt)) return false
            if (!query) return true
            return normalizeValue(exam.title).includes(query) ||
                normalizeValue(exam.course.code).includes(query)
        })
    }, [exams, search, showArchived])

    const buildUrl = useCallback(
        (update: (params: URLSearchParams) => void) => {
            const params = new URLSearchParams(searchParams.toString())
            update(params)
            const query = params.toString()
            return query ? `${pathname}?${query}` : pathname
        },
        [pathname, searchParams]
    )

    const setTabParam = useCallback((tab: TabType) => {
        const url = buildUrl((params) => {
            if (tab === 'courses') {
                params.delete('tab')
            } else {
                params.set('tab', tab)
            }
            params.delete('action')
        })
        router.replace(url)
    }, [buildUrl, router])

    const openCourseDrawer = useCallback((trigger?: HTMLElement | null) => {
        setDrawerType('course')
        setCourseForm({ code: '', name: '' })
        setEditTarget(null)
        setError('')
        setDrawerOpen(true)
        if (trigger) drawerReturnFocusRef.current = trigger
        const url = buildUrl((params) => params.set('action', 'add-course'))
        router.replace(url)
    }, [buildUrl, router])

    const openSectionDrawer = useCallback((trigger?: HTMLElement | null) => {
        setDrawerType('section')
        setSectionForm({ courseId: '', name: '', parentId: '' })
        setEditTarget(null)
        setError('')
        setDrawerOpen(true)
        if (trigger) drawerReturnFocusRef.current = trigger
        const url = buildUrl((params) => params.set('action', 'add-section'))
        router.replace(url)
    }, [buildUrl, router])

    const closeDrawer = useCallback(() => {
        closingRef.current = true
        setDrawerOpen(false)
        setEditTarget(null)
        const url = buildUrl((params) => params.delete('action'))
        router.replace(url)
    }, [buildUrl, router])

    useEffect(() => {
        if (closingRef.current) {
            closingRef.current = false
            return
        }
        if (actionParam === 'add-course' && !drawerOpen) {
            openCourseDrawer()
        } else if (actionParam === 'add-section' && !drawerOpen) {
            openSectionDrawer()
        }
    }, [actionParam, drawerOpen, openCourseDrawer, openSectionDrawer])

    const handleSaveCourse = async () => {
        if (!courseForm.code.trim() || !courseForm.name.trim()) {
            setError(dict.bulk.missingCourseFields)
            return
        }

        setSaving(true)
        setError('')

        try {
            if (editTarget?.type === 'course') {
                const result = await fetchJsonWithCsrf<{ course?: CourseRow }>(
                    `/api/admin/school/courses?courseId=${editTarget.id}`,
                    {
                        method: 'PATCH',
                        body: {
                            code: courseForm.code.trim(),
                            name: courseForm.name.trim(),
                        }
                    }
                )
                if (result?.course) {
                    setCourses((prev) =>
                        prev.map((course) =>
                            course.id === editTarget.id ? result.course! : course
                        )
                    )
                }
            } else {
                const result = await fetchJsonWithCsrf<{ course?: CourseRow }>(
                    '/api/admin/school/courses',
                    {
                        method: 'POST',
                        body: {
                            institutionId,
                            code: courseForm.code.trim(),
                            name: courseForm.name.trim(),
                        }
                    }
                )
                if (result?.course) {
                    setCourses((prev) => [...prev, result.course!])
                }
            }
            closeDrawer()
        } catch (err) {
            console.error('[Classes] Save course failed', err)
            setError(dict.saveError)
        } finally {
            setSaving(false)
        }
    }

    const handleSaveSection = async () => {
        if (!sectionForm.courseId || !sectionForm.name.trim()) {
            setError(dict.bulk.missingSectionFields)
            return
        }

        setSaving(true)
        setError('')

        try {
            if (editTarget?.type === 'section') {
                const result = await fetchJsonWithCsrf<{ section?: SectionRow }>(
                    `/api/admin/school/sections?sectionId=${editTarget.id}`,
                    {
                        method: 'PATCH',
                        body: {
                            sectionId: editTarget.id,
                            name: sectionForm.name.trim(),
                            parentId: sectionForm.parentId || null,
                        }
                    }
                )
                if (result?.section) {
                    setSections((prev) =>
                        prev.map((section) =>
                            section.id === editTarget.id ? result.section! : section
                        )
                    )
                }
            } else {
                const result = await fetchJsonWithCsrf<{ section?: SectionRow }>(
                    '/api/admin/school/sections',
                    {
                        method: 'POST',
                        body: {
                            courseId: sectionForm.courseId,
                            name: sectionForm.name.trim(),
                            parentId: sectionForm.parentId || undefined,
                        }
                    }
                )
                if (result?.section) {
                    setSections((prev) => [...prev, result.section!])
                }
            }
            closeDrawer()
        } catch (err) {
            console.error('[Classes] Save section failed', err)
            setError(dict.saveError)
        } finally {
            setSaving(false)
        }
    }

    const handleArchive = async () => {
        if (!pendingArchive) return

        try {
            const { type, id } = pendingArchive

            if (type === 'course') {
                const course = courses.find((c) => c.id === id)
                const isCurrentlyArchived = isArchived(course?.archivedAt)
                await fetchJsonWithCsrf(
                    `/api/admin/school/courses?courseId=${id}`,
                    { method: 'PATCH', body: { archived: !isCurrentlyArchived } }
                )
                setCourses((prev) =>
                    prev.map((c) =>
                        c.id === id
                            ? { ...c, archivedAt: isCurrentlyArchived ? null : new Date().toISOString() }
                            : c
                    )
                )
            } else {
                const section = sections.find((s) => s.id === id)
                const isCurrentlyArchived = isArchived(section?.archivedAt)
                await fetchJsonWithCsrf(
                    `/api/admin/school/sections?sectionId=${id}`,
                    { method: 'PATCH', body: { archived: !isCurrentlyArchived } }
                )
                setSections((prev) =>
                    prev.map((s) =>
                        s.id === id
                            ? { ...s, archivedAt: isCurrentlyArchived ? null : new Date().toISOString() }
                            : s
                    )
                )
            }
        } catch (err) {
            console.error('[Classes] Archive failed', err)
            setError(dict.saveError)
        } finally {
            setConfirmOpen(false)
            setPendingArchive(null)
        }
    }

    const requestArchive = (type: 'course' | 'section', id: string) => {
        setPendingArchive({ type, id })
        setConfirmOpen(true)
    }

    const openEditCourse = (courseId: string, trigger?: HTMLElement | null) => {
        const course = courses.find((entry) => entry.id === courseId)
        if (!course) return
        setDrawerType('course')
        setCourseForm({ code: course.code, name: course.name })
        setEditTarget({ type: 'course', id: courseId })
        setError('')
        setDrawerOpen(true)
        if (trigger) drawerReturnFocusRef.current = trigger
    }

    const openEditSection = (sectionId: string, trigger?: HTMLElement | null) => {
        const section = sections.find((entry) => entry.id === sectionId)
        if (!section) return
        setDrawerType('section')
        setSectionForm({ courseId: section.course.id, name: section.name, parentId: section.parentId || '' })
        setEditTarget({ type: 'section', id: sectionId })
        setError('')
        setDrawerOpen(true)
        if (trigger) drawerReturnFocusRef.current = trigger
    }

    // Roster management handlers
    const openRosterDrawer = (sectionId: string, trigger?: HTMLElement | null) => {
        const section = sections.find((s) => s.id === sectionId)
        if (!section) return
        setRosterSection(section)
        setRosterSearch('')
        setRosterDrawerOpen(true)
        if (trigger) rosterReturnFocusRef.current = trigger
    }

    const closeRosterDrawer = () => {
        setRosterDrawerOpen(false)
        setRosterSection(null)
    }

    const openAddStudentsDrawer = () => {
        setAddStudentsSearch('')
        setSelectedStudentIds(new Set())
        setAddStudentsDrawerOpen(true)
    }

    const closeAddStudentsDrawer = () => {
        setAddStudentsDrawerOpen(false)
        setSelectedStudentIds(new Set())
    }

    const toggleStudentSelection = (studentId: string) => {
        setSelectedStudentIds((prev) => {
            const next = new Set(prev)
            if (next.has(studentId)) {
                next.delete(studentId)
            } else {
                next.add(studentId)
            }
            return next
        })
    }

    const handleAddStudents = async () => {
        if (!rosterSection || selectedStudentIds.size === 0) return

        setRosterSaving(true)
        setError('')

        try {
            const newEnrollments: Array<{ id: string; role: string; user: { id: string; name: string | null; email: string | null; archivedAt: string | null } }> = []

            for (const studentId of selectedStudentIds) {
                const student = students.find((s) => s.id === studentId)
                if (!student) continue

                const result = await fetchJsonWithCsrf<{ enrollment?: { id: string } }>(
                    '/api/admin/school/enrollments',
                    {
                        method: 'POST',
                        body: {
                            userId: studentId,
                            classId: rosterSection.id,
                            role: 'STUDENT',
                        }
                    }
                )

                if (result?.enrollment) {
                    newEnrollments.push({
                        id: result.enrollment.id,
                        role: 'STUDENT',
                        user: {
                            id: student.id,
                            name: student.name,
                            email: student.email,
                            archivedAt: student.archivedAt ?? null,
                        }
                    })
                }
            }

            // Update sections state with new enrollments
            setSections((prev) =>
                prev.map((s) =>
                    s.id === rosterSection.id
                        ? { ...s, enrollments: [...s.enrollments, ...newEnrollments] }
                        : s
                )
            )

            // Update rosterSection with new enrollments
            setRosterSection((prev) =>
                prev ? { ...prev, enrollments: [...prev.enrollments, ...newEnrollments] } : prev
            )

            router.refresh()
            closeAddStudentsDrawer()
        } catch (err) {
            console.error('[Classes] Add students failed', err)
            setError(dict.saveError)
        } finally {
            setRosterSaving(false)
        }
    }

    const requestRemoveEnrollment = (enrollmentId: string) => {
        setPendingRemoveEnrollmentId(enrollmentId)
        setConfirmRemoveOpen(true)
    }

    const handleRemoveEnrollment = async () => {
        if (!pendingRemoveEnrollmentId || !rosterSection) return

        setRosterSaving(true)

        try {
            await fetchJsonWithCsrf(
                `/api/admin/school/enrollments?enrollmentId=${pendingRemoveEnrollmentId}`,
                { method: 'DELETE' }
            )

            // Update sections state
            setSections((prev) =>
                prev.map((s) =>
                    s.id === rosterSection.id
                        ? { ...s, enrollments: s.enrollments.filter((e) => e.id !== pendingRemoveEnrollmentId) }
                        : s
                )
            )

            // Update rosterSection
            setRosterSection((prev) =>
                prev ? { ...prev, enrollments: prev.enrollments.filter((e) => e.id !== pendingRemoveEnrollmentId) } : prev
            )

            router.refresh()
        } catch (err) {
            console.error('[Classes] Remove enrollment failed', err)
            setError(dict.saveError)
        } finally {
            setRosterSaving(false)
            setConfirmRemoveOpen(false)
            setPendingRemoveEnrollmentId('')
        }
    }

    // Computed values for roster
    const rosterStudents = useMemo(() => {
        if (!rosterSection) return []
        const query = normalizeValue(rosterSearch)
        return rosterSection.enrollments
            .filter((e) => e.role === 'STUDENT')
            .filter((e) => {
                if (!query) return true
                return normalizeValue(e.user.name).includes(query) ||
                    normalizeValue(e.user.email).includes(query)
            })
    }, [rosterSection, rosterSearch])

    const availableStudentsToAdd = useMemo(() => {
        if (!rosterSection) return []
        const enrolledIds = new Set(rosterSection.enrollments.map((e) => e.user.id))
        const query = normalizeValue(addStudentsSearch)
        return students
            .filter((s) => !isArchived(s.archivedAt))
            .filter((s) => !enrolledIds.has(s.id))
            .filter((s) => {
                if (!query) return true
                return normalizeValue(s.name).includes(query) ||
                    normalizeValue(s.email).includes(query)
            })
    }, [rosterSection, students, addStudentsSearch])

    const activeCourses = courses.filter(c => !isArchived(c.archivedAt))

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-brand-900">{dict.nav.classes}</h1>
                    <p className="text-sm text-gray-500">{dict.classes.subtitle}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={(e) => openCourseDrawer(e.currentTarget)}
                        className="inline-flex items-center rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
                    >
                        {dict.createCourseButton}
                    </button>
                    <button
                        type="button"
                        onClick={(e) => openSectionDrawer(e.currentTarget)}
                        className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        {dict.createSectionButton}
                    </button>
                </div>
            </div>

            {/* Tabs + Search */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setTabParam('courses')}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${activeTab === 'courses'
                                ? 'bg-brand-900 text-white'
                                : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {dict.tabs.courses} ({filteredCourses.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setTabParam('sections')}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${activeTab === 'sections'
                                ? 'bg-brand-900 text-white'
                                : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {dict.tabs.sections} ({filteredSections.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setTabParam('exams')}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${activeTab === 'exams'
                                ? 'bg-brand-900 text-white'
                                : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {dict.tabs.exams} ({filteredExams.length})
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={activeTab === 'courses' ? dict.searchCoursesPlaceholder : activeTab === 'sections' ? dict.searchSectionsPlaceholder : dict.searchExamsPlaceholder}
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

            {/* Content based on active tab */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                {activeTab === 'courses' && (
                    filteredCourses.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500">{dict.emptyCourses}</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3">{dict.courseCodePlaceholder}</th>
                                        <th className="px-4 py-3">{dict.courseNamePlaceholder}</th>
                                        <th className="px-4 py-3">{dict.courseMeta.sectionsLabel}</th>
                                        <th className="px-4 py-3">{dict.courseMeta.examsLabel}</th>
                                        <th className="px-4 py-3 text-right">{dict.users.actions}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredCourses.map((course) => {
                                        const archived = isArchived(course.archivedAt)
                                        return (
                                            <tr key={course.id} className={archived ? 'bg-gray-50 opacity-60' : ''}>
                                                <td className="px-4 py-3 font-medium text-gray-900">{course.code}</td>
                                                <td className="px-4 py-3 text-gray-700">{course.name}</td>
                                                <td className="px-4 py-3 text-gray-600">{course._count.classes}</td>
                                                <td className="px-4 py-3 text-gray-600">{course._count.exams}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={(event) => openEditCourse(course.id, event.currentTarget)}
                                                            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                                        >
                                                            {dict.users.edit}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => requestArchive('course', course.id)}
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
                    )
                )}

                {activeTab === 'sections' && (
                    hierarchicalSections.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500">{dict.emptySections}</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3">{dict.sectionNamePlaceholder}</th>
                                        <th className="px-4 py-3">{dict.tabs.courses}</th>
                                        <th className="px-4 py-3">{dict.sectionMeta.teachersLabel}</th>
                                        <th className="px-4 py-3">{dict.sectionMeta.studentsLabel}</th>
                                        <th className="px-4 py-3 text-right">{dict.users.actions}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {hierarchicalSections.map((section) => {
                                        const archived = isArchived(section.archivedAt)
                                        const teacherCount = section.enrollments.filter(e => e.role === 'TEACHER').length
                                        const studentCount = section.enrollments.filter(e => e.role === 'STUDENT').length
                                        return (
                                            <tr key={section.id} className={`${archived ? 'bg-gray-50 opacity-60' : ''} ${section.isSubgroup ? 'bg-gray-50/50' : ''}`}>
                                                <td className={`px-4 py-3 font-medium text-gray-900 ${section.isSubgroup ? 'pl-10' : ''}`}>
                                                    <div className="flex items-center gap-2">
                                                        {section.isSubgroup && (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                        <span>{section.name}</span>
                                                        {section.childCount > 0 && (
                                                            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                                                                {dict.classes.subgroupBadge.replace('{{count}}', String(section.childCount))}
                                                            </span>
                                                        )}
                                                        {section.isSubgroup && section.parent && (
                                                            <span className="text-xs text-gray-400">({section.parent.name})</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">{section.course.code} - {section.course.name}</td>
                                                <td className="px-4 py-3 text-gray-600">{teacherCount}</td>
                                                <td className="px-4 py-3 text-gray-600">{studentCount}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={(event) => openRosterDrawer(section.id, event.currentTarget)}
                                                            className="rounded-md border border-brand-900 px-3 py-1 text-xs font-medium text-brand-900 hover:bg-brand-50"
                                                        >
                                                            {dict.classes.manageRosterButton}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(event) => openEditSection(section.id, event.currentTarget)}
                                                            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                                        >
                                                            {dict.users.edit}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => requestArchive('section', section.id)}
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
                    )
                )}

                {activeTab === 'exams' && (
                    filteredExams.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500">{dict.emptyExams}</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3">{dict.examMeta.titleLabel}</th>
                                        <th className="px-4 py-3">{dict.tabs.courses}</th>
                                        <th className="px-4 py-3">{dict.examMeta.sectionLabel}</th>
                                        <th className="px-4 py-3">{dict.examMeta.statusLabel}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredExams.map((exam) => {
                                        const archived = isArchived(exam.archivedAt)
                                        return (
                                            <tr key={exam.id} className={archived ? 'bg-gray-50 opacity-60' : ''}>
                                                <td className="px-4 py-3 font-medium text-gray-900">{exam.title || dict.unknownName}</td>
                                                <td className="px-4 py-3 text-gray-700">{exam.course.code}</td>
                                                <td className="px-4 py-3 text-gray-600">{exam.class?.name || dict.none}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${exam.status === 'DRAFT'
                                                        ? 'bg-gray-100 text-gray-600'
                                                        : 'bg-green-100 text-green-700'
                                                    }`}>
                                                        {exam.status === 'DRAFT' ? dict.examStatusDraft : dict.examStatusPublished}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>

            {/* Drawers */}
            <Drawer
                open={drawerOpen && drawerType === 'course'}
                onClose={closeDrawer}
                title={editTarget?.type === 'course' ? dict.classes.editCourseTitle : dict.createCourseTitle}
                returnFocusRef={drawerReturnFocusRef}
            >
                <div className="grid grid-cols-1 gap-4">
                    <label className="flex flex-col gap-1 text-sm text-gray-700">
                        <span className="font-medium">{dict.courseCodePlaceholder} *</span>
                        <input
                            type="text"
                            value={courseForm.code}
                            onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-gray-700">
                        <span className="font-medium">{dict.courseNamePlaceholder} *</span>
                        <input
                            type="text"
                            value={courseForm.name}
                            onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
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
                    <button type="button" onClick={closeDrawer} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        {dict.cancelArchiveButton}
                    </button>
                    <button type="button" onClick={handleSaveCourse} disabled={saving} className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60">
                        {editTarget?.type === 'course' ? dict.users.saveButton : dict.createCourseButton}
                    </button>
                </div>
            </Drawer>

            <Drawer
                open={drawerOpen && drawerType === 'section'}
                onClose={closeDrawer}
                title={editTarget?.type === 'section' ? dict.classes.editSectionTitle : dict.createSectionTitle}
                returnFocusRef={drawerReturnFocusRef}
            >
                <div className="grid grid-cols-1 gap-4">
                    <label className="flex flex-col gap-1 text-sm text-gray-700">
                        <span className="font-medium">{dict.selectCoursePlaceholder} *</span>
                        <select
                            value={sectionForm.courseId}
                            onChange={(e) => setSectionForm({ ...sectionForm, courseId: e.target.value, parentId: '' })}
                            disabled={editTarget?.type === 'section'}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                        >
                            <option value="">{dict.selectCoursePlaceholder}</option>
                            {activeCourses.map((c) => (
                                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-gray-700">
                        <span className="font-medium">{dict.sectionNamePlaceholder} *</span>
                        <input
                            type="text"
                            value={sectionForm.name}
                            onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                        />
                    </label>
                    {sectionForm.courseId && availableParentSections.length > 0 && (
                        <label className="flex flex-col gap-1 text-sm text-gray-700">
                            <span className="font-medium">{dict.classes.parentSectionLabel}</span>
                            <select
                                value={sectionForm.parentId}
                                onChange={(e) => setSectionForm({ ...sectionForm, parentId: e.target.value })}
                                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                            >
                                <option value="">{dict.classes.parentSectionPlaceholder}</option>
                                {availableParentSections.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                            {sectionForm.parentId && (
                                <span className="text-xs text-gray-500">{dict.classes.createSubgroupHint}</span>
                            )}
                        </label>
                    )}
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
                    <button type="button" onClick={handleSaveSection} disabled={saving} className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60">
                        {editTarget?.type === 'section' ? dict.users.saveButton : dict.createSectionButton}
                    </button>
                </div>
            </Drawer>

            <ConfirmModal
                open={confirmOpen}
                title={dict.classes.archiveConfirmTitle}
                description={dict.classes.archiveConfirmDescription}
                confirmLabel={dict.confirmArchiveButton}
                cancelLabel={dict.cancelArchiveButton}
                onConfirm={handleArchive}
                onCancel={() => {
                    setConfirmOpen(false)
                    setPendingArchive(null)
                }}
            />

            {/* Roster Drawer */}
            <Drawer
                open={rosterDrawerOpen}
                onClose={closeRosterDrawer}
                title={rosterSection ? `${dict.classes.rosterTitle} - ${rosterSection.name}` : dict.classes.rosterTitle}
                returnFocusRef={rosterReturnFocusRef}
            >
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-2">
                        <input
                            type="text"
                            value={rosterSearch}
                            onChange={(e) => setRosterSearch(e.target.value)}
                            placeholder={dict.searchStudentsPlaceholder}
                            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                        />
                        <button
                            type="button"
                            onClick={openAddStudentsDrawer}
                            className="rounded-md bg-brand-900 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800"
                        >
                            {dict.classes.addStudentsButton}
                        </button>
                    </div>

                    {rosterStudents.length === 0 ? (
                        <div className="py-4 text-center text-sm text-gray-500">
                            {dict.classes.rosterEmpty}
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200 rounded-md border border-gray-200">
                            {rosterStudents.map((enrollment) => (
                                <div key={enrollment.id} className="flex items-center justify-between px-3 py-2">
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">
                                            {enrollment.user.name || dict.unknownName}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {enrollment.user.email || dict.unknownEmail}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => requestRemoveEnrollment(enrollment.id)}
                                        disabled={rosterSaving}
                                        className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                                    >
                                        {dict.removeLabel}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Drawer>

            {/* Add Students Drawer */}
            <Drawer
                open={addStudentsDrawerOpen}
                onClose={closeAddStudentsDrawer}
                title={dict.classes.addStudentsTitle}
            >
                <div className="flex flex-col gap-4">
                    <input
                        type="text"
                        value={addStudentsSearch}
                        onChange={(e) => setAddStudentsSearch(e.target.value)}
                        placeholder={dict.searchStudentsPlaceholder}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                    />

                    {availableStudentsToAdd.length === 0 ? (
                        <div className="py-4 text-center text-sm text-gray-500">
                            {dict.classes.noStudentsToAdd}
                        </div>
                    ) : (
                        <div className="max-h-64 divide-y divide-gray-200 overflow-y-auto rounded-md border border-gray-200">
                            {availableStudentsToAdd.map((student) => (
                                <label
                                    key={student.id}
                                    className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedStudentIds.has(student.id)}
                                        onChange={() => toggleStudentSelection(student.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                    />
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-gray-900">
                                            {student.name || dict.unknownName}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {student.email || dict.unknownEmail}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}

                    {error && (
                        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                            {dict.classes.selectedCount.replace('{{count}}', String(selectedStudentIds.size))}
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={closeAddStudentsDrawer}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                {dict.cancelArchiveButton}
                            </button>
                            <button
                                type="button"
                                onClick={handleAddStudents}
                                disabled={rosterSaving || selectedStudentIds.size === 0}
                                className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {dict.assignButton}
                            </button>
                        </div>
                    </div>
                </div>
            </Drawer>

            {/* Remove Enrollment Confirm Modal */}
            <ConfirmModal
                open={confirmRemoveOpen}
                title={dict.enrollments.removeConfirmTitle}
                description={dict.enrollments.removeConfirmDescription}
                confirmLabel={dict.removeLabel}
                cancelLabel={dict.cancelArchiveButton}
                onConfirm={handleRemoveEnrollment}
                onCancel={() => {
                    setConfirmRemoveOpen(false)
                    setPendingRemoveEnrollmentId('')
                }}
            />
        </div>
    )
}
