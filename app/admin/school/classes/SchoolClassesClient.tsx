'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { CourseRow, SectionRow, ExamRow, PersonRow } from '@/lib/school-admin-data'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'
import Drawer from '@/components/ui/Drawer'
import ConfirmModal from '@/components/ui/ConfirmModal'
import CourseFormModal from '@/components/admin/school/CourseFormModal'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Stack, Inline } from '@/components/ui/Layout'
import { Badge } from '@/components/ui/Badge'
import { Input, Select } from '@/components/ui/Form'
import { SearchField } from '@/components/ui/SearchField'
import { EmptyState } from '@/components/ui/EmptyState'

type SchoolClassesClientProps = {
    dictionary: Dictionary
    institutionId: string
    courses: CourseRow[]
    sections: SectionRow[]
    exams: ExamRow[]
    students: PersonRow[]
    teachers: PersonRow[]
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
    teachers,
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
    const [exams, setExams] = useState(initialExams)
    const [students] = useState(initialStudents)
    const [search, setSearch] = useState('')
    const [showArchived, setShowArchived] = useState(false)

    // Sync local state with server data when props change (after router.refresh())
    useEffect(() => {
        setCourses(initialCourses)
        setSections(initialSections)
        setExams(initialExams)
    }, [initialCourses, initialSections, initialExams])

    const [drawerOpen, setDrawerOpen] = useState(false)
    // Course modal state
    const [courseModalOpen, setCourseModalOpen] = useState(false)
    const [editCourse, setEditCourse] = useState<CourseRow | null>(null)
    const [sectionForm, setSectionForm] = useState({ courseId: '', name: '', parentId: '' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [editTarget, setEditTarget] = useState<{ type: 'course' | 'section'; id: string } | null>(null)

    const [confirmOpen, setConfirmOpen] = useState(false)
    const [pendingArchive, setPendingArchive] = useState<{ type: 'course' | 'section' | 'exam'; id: string } | null>(null)

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

    // Course details drawer state
    const [courseDetailsOpen, setCourseDetailsOpen] = useState(false)
    const [selectedCourse, setSelectedCourse] = useState<CourseRow | null>(null)

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

    // Course details computed values
    const courseSections = useMemo(() => {
        if (!selectedCourse) return []
        return sections.filter(s =>
            s.course.id === selectedCourse.id &&
            !isDefaultSection(s) &&
            !isArchived(s.archivedAt)
        )
    }, [selectedCourse, sections])

    const courseTeachers = useMemo(() => {
        if (!selectedCourse) return []
        const teacherIds = new Set<string>()
        const result: Array<{ id: string; name: string | null; email: string | null }> = []
        sections
            .filter(s => s.course.id === selectedCourse.id)
            .forEach(s => {
                s.enrollments
                    .filter(e => e.role === 'TEACHER')
                    .forEach(e => {
                        if (!teacherIds.has(e.user.id)) {
                            teacherIds.add(e.user.id)
                            result.push(e.user)
                        }
                    })
            })
        return result
    }, [selectedCourse, sections])

    const courseStudents = useMemo(() => {
        if (!selectedCourse) return []
        const studentIds = new Set<string>()
        const result: Array<{ id: string; name: string | null; email: string | null }> = []
        sections
            .filter(s => s.course.id === selectedCourse.id)
            .forEach(s => {
                s.enrollments
                    .filter(e => e.role === 'STUDENT')
                    .forEach(e => {
                        if (!studentIds.has(e.user.id)) {
                            studentIds.add(e.user.id)
                            result.push(e.user)
                        }
                    })
            })
        return result
    }, [selectedCourse, sections])

    const courseExams = useMemo(() => {
        if (!selectedCourse) return []
        return exams.filter(e =>
            e.course.code === selectedCourse.code &&
            !isArchived(e.archivedAt)
        )
    }, [selectedCourse, exams])

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

    const openCourseModal = useCallback((course?: CourseRow | null) => {
        setEditCourse(course || null)
        setCourseModalOpen(true)
    }, [])

    const closeCourseModal = useCallback(() => {
        setCourseModalOpen(false)
        setEditCourse(null)
    }, [])

    const openCourseDetails = useCallback((course: CourseRow) => {
        setSelectedCourse(course)
        setCourseDetailsOpen(true)
    }, [])

    const closeCourseDetails = useCallback(() => {
        setCourseDetailsOpen(false)
        setSelectedCourse(null)
    }, [])

    const openSectionDrawer = useCallback((trigger?: HTMLElement | null) => {
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
        if (actionParam === 'add-section' && !drawerOpen) {
            openSectionDrawer()
        }
    }, [actionParam, drawerOpen, openSectionDrawer])

    const handleCourseSaved = useCallback((course: CourseRow) => {
        if (editCourse) {
            setCourses((prev) =>
                prev.map((c) => c.id === course.id ? course : c)
            )
        } else {
            setCourses((prev) => [...prev, course])
        }
        router.refresh()
    }, [editCourse, router])

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
                    '/api/admin/school/sections',
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
                    '/api/admin/school/courses',
                    { method: 'PATCH', body: { courseId: id, archived: !isCurrentlyArchived } }
                )
                setCourses((prev) =>
                    prev.map((c) =>
                        c.id === id
                            ? { ...c, archivedAt: isCurrentlyArchived ? null : new Date().toISOString() }
                            : c
                    )
                )
            } else if (type === 'section') {
                const section = sections.find((s) => s.id === id)
                const isCurrentlyArchived = isArchived(section?.archivedAt)
                await fetchJsonWithCsrf(
                    '/api/admin/school/sections',
                    { method: 'PATCH', body: { sectionId: id, archived: !isCurrentlyArchived } }
                )
                setSections((prev) =>
                    prev.map((s) =>
                        s.id === id
                            ? { ...s, archivedAt: isCurrentlyArchived ? null : new Date().toISOString() }
                            : s
                    )
                )
            } else if (type === 'exam') {
                const exam = exams.find((e) => e.id === id)
                const isCurrentlyArchived = isArchived(exam?.archivedAt)
                await fetchJsonWithCsrf(
                    '/api/admin/school/exams',
                    { method: 'PATCH', body: { examId: id, archived: !isCurrentlyArchived } }
                )
                setExams((prev) =>
                    prev.map((e) =>
                        e.id === id
                            ? { ...e, archivedAt: isCurrentlyArchived ? null : new Date().toISOString() }
                            : e
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

    const requestArchive = (type: 'course' | 'section' | 'exam', id: string) => {
        setPendingArchive({ type, id })
        setConfirmOpen(true)
    }

    const openEditCourse = (courseId: string) => {
        const course = courses.find((entry) => entry.id === courseId)
        if (!course) return
        openCourseModal(course)
    }

    const openEditSection = (sectionId: string, trigger?: HTMLElement | null) => {
        const section = sections.find((entry) => entry.id === sectionId)
        if (!section) return
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
        <Stack gap="xl">
            {/* Header */}
            <Inline align="between" gap="md">
                <Stack gap="xs">
                    <Text as="h1" variant="pageTitle">{dict.nav.classes}</Text>
                    <Text variant="muted">{dict.classes.subtitle}</Text>
                </Stack>
                <Inline align="start" gap="xs">
                    <Button
                        onClick={() => openCourseModal()}
                        variant="primary"
                    >
                        {dict.createCourseButton}
                    </Button>
                    <Button
                        onClick={(e) => openSectionDrawer(e.currentTarget)}
                        variant="secondary"
                    >
                        {dict.createSectionButton}
                    </Button>
                </Inline>
            </Inline>

            {/* Tabs + Search */}
            <Card>
                <CardBody padding="md">
                    <Inline align="between" gap="md" wrap="wrap">
                        <Inline align="start" gap="xs">
                            <Button
                                onClick={() => setTabParam('courses')}
                                variant={activeTab === 'courses' ? 'primary' : 'secondary'}
                                size="sm"
                            >
                                {dict.tabs.courses} ({filteredCourses.length})
                            </Button>
                            <Button
                                onClick={() => setTabParam('sections')}
                                variant={activeTab === 'sections' ? 'primary' : 'secondary'}
                                size="sm"
                            >
                                {dict.tabs.sections} ({filteredSections.length})
                            </Button>
                            <Button
                                onClick={() => setTabParam('exams')}
                                variant={activeTab === 'exams' ? 'primary' : 'secondary'}
                                size="sm"
                            >
                                {dict.tabs.exams} ({filteredExams.length})
                            </Button>
                        </Inline>
                        <Inline align="center" gap="sm">
                            <SearchField
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={activeTab === 'courses' ? dict.searchCoursesPlaceholder : activeTab === 'sections' ? dict.searchSectionsPlaceholder : dict.searchExamsPlaceholder}
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

            {/* Content based on active tab */}
            <Card>
                {activeTab === 'courses' && (
                    filteredCourses.length === 0 ? (
                        <CardBody padding="md">
                            <EmptyState title={dict.emptyCourses} size="compact" />
                        </CardBody>
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
                                            <tr
                                                key={course.id}
                                                className={`${archived ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'} cursor-pointer transition-colors`}
                                                onClick={() => openCourseDetails(course)}
                                            >
                                                <td className="px-4 py-3 font-medium text-gray-900">{course.code}</td>
                                                <td className="px-4 py-3 text-gray-700">{course.name}</td>
                                                <td className="px-4 py-3 text-gray-600">{course._count.classes}</td>
                                                <td className="px-4 py-3 text-gray-600">{course._count.exams}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <Inline align="end" gap="xs">
                                                        <Button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                openEditCourse(course.id)
                                                            }}
                                                            variant="secondary"
                                                            size="xs"
                                                        >
                                                            {dict.users.edit}
                                                        </Button>
                                                        <Button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                requestArchive('course', course.id)
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
                    )
                )}

                {activeTab === 'sections' && (
                    hierarchicalSections.length === 0 ? (
                        <CardBody padding="md">
                            <EmptyState title={dict.emptySections} size="compact" />
                        </CardBody>
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
                                                            <Badge variant="info">
                                                                {dict.classes.subgroupBadge.replace('{{count}}', String(section.childCount))}
                                                            </Badge>
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
                                                    <Inline align="end" gap="xs">
                                                        <Button
                                                            onClick={(event) => openRosterDrawer(section.id, event.currentTarget)}
                                                            variant="primary"
                                                            size="xs"
                                                        >
                                                            {dict.classes.manageRosterButton}
                                                        </Button>
                                                        <Button
                                                            onClick={(event) => openEditSection(section.id, event.currentTarget)}
                                                            variant="secondary"
                                                            size="xs"
                                                        >
                                                            {dict.users.edit}
                                                        </Button>
                                                        <Button
                                                            onClick={() => requestArchive('section', section.id)}
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
                    )
                )}

                {activeTab === 'exams' && (
                    filteredExams.length === 0 ? (
                        <CardBody padding="md">
                            <EmptyState title={dict.emptyExams} size="compact" />
                        </CardBody>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3">{dict.examMeta.titleLabel}</th>
                                        <th className="px-4 py-3">{dict.tabs.courses}</th>
                                        <th className="px-4 py-3">{dict.examMeta.sectionLabel}</th>
                                        <th className="px-4 py-3">{dict.examMeta.statusLabel}</th>
                                        <th className="px-4 py-3 text-right">{dict.users.actions}</th>
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
                                                    <Badge variant={exam.status === 'DRAFT' ? 'neutral' : 'success'}>
                                                        {exam.status === 'DRAFT' ? dict.examStatusDraft : dict.examStatusPublished}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button
                                                        onClick={() => requestArchive('exam', exam.id)}
                                                        variant="ghost"
                                                        size="xs"
                                                    >
                                                        {archived ? dict.restoreLabel : dict.archiveLabel}
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </Card>

            {/* Course Modal */}
            <CourseFormModal
                open={courseModalOpen}
                onClose={closeCourseModal}
                onSave={handleCourseSaved}
                institutionId={institutionId}
                teachers={teachers}
                existingStudents={students}
                existingSections={sections}
                editCourse={editCourse}
                dict={{
                    createCourseTitle: dict.createCourseTitle,
                    editCourseTitle: dict.classes.editCourseTitle,
                    courseCodePlaceholder: dict.courseCodePlaceholder,
                    courseNamePlaceholder: dict.courseNamePlaceholder,
                    cancelArchiveButton: dict.cancelArchiveButton,
                    createCourseButton: dict.createCourseButton,
                    saveButton: dict.users.saveButton,
                    saveError: dict.saveError,
                }}
            />

            {/* Course Details Drawer */}
            <Drawer
                open={courseDetailsOpen}
                onClose={closeCourseDetails}
                title={selectedCourse ? `${selectedCourse.code} - ${selectedCourse.name}` : ''}
            >
                {selectedCourse && (
                    <div className="flex flex-col gap-6">
                        {/* Sections */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-900 mb-2">
                                {dict.tabs.sections} ({courseSections.length})
                            </h3>
                            {courseSections.length === 0 ? (
                                <p className="text-sm text-gray-500">{dict.emptySections}</p>
                            ) : (
                                <div className="divide-y divide-gray-200 rounded-lg border border-gray-200">
                                    {courseSections.map(section => {
                                        const teacherCount = section.enrollments.filter(e => e.role === 'TEACHER').length
                                        const studentCount = section.enrollments.filter(e => e.role === 'STUDENT').length
                                        return (
                                            <div key={section.id} className="px-3 py-2 flex items-center justify-between">
                                                <span className="font-medium text-gray-900">{section.name}</span>
                                                <span className="text-xs text-gray-500">
                                                    {teacherCount} prof · {studentCount} etud.
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Teachers */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-900 mb-2">
                                {dict.tabs.teachers} ({courseTeachers.length})
                            </h3>
                            {courseTeachers.length === 0 ? (
                                <p className="text-sm text-gray-500">{dict.emptyTeachers}</p>
                            ) : (
                                <div className="divide-y divide-gray-200 rounded-lg border border-gray-200">
                                    {courseTeachers.map(teacher => (
                                        <div key={teacher.id} className="px-3 py-2">
                                            <div className="font-medium text-gray-900">{teacher.name || dict.unknownName}</div>
                                            <div className="text-xs text-gray-500">{teacher.email}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Students */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-900 mb-2">
                                {dict.tabs.students} ({courseStudents.length})
                            </h3>
                            {courseStudents.length === 0 ? (
                                <p className="text-sm text-gray-500">{dict.emptyStudents}</p>
                            ) : (
                                <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 max-h-40 overflow-y-auto">
                                    {courseStudents.slice(0, 20).map(student => (
                                        <div key={student.id} className="px-3 py-2">
                                            <div className="font-medium text-gray-900">{student.name || dict.unknownName}</div>
                                            <div className="text-xs text-gray-500">{student.email}</div>
                                        </div>
                                    ))}
                                    {courseStudents.length > 20 && (
                                        <div className="px-3 py-2 text-xs text-gray-400">
                                            +{courseStudents.length - 20} autres...
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Exams */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-900 mb-2">
                                {dict.tabs.exams} ({courseExams.length})
                            </h3>
                            {courseExams.length === 0 ? (
                                <p className="text-sm text-gray-500">{dict.emptyExams}</p>
                            ) : (
                                <div className="divide-y divide-gray-200 rounded-lg border border-gray-200">
                                    {courseExams.map(exam => (
                                        <div key={exam.id} className="px-3 py-2 flex items-center justify-between">
                                            <span className="font-medium text-gray-900">{exam.title || dict.unknownName}</span>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                exam.status === 'DRAFT'
                                                    ? 'bg-gray-100 text-gray-600'
                                                    : 'bg-green-100 text-green-700'
                                            }`}>
                                                {exam.status === 'DRAFT' ? dict.examStatusDraft : dict.examStatusPublished}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <Inline align="end" gap="xs" className="border-t border-gray-200 pt-4">
                            <Button
                                onClick={() => {
                                    closeCourseDetails()
                                    openEditCourse(selectedCourse.id)
                                }}
                                variant="secondary"
                            >
                                {dict.users.edit}
                            </Button>
                            <Button
                                onClick={closeCourseDetails}
                                variant="primary"
                            >
                                {dict.profile.closeButton}
                            </Button>
                        </Inline>
                    </div>
                )}
            </Drawer>

            {/* Section Drawer */}
            <Drawer
                open={drawerOpen}
                onClose={closeDrawer}
                title={editTarget?.type === 'section' ? dict.classes.editSectionTitle : dict.createSectionTitle}
                returnFocusRef={drawerReturnFocusRef}
            >
                <Stack gap="md">
                    <Stack gap="xs">
                        <Text variant="label">{dict.selectCoursePlaceholder} *</Text>
                        <Select
                            value={sectionForm.courseId}
                            onChange={(e) => setSectionForm({ ...sectionForm, courseId: e.target.value, parentId: '' })}
                            disabled={editTarget?.type === 'section'}
                        >
                            <option value="">{dict.selectCoursePlaceholder}</option>
                            {activeCourses.map((c) => (
                                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                            ))}
                        </Select>
                    </Stack>
                    <Stack gap="xs">
                        <Text variant="label">{dict.sectionNamePlaceholder} *</Text>
                        <Input
                            value={sectionForm.name}
                            onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                        />
                    </Stack>
                    {sectionForm.courseId && availableParentSections.length > 0 && (
                        <Stack gap="xs">
                            <Text variant="label">{dict.classes.parentSectionLabel}</Text>
                            <Select
                                value={sectionForm.parentId}
                                onChange={(e) => setSectionForm({ ...sectionForm, parentId: e.target.value })}
                            >
                                <option value="">{dict.classes.parentSectionPlaceholder}</option>
                                {availableParentSections.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </Select>
                            {sectionForm.parentId && (
                                <Text variant="caption">{dict.classes.createSubgroupHint}</Text>
                            )}
                        </Stack>
                    )}
                </Stack>
                {error && (
                    <Card className="mt-4">
                        <CardBody padding="sm">
                            <Text variant="body" className="text-red-700">{error}</Text>
                        </CardBody>
                    </Card>
                )}
                <Inline align="end" gap="xs" className="mt-6">
                    <Button onClick={closeDrawer} variant="secondary">
                        {dict.cancelArchiveButton}
                    </Button>
                    <Button onClick={handleSaveSection} disabled={saving} variant="primary">
                        {editTarget?.type === 'section' ? dict.users.saveButton : dict.createSectionButton}
                    </Button>
                </Inline>
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
                <Stack gap="md">
                    <Inline align="between" gap="xs">
                        <SearchField
                            value={rosterSearch}
                            onChange={(e) => setRosterSearch(e.target.value)}
                            placeholder={dict.searchStudentsPlaceholder}
                            className="flex-1"
                        />
                        <Button
                            onClick={openAddStudentsDrawer}
                            variant="primary"
                            size="sm"
                        >
                            {dict.classes.addStudentsButton}
                        </Button>
                    </Inline>

                    {rosterStudents.length === 0 ? (
                        <EmptyState
                            title={dict.classes.rosterEmpty}
                            size="compact"
                        />
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
                                    <Button
                                        onClick={() => requestRemoveEnrollment(enrollment.id)}
                                        disabled={rosterSaving}
                                        variant="destructive"
                                        size="xs"
                                    >
                                        {dict.removeLabel}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </Stack>
            </Drawer>

            {/* Add Students Drawer */}
            <Drawer
                open={addStudentsDrawerOpen}
                onClose={closeAddStudentsDrawer}
                title={dict.classes.addStudentsTitle}
            >
                <Stack gap="md">
                    <SearchField
                        value={addStudentsSearch}
                        onChange={(e) => setAddStudentsSearch(e.target.value)}
                        placeholder={dict.searchStudentsPlaceholder}
                    />

                    {availableStudentsToAdd.length === 0 ? (
                        <EmptyState
                            title={dict.classes.noStudentsToAdd}
                            size="compact"
                        />
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
                        <Card>
                            <CardBody padding="sm">
                                <Text variant="body" className="text-red-700">{error}</Text>
                            </CardBody>
                        </Card>
                    )}

                    <Inline align="between" gap="md">
                        <Text variant="muted">
                            {dict.classes.selectedCount.replace('{{count}}', String(selectedStudentIds.size))}
                        </Text>
                        <Inline align="end" gap="xs">
                            <Button
                                onClick={closeAddStudentsDrawer}
                                variant="secondary"
                            >
                                {dict.cancelArchiveButton}
                            </Button>
                            <Button
                                onClick={handleAddStudents}
                                disabled={rosterSaving || selectedStudentIds.size === 0}
                                variant="primary"
                            >
                                {dict.assignButton}
                            </Button>
                        </Inline>
                    </Inline>
                </Stack>
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
        </Stack>
    )
}
