'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { getExamEndAt } from '@/lib/exam-time'
import AdminResourceHeader from '@/components/admin/AdminResourceHeader'
import AdminActionPanels from '@/components/admin/AdminActionPanels'
import AdminResourcePage from '@/components/admin/AdminResourcePage'

type InstitutionInfo = {
    id: string
    name: string
    domains?: { domain: string }[]
    ssoConfig?: Record<string, unknown> | null
}

type CourseRow = {
    id: string
    code: string
    name: string
    archivedAt?: string | null
    _count: {
        classes: number
        exams: number
    }
}

type EnrollmentRow = {
    id: string
    role: string
    user: { id: string; name: string | null; email: string | null; archivedAt?: string | null }
}

type SectionRow = {
    id: string
    name: string
    archivedAt?: string | null
    course: { id: string; code: string; name: string }
    enrollments: EnrollmentRow[]
}

type ExamRow = {
    id: string
    title: string
    status: 'DRAFT' | 'PUBLISHED'
    startAt: string | Date | null
    endAt: string | Date | null
    durationMinutes: number | null
    createdAt: string | Date
    archivedAt?: string | null
    course: { code: string; name: string }
    class: { id: string; name: string } | null
}

type PersonRow = {
    id: string
    name: string | null
    email: string | null
    role?: string
    archivedAt?: string | null
    enrollments: Array<{
        class: { id: string; name: string; course: { code: string; name: string } }
    }>
}

type UserProfileCourse = {
    id: string
    code: string
    name: string
    sections: Array<{ id: string; name: string }>
}

type UserProfileExam = {
    id: string
    title: string
    status: 'DRAFT' | 'PUBLISHED'
    startAt: string | Date | null
    endAt: string | Date | null
    durationMinutes: number | null
    gradingConfig?: Record<string, unknown> | null
    course: { code: string; name: string }
    class?: { id: string; name: string } | null
    classIds?: string[]
    attempts?: Array<{ id: string; status: string }>
}

type UserProfileDetail = {
    user: { id: string; name: string | null; email: string | null; role: string }
    courses: UserProfileCourse[]
    exams: UserProfileExam[]
}

type SchoolAdminClientProps = {
    dictionary: Dictionary
    institution: InstitutionInfo | null
    teachers: PersonRow[]
    students: PersonRow[]
    courses: CourseRow[]
    sections: SectionRow[]
    exams: ExamRow[]
}

type AdminTab = 'overview' | 'teachers' | 'students' | 'courses' | 'sections' | 'exams' | 'configuration'
type PendingTabAction = {
    tab: AdminTab
    openAdd?: boolean
    focusId?: string
}

const isArchived = (value?: string | null) => Boolean(value)
const DEFAULT_SECTION_NAME = '__DEFAULT__'
const isDefaultSection = (section: SectionRow) => section.name === DEFAULT_SECTION_NAME
const normalizeValue = (value: string | null | undefined) => value?.toLowerCase().trim() ?? ''

const escapeCsvValue = (value: string) => {
    if (value.includes('"')) {
        value = value.replace(/""/g, '""')
    }
    if (/[",\r\n]/.test(value)) {
        return `"${value}"`
    }
    return value
}

const buildCsv = (rows: string[][]) =>
    rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n')

const splitLine = (line: string) =>
    line
        .split(/[\,\t;]/)
        .map((value) => value.trim())
        .filter(Boolean)

const isHeaderRow = (cells: string[]) => {
    const normalized = cells.map((cell) => cell.toLowerCase())
    return normalized.some((cell) =>
        ['email', 'e-mail', 'mail', 'nom', 'name', 'course', 'cours', 'code', 'section'].includes(cell)
    )
}

const parseLines = (raw: string) => {
    const lines = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    if (lines.length === 0) return []
    const rows = lines.map(splitLine).filter((row) => row.length > 0)
    if (rows.length === 0) return []
    if (isHeaderRow(rows[0])) {
        return rows.slice(1)
    }
    return rows
}

const listIds = {
    teachers: 'admin-teachers-list',
    students: 'admin-students-list',
    courses: 'admin-courses-list',
    sections: 'admin-sections-list',
    exams: 'admin-exams-list',
}

const focusList = (listId: string) => {
    if (typeof window === 'undefined') return
    window.requestAnimationFrame(() => {
        const target = document.getElementById(listId)
        if (!target) return
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        if (target instanceof HTMLElement) {
            target.focus({ preventScroll: true })
        }
    })
}

type StatCardLinkProps = {
    label: string
    value: string | number
    onClick: () => void
    ariaLabel?: string
}

const StatCardLink = ({ label, value, onClick, ariaLabel }: StatCardLinkProps) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? label}
        className="rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
    >
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-2xl font-semibold text-gray-900">{value}</div>
    </button>
)

type QuickActionCardProps = {
    label: string
    onClick: () => void
    ariaLabel?: string
}

const QuickActionCard = ({ label, onClick, ariaLabel }: QuickActionCardProps) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? label}
        className="flex flex-col items-start gap-2 rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
    >
        <span className="text-sm font-semibold text-gray-900">{label}</span>
    </button>
)

export default function SchoolAdminClient({
    dictionary,
    institution,
    teachers,
    students,
    courses,
    sections,
    exams,
}: SchoolAdminClientProps) {
    const dict = dictionary.admin.school
    const configDict = dictionary.admin.institutions
    const [activeTab, setActiveTab] = useState<AdminTab>('overview')
    const [showArchived, setShowArchived] = useState(false)
    const [actionError, setActionError] = useState('')

    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isImportOpen, setIsImportOpen] = useState(false)
    const [pendingTabAction, setPendingTabAction] = useState<PendingTabAction | null>(null)

    const navigateToTab = (tab: AdminTab, options?: Omit<PendingTabAction, 'tab'>) => {
        setPendingTabAction({ tab, ...options })
        setActiveTab(tab)
    }

    // Reset panels on tab change unless we explicitly open an action panel.
    useEffect(() => {
        if (!pendingTabAction || pendingTabAction.tab !== activeTab) {
            setIsAddOpen(false)
            setIsImportOpen(false)
            return
        }

        setIsAddOpen(Boolean(pendingTabAction.openAdd))
        setIsImportOpen(false)

        if (pendingTabAction.focusId) {
            const focusId = pendingTabAction.focusId
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    const target = document.getElementById(focusId)
                    if (!target) return
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    if (target instanceof HTMLElement) {
                        target.focus({ preventScroll: true })
                    }
                })
            })
        }

        setPendingTabAction(null)
    }, [activeTab, pendingTabAction])

    const [teachersList, setTeachersList] = useState<PersonRow[]>(teachers)
    const [studentsList, setStudentsList] = useState<PersonRow[]>(students)
    const [coursesList, setCoursesList] = useState<CourseRow[]>(courses)
    const [sectionsList, setSectionsList] = useState<SectionRow[]>(sections)
    const [examsList, setExamsList] = useState<ExamRow[]>(exams)

    const [teacherForm, setTeacherForm] = useState({ name: '', email: '', password: '' })
    const [studentForm, setStudentForm] = useState({ name: '', email: '', password: '' })
    const [courseForm, setCourseForm] = useState({ code: '', name: '' })
    const [sectionForm, setSectionForm] = useState({ courseId: '', name: '' })
    const [teacherBulkText, setTeacherBulkText] = useState('')
    const [studentBulkText, setStudentBulkText] = useState('')
    const [courseBulkText, setCourseBulkText] = useState('')
    const [sectionBulkText, setSectionBulkText] = useState('')
    const [teacherBulkPassword, setTeacherBulkPassword] = useState('')
    const [studentBulkPassword, setStudentBulkPassword] = useState('')
    const [teacherBulkResult, setTeacherBulkResult] = useState('')
    const [studentBulkResult, setStudentBulkResult] = useState('')
    const [courseBulkResult, setCourseBulkResult] = useState('')
    const [sectionBulkResult, setSectionBulkResult] = useState('')
    const [teacherBulkErrors, setTeacherBulkErrors] = useState<string[]>([])
    const [studentBulkErrors, setStudentBulkErrors] = useState<string[]>([])
    const [courseBulkErrors, setCourseBulkErrors] = useState<string[]>([])
    const [sectionBulkErrors, setSectionBulkErrors] = useState<string[]>([])
    const [teacherBulkPreview, setTeacherBulkPreview] = useState<Array<{ name?: string; email: string }>>([])
    const [studentBulkPreview, setStudentBulkPreview] = useState<Array<{ name?: string; email: string }>>([])
    const [courseBulkPreview, setCourseBulkPreview] = useState<Array<{ code: string; name: string }>>([])
    const [sectionBulkPreview, setSectionBulkPreview] = useState<Array<{ courseCode: string; name: string }>>([])
    const [showAllTeacherPreview, setShowAllTeacherPreview] = useState(false)
    const [showAllStudentPreview, setShowAllStudentPreview] = useState(false)
    const [showAllCoursePreview, setShowAllCoursePreview] = useState(false)
    const [showAllSectionPreview, setShowAllSectionPreview] = useState(false)
    const [assignmentForm, setAssignmentForm] = useState({
        role: 'STUDENT',
        userId: '',
        courseId: '',
        sectionId: '',
    })
    const [assignmentBulkText, setAssignmentBulkText] = useState('')
    const [assignmentBulkResult, setAssignmentBulkResult] = useState('')
    const [assignmentBulkErrors, setAssignmentBulkErrors] = useState<string[]>([])
    const [assignmentBulkPreview, setAssignmentBulkPreview] = useState<Array<{ email: string }>>([])
    const [showAllAssignmentPreview, setShowAllAssignmentPreview] = useState(false)
    const [assignmentBulkCourseId, setAssignmentBulkCourseId] = useState('')
    const [assignmentBulkSectionId, setAssignmentBulkSectionId] = useState('')
    const [configForm, setConfigForm] = useState({
        name: '',
        domains: '',
        ssoType: 'none',
        issuer: '',
        clientId: '',
        clientSecret: '',
        roleClaim: '',
        roleMapping: '',
        defaultRole: 'STUDENT',
        enabled: true,
    })
    const [configError, setConfigError] = useState('')
    const [configSaving, setConfigSaving] = useState(false)
    const [pendingArchiveTeacherId, setPendingArchiveTeacherId] = useState('')
    const [pendingArchiveStudentId, setPendingArchiveStudentId] = useState('')
    const [pendingArchiveCourseId, setPendingArchiveCourseId] = useState('')
    const [pendingArchiveSectionId, setPendingArchiveSectionId] = useState('')
    const [pendingArchiveExamId, setPendingArchiveExamId] = useState('')
    const [pendingRemoveEnrollmentId, setPendingRemoveEnrollmentId] = useState('')
    const [activeCourseAssignId, setActiveCourseAssignId] = useState('')
    const [activeSectionAssignId, setActiveSectionAssignId] = useState('')
    const [activeProfileId, setActiveProfileId] = useState('')
    const [profileDetails, setProfileDetails] = useState<Record<string, UserProfileDetail | null>>({})
    const [profileLoadingId, setProfileLoadingId] = useState('')
    const [profileErrorId, setProfileErrorId] = useState('')
    const [activeCourseDetailId, setActiveCourseDetailId] = useState('')
    const [activeSectionDetailId, setActiveSectionDetailId] = useState('')
    const [teacherSearch, setTeacherSearch] = useState('')
    const [studentSearch, setStudentSearch] = useState('')
    const [courseSearch, setCourseSearch] = useState('')
    const [sectionSearch, setSectionSearch] = useState('')
    const [examSearch, setExamSearch] = useState('')

    const ssoEnabled = useMemo(() => {
        const ssoConfig = institution?.ssoConfig as { enabled?: boolean } | null
        return ssoConfig?.enabled !== false
    }, [institution])

    useEffect(() => {
        if (!institution) {
            return
        }
        const ssoConfig = (institution.ssoConfig ?? {}) as Record<string, any>
        const domains = institution.domains?.map((entry) => entry.domain).join(', ') ?? ''
        setConfigForm({
            name: institution.name ?? '',
            domains,
            ssoType: ssoConfig.type ?? 'none',
            issuer: ssoConfig.issuer ?? '',
            clientId: ssoConfig.clientId ?? '',
            clientSecret: ssoConfig.clientSecret ?? '',
            roleClaim: ssoConfig.roleClaim ?? '',
            roleMapping: ssoConfig.roleMapping ? JSON.stringify(ssoConfig.roleMapping, null, 2) : '',
            defaultRole: ssoConfig.defaultRole ?? 'STUDENT',
            enabled: ssoConfig.enabled !== false,
        })
    }, [institution])

    const domainLabel = useMemo(() => {
        const domains = institution?.domains?.map((entry) => entry.domain).filter(Boolean) ?? []
        if (domains.length === 0) {
            return dict.noDomains
        }
        return domains.join(', ')
    }, [institution, dict.noDomains])

    const counts = useMemo(() => {
        return {
            teachers: teachersList.filter((teacher) => !isArchived(teacher.archivedAt)).length,
            students: studentsList.filter((student) => !isArchived(student.archivedAt)).length,
            courses: coursesList.filter((course) => !isArchived(course.archivedAt)).length,
            sections: sectionsList.filter(
                (section) => !isArchived(section.archivedAt) && !isDefaultSection(section)
            ).length,
            exams: examsList.filter((exam) => !isArchived(exam.archivedAt)).length,
        }
    }, [teachersList, studentsList, coursesList, sectionsList, examsList])

    const recentExams = useMemo(() => {
        return [...examsList]
            .filter((exam) => !isArchived(exam.archivedAt))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 3)
            .map((exam) => ({
                id: exam.id,
                title: exam.title || dict.unknownName,
                status: exam.status === 'DRAFT' ? dict.examStatusDraft : dict.examStatusPublished,
            }))
    }, [examsList, dict.examStatusDraft, dict.examStatusPublished, dict.unknownName])

    const recentArchives = useMemo(() => {
        const items: Array<{ id: string; type: string; label: string; archivedAt: string | Date }> = []

        coursesList.forEach((course) => {
            if (!course.archivedAt) return
            const label = course.code ? `${course.code} - ${course.name}` : course.name
            items.push({
                id: `course-${course.id}`,
                type: dict.stats.courses,
                label: label || dict.unknownName,
                archivedAt: course.archivedAt,
            })
        })

        sectionsList.forEach((section) => {
            if (!section.archivedAt || isDefaultSection(section)) return
            const label = `${section.course.code} - ${section.name}`
            items.push({
                id: `section-${section.id}`,
                type: dict.stats.sections,
                label,
                archivedAt: section.archivedAt,
            })
        })

        examsList.forEach((exam) => {
            if (!exam.archivedAt) return
            items.push({
                id: `exam-${exam.id}`,
                type: dict.stats.exams,
                label: exam.title || dict.unknownName,
                archivedAt: exam.archivedAt,
            })
        })

        return items
            .sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime())
            .slice(0, 3)
    }, [coursesList, sectionsList, examsList, dict.stats.courses, dict.stats.sections, dict.stats.exams, dict.unknownName])

    const recentImports: Array<{ id: string; label: string; createdAt: string | Date }> = []
    const hasRecentActivity =
        recentImports.length > 0 || recentArchives.length > 0 || recentExams.length > 0

    const visibleTeachers = useMemo(
        () => (showArchived ? teachersList : teachersList.filter((teacher) => !isArchived(teacher.archivedAt))),
        [showArchived, teachersList]
    )
    const visibleStudents = useMemo(
        () => (showArchived ? studentsList : studentsList.filter((student) => !isArchived(student.archivedAt))),
        [showArchived, studentsList]
    )
    const visibleCourses = useMemo(
        () => (showArchived ? coursesList : coursesList.filter((course) => !isArchived(course.archivedAt))),
        [showArchived, coursesList]
    )
    const visibleSections = useMemo(
        ( 
        ) =>
            (showArchived ? sectionsList : sectionsList.filter((section) => !isArchived(section.archivedAt))).filter(
                (section) => !isDefaultSection(section)
            ),
        [showArchived, sectionsList]
    )

    const ssoStatus = ssoEnabled ? dict.ssoEnabled : dict.ssoDisabled

    const canCreateTeacher =
        Boolean(teacherForm.name.trim()) &&
        Boolean(teacherForm.email.trim()) &&
        (ssoEnabled || Boolean(teacherForm.password.trim()))
    const canCreateStudent =
        Boolean(studentForm.name.trim()) &&
        Boolean(studentForm.email.trim()) &&
        (ssoEnabled || Boolean(studentForm.password.trim()))
    const canCreateCourse = Boolean(courseForm.code.trim()) && Boolean(courseForm.name.trim())
    const canCreateSection = Boolean(sectionForm.courseId) && Boolean(sectionForm.name.trim())
    const canAssignUser = Boolean(assignmentForm.userId) && Boolean(assignmentForm.courseId)

    const canPreviewTeachers =
        Boolean(teacherBulkText.trim()) && (ssoEnabled || Boolean(teacherBulkPassword.trim()))
    const canPreviewStudents =
        Boolean(studentBulkText.trim()) && (ssoEnabled || Boolean(studentBulkPassword.trim()))
    const canPreviewCourses = Boolean(courseBulkText.trim())
    const canPreviewSections = Boolean(sectionBulkText.trim())
    const canPreviewAssignment = Boolean(assignmentBulkText.trim()) && Boolean(assignmentBulkCourseId)

    const studentStatusDict = dictionary.student.coursesPage
    const getStudentExamStatus = (exam: UserProfileExam) => {
        if (!exam.startAt) {
            return studentStatusDict.statusUpcoming
        }
        const attempt = exam.attempts?.[0]
        const now = new Date()
        const startAt = new Date(exam.startAt)
        const endAt = getExamEndAt(startAt, exam.durationMinutes, exam.endAt ? new Date(exam.endAt) : null)
        const isSubmitted =
            attempt?.status === 'SUBMITTED' ||
            attempt?.status === 'GRADED' ||
            attempt?.status === 'GRADING_IN_PROGRESS'
        const isInProgressAttempt = attempt?.status === 'IN_PROGRESS'
        const isBeforeStart = now < startAt
        const isAfterEnd = endAt && now > endAt
        const isWithinWindow = !isBeforeStart && !isAfterEnd

        if (isBeforeStart) return studentStatusDict.statusUpcoming
        if (isSubmitted) return studentStatusDict.statusSubmitted
        if (isAfterEnd) return studentStatusDict.statusExpired
        if (isInProgressAttempt && isWithinWindow) return studentStatusDict.statusInProgress
        if (isWithinWindow) return studentStatusDict.statusAvailable
        return studentStatusDict.statusExpired
    }

    const getTeacherExamStatus = (exam: UserProfileExam) => {
        if (exam.status === 'DRAFT') {
            return dict.examStatusDraft
        }
        const computedEndAt = getExamEndAt(exam.startAt, exam.durationMinutes, exam.endAt)
        if (computedEndAt && computedEndAt < new Date()) {
            return dict.examStatusEnded
        }
        return dict.examStatusPublished
    }

    const formatExamDate = (value: string | Date | null) =>
        value ? new Date(value).toLocaleString() : dict.notScheduled
    const formatActivityDate = (value: string | Date | null | undefined) =>
        value ? new Date(value).toLocaleDateString() : ''

    const filteredTeachers = useMemo(() => {
        const query = normalizeValue(teacherSearch)
        if (!query) return teachersList
        return teachersList.filter((teacher) => {
            const name = normalizeValue(teacher.name)
            const email = normalizeValue(teacher.email)
            return name.includes(query) || email.includes(query)
        })
    }, [teacherSearch, teachersList])

    const filteredStudents = useMemo(() => {
        const query = normalizeValue(studentSearch)
        if (!query) return studentsList
        return studentsList.filter((student) => {
            const name = normalizeValue(student.name)
            const email = normalizeValue(student.email)
            return name.includes(query) || email.includes(query)
        })
    }, [studentSearch, studentsList])

    const filteredCourses = useMemo(() => {
        const query = normalizeValue(courseSearch)
        if (!query) return coursesList
        return coursesList.filter((course) => {
            const code = normalizeValue(course.code)
            const name = normalizeValue(course.name)
            return code.includes(query) || name.includes(query)
        })
    }, [courseSearch, coursesList])

    const filteredSections = useMemo(() => {
        const query = normalizeValue(sectionSearch)
        if (!query) return visibleSections
        return visibleSections.filter((section) => {
            const sectionName = normalizeValue(section.name)
            const courseCode = normalizeValue(section.course.code)
            const courseName = normalizeValue(section.course.name)
            return sectionName.includes(query) || courseCode.includes(query) || courseName.includes(query)
        })
    }, [sectionSearch, visibleSections])

    const filteredExams = useMemo(() => {
        const query = normalizeValue(examSearch)
        if (!query) return examsList
        return examsList.filter((exam) => {
            const title = normalizeValue(exam.title)
            const courseName = normalizeValue(exam.course.name)
            const courseCode = normalizeValue(exam.course.code)
            const sectionName = normalizeValue(exam.class?.name ?? '')
            return (
                title.includes(query) ||
                courseName.includes(query) ||
                courseCode.includes(query) ||
                sectionName.includes(query)
            )
        })
    }, [examSearch, examsList])

    const getCourseDetail = (courseId: string) => {
        const allSections = sectionsList.filter((section) => section.course.id === courseId)
        const sections = allSections.filter((section) => !isDefaultSection(section) && !isArchived(section.archivedAt))
        const exams = examsList.filter((exam) => {
            const examCourse = coursesList.find(
                (course) => course.code === exam.course.code && course.name === exam.course.name
            )
            return examCourse?.id === courseId
        })
        const teacherSet = new Map<string, string>()
        const studentSet = new Map<string, string>()
        allSections.forEach((section) => {
            section.enrollments.forEach((enrollment) => {
                const name = enrollment.user.name || enrollment.user.email || dict.unknownName
                if (enrollment.role === 'TEACHER') {
                    teacherSet.set(enrollment.user.id, name)
                } else if (enrollment.role === 'STUDENT') {
                    studentSet.set(enrollment.user.id, name)
                }
            })
        })
        return {
            sections,
            exams,
            teachers: Array.from(teacherSet.values()),
            students: Array.from(studentSet.values()),
        }
    }

    const downloadCsv = (filename: string, rows: string[][]) => {
        const csv = buildCsv(rows)
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
    }

    const getCourseSectionCount = (courseId: string) =>
        sectionsList.filter(
            (section) =>
                section.course.id === courseId &&
                !isDefaultSection(section) &&
                (showArchived || !isArchived(section.archivedAt))
        ).length

    const handleExportTeachers = () => {
        const rows = [
            ['Nom', 'Email'],
            ...visibleTeachers.map((teacher) => [teacher.name ?? '', teacher.email ?? '']),
        ]
        downloadCsv('professeurs.csv', rows)
    }

    const handleExportStudents = () => {
        const rows = [
            ['Nom', 'Email'],
            ...visibleStudents.map((student) => [student.name ?? '', student.email ?? '']),
        ]
        downloadCsv('etudiants.csv', rows)
    }

    const handleExportCourses = () => {
        const rows = [
            ['Code du cours', 'Nom du cours'],
            ...visibleCourses.map((course) => [course.code ?? '', course.name ?? '']),
        ]
        downloadCsv('cours.csv', rows)
    }

    const handleExportSections = () => {
        const rows = [
            ['Code du cours', 'Nom de section'],
            ...visibleSections.map((section) => [section.course?.code ?? '', section.name ?? '']),
        ]
        downloadCsv('sections.csv', rows)
    }

    const loadTeachers = async () => {
        const res = await fetch(`/api/admin/school/users?role=TEACHER&includeArchived=${showArchived}`)
        const data = await res.json()
        if (res.ok) {
            setTeachersList(data.users ?? [])
        } else {
            setActionError(dict.loadError)
        }
    }

    const loadStudents = async () => {
        const res = await fetch(`/api/admin/school/users?role=STUDENT&includeArchived=${showArchived}`)
        const data = await res.json()
        if (res.ok) {
            setStudentsList(data.users ?? [])
        } else {
            setActionError(dict.loadError)
        }
    }

    const loadCourses = async () => {
        const res = await fetch(`/api/admin/school/courses?includeArchived=${showArchived}`)
        const data = await res.json()
        if (res.ok) {
            setCoursesList(data.courses ?? [])
        } else {
            setActionError(dict.loadError)
        }
    }

    const loadSections = async () => {
        const res = await fetch(`/api/admin/school/sections?includeArchived=${showArchived}`)
        const data = await res.json()
        if (res.ok) {
            setSectionsList(data.sections ?? [])
        } else {
            setActionError(dict.loadError)
        }
    }

    const loadExams = async () => {
        const res = await fetch(`/api/admin/school/exams?includeArchived=${showArchived}`)
        const data = await res.json()
        if (res.ok) {
            setExamsList(data.exams ?? [])
        } else {
            setActionError(dict.loadError)
        }
    }

    const handleBulkFile = async (
        event: React.ChangeEvent<HTMLInputElement>,
        setter: (value: string) => void,
        resultSetter: (value: string) => void,
        errorSetter: (value: string[]) => void
    ) => {
        const file = event.target.files?.[0]
        if (!file) return
        const text = await file.text()
        setter(text)
        resultSetter('')
        errorSetter([])
        event.target.value = ''
    }

    const summarizeErrors = (errors: string[]) => {
        if (errors.length <= 5) return errors
        return [...errors.slice(0, 5), dict.bulk.moreErrors.replace('{{count}}', String(errors.length - 5))]
    }

    const formatBulkResult = (createdCount: number, skippedCount: number, errors: string[]) => {
        const parts = [
            `${dict.bulk.resultPrefix}: ${createdCount} ${dict.bulk.createdLabel}`,
        ]
        if (skippedCount > 0) {
            parts.push(`${skippedCount} ${dict.bulk.skippedLabel}`)
        }
        if (errors.length > 0) {
            parts.push(`${errors.length} ${dict.bulk.errorsLabel}`)
        }
        return parts.join(' · ')
    }

    const parseBulkUsers = (raw: string) => {
        const rows = parseLines(raw)
        const errors: string[] = []
        const seen = new Set<string>()
        const users = rows
            .map((row) => {
                if (row.length === 0) return null
                const email = row.length === 1 ? row[0] : row[1]
                const name = row.length === 1 ? '' : row[0]
                if (!email || !email.includes('@')) {
                    errors.push(email ? `${dict.bulk.invalidEmail}: ${email}` : dict.bulk.missingEmail)
                    return null
                }
                const key = email.toLowerCase()
                if (seen.has(key)) {
                    errors.push(`${dict.bulk.duplicateEntry}: ${email}`)
                    return null
                }
                seen.add(key)
                return { name: name || undefined, email }
            })
            .filter(Boolean) as Array<{ name?: string; email: string }>
        return { users, errors }
    }

    const parseBulkEmails = (raw: string) => {
        const rows = parseLines(raw)
        const errors: string[] = []
        const seen = new Set<string>()
        const emails = rows
            .map((row) => {
                const email = row[0] || ''
                if (!email || !email.includes('@')) {
                    errors.push(email ? `${dict.bulk.invalidEmail}: ${email}` : dict.bulk.missingEmail)
                    return null
                }
                const key = email.toLowerCase()
                if (seen.has(key)) {
                    errors.push(`${dict.bulk.duplicateEntry}: ${email}`)
                    return null
                }
                seen.add(key)
                return { email }
            })
            .filter(Boolean) as Array<{ email: string }>
        return { emails, errors }
    }

    const parseBulkCourses = (raw: string) => {
        const rows = parseLines(raw)
        const errors: string[] = []
        const seen = new Set<string>()
        const courses = rows
            .map((row) => {
                const code = row[0] || ''
                const name = row[1] || ''
                if (!code || !name) {
                    errors.push(dict.bulk.missingCourseFields)
                    return null
                }
                const key = code.toLowerCase()
                if (seen.has(key)) {
                    errors.push(`${dict.bulk.duplicateEntry}: ${code}`)
                    return null
                }
                seen.add(key)
                return { code, name }
            })
            .filter(Boolean) as Array<{ code: string; name: string }>
        return { courses, errors }
    }

    const parseBulkSections = (raw: string) => {
        const rows = parseLines(raw)
        const errors: string[] = []
        const seen = new Set<string>()
        const sections = rows
            .map((row) => {
                const courseCode = row[0] || ''
                const name = row[1] || ''
                if (!courseCode || !name) {
                    errors.push(dict.bulk.missingSectionFields)
                    return null
                }
                const key = `${courseCode.toLowerCase()}::${name.toLowerCase()}`
                if (seen.has(key)) {
                    errors.push(`${dict.bulk.duplicateEntry}: ${courseCode} - ${name}`)
                    return null
                }
                seen.add(key)
                return { courseCode, name }
            })
            .filter(Boolean) as Array<{ courseCode: string; name: string }>
        return { sections, errors }
    }

    useEffect(() => {
        setActionError('')
        // Auto-open logic based on list length
        // Note: We use the raw list length, not filtered, to decide if "database is empty" for this resource
        if (activeTab === 'teachers') {
            void loadTeachers().then(() => {
                // Done in state update side effect below
            })
        }
        if (activeTab === 'students') {
            void loadStudents()
        }
        if (activeTab === 'courses') {
            void loadCourses()
        }
        if (activeTab === 'sections') {
            void loadSections()
        }
        if (activeTab === 'exams') {
            void loadExams()
        }
    }, [activeTab, showArchived])

    // Effect to handle auto-open when lists are loaded and empty
    useEffect(() => {
        // Only auto-open if we are in the specific tab and the list is empty
        if (activeTab === 'teachers' && teachersList.length === 0) {
            setIsAddOpen(true)
            setIsImportOpen(false)
        }
        if (activeTab === 'students' && studentsList.length === 0) {
            setIsAddOpen(true)
            setIsImportOpen(false)
        }
        if (activeTab === 'courses' && coursesList.length === 0) {
            setIsAddOpen(true)
            setIsImportOpen(false)
        }
        if (activeTab === 'sections' && sectionsList.length === 0) {
            setIsAddOpen(true)
            setIsImportOpen(false)
        }
        if (activeTab === 'exams' && examsList.length === 0) {
            setIsAddOpen(true)
            setIsImportOpen(false)
        }
    }, [activeTab, teachersList.length, studentsList.length, coursesList.length, sectionsList.length, examsList.length])

    const handleCreateUser = async (role: 'TEACHER' | 'STUDENT') => {
        setActionError('')
        const form = role === 'TEACHER' ? teacherForm : studentForm
        const payload = {
            role,
            name: form.name || undefined,
            email: form.email,
            password: ssoEnabled ? '' : form.password,
        }
        const res = await fetch('/api/admin/school/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        if (!res.ok) {
            setActionError(dict.saveError)
            return
        }
        if (role === 'TEACHER') {
            setTeacherForm({ name: '', email: '', password: '' })
            await loadTeachers()
        } else {
            setStudentForm({ name: '', email: '', password: '' })
            await loadStudents()
        }
        setIsAddOpen(false)
        focusList(role === 'TEACHER' ? listIds.teachers : listIds.students)
    }

    const handleBulkPreviewUsers = (role: 'TEACHER' | 'STUDENT') => {
        setActionError('')
        const rawText = role === 'TEACHER' ? teacherBulkText : studentBulkText
        const { users, errors } = parseBulkUsers(rawText)

        if (users.length === 0) {
            setActionError(dict.bulk.emptyError)
            if (role === 'TEACHER') {
                setTeacherBulkResult('')
            } else {
                setStudentBulkResult('')
            }
            return
        }

        if (role === 'TEACHER') {
            setTeacherBulkPreview(users)
            setTeacherBulkErrors(errors)
            setTeacherBulkResult('')
            setShowAllTeacherPreview(false)
        } else {
            setStudentBulkPreview(users)
            setStudentBulkErrors(errors)
            setStudentBulkResult('')
            setShowAllStudentPreview(false)
        }
    }

    const handleBulkConfirmUsers = async (role: 'TEACHER' | 'STUDENT') => {
        setActionError('')
        const password = role === 'TEACHER' ? teacherBulkPassword : studentBulkPassword
        const preview = role === 'TEACHER' ? teacherBulkPreview : studentBulkPreview

        const sanitized = preview
            .map((entry) => ({
                name: entry.name?.trim() || undefined,
                email: entry.email.trim().toLowerCase(),
            }))
            .filter((entry) => entry.email && entry.email.includes('@'))

        if (sanitized.length === 0) {
            setActionError(dict.bulk.emptyError)
            return
        }

        const res = await fetch('/api/admin/school/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                role,
                users: sanitized,
                password: ssoEnabled ? '' : password,
            }),
        })

        const data = await res.json()
        if (!res.ok) {
            setActionError(dict.saveError)
            return
        }

        const combinedErrors = data.errors ?? []
        const resultMessage = formatBulkResult(data.createdCount ?? 0, data.skippedCount ?? 0, combinedErrors)

        if (role === 'TEACHER') {
            setTeacherBulkResult(resultMessage)
            setTeacherBulkErrors(combinedErrors)
            setTeacherBulkPreview([])
            setTeacherBulkText('')
            setTeacherBulkPassword('')
            await loadTeachers()
        } else {
            setStudentBulkResult(resultMessage)
            setStudentBulkErrors(combinedErrors)
            setStudentBulkPreview([])
            setStudentBulkText('')
            setStudentBulkPassword('')
            await loadStudents()
        }
        setIsImportOpen(false)
        focusList(role === 'TEACHER' ? listIds.teachers : listIds.students)
    }

    const handleBulkPreviewCourses = () => {
        setActionError('')
        const { courses, errors } = parseBulkCourses(courseBulkText)
        if (courses.length === 0) {
            setActionError(dict.bulk.emptyError)
            setCourseBulkResult('')
            return
        }
        setCourseBulkPreview(courses)
        setCourseBulkErrors(errors)
        setCourseBulkResult('')
        setShowAllCoursePreview(false)
    }

    const handleBulkConfirmCourses = async () => {
        setActionError('')
        const sanitized = courseBulkPreview
            .map((entry) => ({
                code: entry.code.trim(),
                name: entry.name.trim(),
            }))
            .filter((entry) => entry.code && entry.name)

        if (sanitized.length === 0) {
            setActionError(dict.bulk.emptyError)
            return
        }

        const res = await fetch('/api/admin/school/courses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courses: sanitized }),
        })
        const data = await res.json()
        if (!res.ok) {
            setActionError(dict.saveError)
            return
        }

        const combinedErrors = data.errors ?? []
        setCourseBulkResult(formatBulkResult(data.createdCount ?? 0, data.skippedCount ?? 0, combinedErrors))
        setCourseBulkErrors(combinedErrors)
        setCourseBulkPreview([])
        setCourseBulkText('')
        await loadCourses()
        setIsImportOpen(false)
        focusList(listIds.courses)
    }

    const handleBulkPreviewSections = () => {
        setActionError('')
        const { sections, errors } = parseBulkSections(sectionBulkText)
        if (sections.length === 0) {
            setActionError(dict.bulk.emptyError)
            setSectionBulkResult('')
            return
        }
        setSectionBulkPreview(sections)
        setSectionBulkErrors(errors)
        setSectionBulkResult('')
        setShowAllSectionPreview(false)
    }

    const handleBulkConfirmSections = async () => {
        setActionError('')
        const sanitized = sectionBulkPreview
            .map((entry) => ({
                courseCode: entry.courseCode.trim(),
                name: entry.name.trim(),
            }))
            .filter((entry) => entry.courseCode && entry.name)

        if (sanitized.length === 0) {
            setActionError(dict.bulk.emptyError)
            return
        }

        const res = await fetch('/api/admin/school/sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sections: sanitized }),
        })
        const data = await res.json()
        if (!res.ok) {
            setActionError(dict.saveError)
            return
        }

        const combinedErrors = data.errors ?? []
        setSectionBulkResult(formatBulkResult(data.createdCount ?? 0, data.skippedCount ?? 0, combinedErrors))
        setSectionBulkErrors(combinedErrors)
        setSectionBulkPreview([])
        setSectionBulkText('')
        await loadSections()
        setIsImportOpen(false)
        focusList(listIds.sections)
    }

    const handleBulkPreviewAssignments = () => {
        setActionError('')
        setAssignmentBulkResult('')
        if (!assignmentBulkCourseId) {
            setActionError(dict.assignCourseRequired)
            return
        }
        const { emails, errors } = parseBulkEmails(assignmentBulkText)
        if (emails.length === 0) {
            setActionError(dict.bulk.emptyError)
            setAssignmentBulkResult('')
            return
        }
        setAssignmentBulkErrors(errors)
        setAssignmentBulkPreview(emails)
        setShowAllAssignmentPreview(false)
    }

    const handleBulkConfirmAssignments = async () => {
        setActionError('')
        if (!assignmentBulkCourseId) {
            setActionError(dict.assignCourseRequired)
            return
        }
        const emails = assignmentBulkPreview
            .map((entry) => entry.email.trim())
            .filter((email) => Boolean(email))
        if (emails.length === 0) {
            setActionError(dict.bulk.emptyError)
            setAssignmentBulkResult('')
            return
        }
        const res = await fetch('/api/admin/school/enrollments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                role: assignmentForm.role,
                courseId: assignmentBulkCourseId,
                classId: assignmentBulkSectionId || undefined,
                emails,
            }),
        })
        const data = await res.json()
        if (!res.ok) {
            setActionError(dict.saveError)
            setAssignmentBulkResult('')
            return
        }
        const combinedErrors = [...assignmentBulkErrors, ...(data.errors ?? [])]
        setAssignmentBulkResult(formatBulkResult(data.createdCount ?? 0, data.skippedCount ?? 0, combinedErrors))
        setAssignmentBulkErrors(combinedErrors)
        setAssignmentBulkPreview([])
        setAssignmentBulkText('')
        await Promise.all([loadSections(), loadCourses()])
        setIsImportOpen(false)
        focusList(listIds.sections)
    }

    const handleAssignmentBulkCourseChange = (courseId: string) => {
        setAssignmentBulkCourseId(courseId)
        setAssignmentBulkSectionId('')
        setAssignmentBulkPreview([])
        setAssignmentBulkErrors([])
        setAssignmentBulkResult('')
    }

    const handleConfigChange = (field: keyof typeof configForm, value: string | boolean) => {
        setConfigForm((prev) => ({ ...prev, [field]: value }))
    }

    const handleConfigSave = async () => {
        if (!institution?.id) {
            return
        }
        setConfigSaving(true)
        setConfigError('')

        let roleMapping: Record<string, string> | undefined
        if (configForm.roleMapping.trim()) {
            try {
                roleMapping = JSON.parse(configForm.roleMapping)
            } catch {
                setConfigError(configDict.invalidMapping)
                setConfigSaving(false)
                return
            }
        }

        const domains = configForm.domains
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)

        const payload: Record<string, any> = {
            name: configForm.name,
            domains,
            ssoConfig: null,
        }

        if (configForm.ssoType !== 'none') {
            payload.ssoConfig = {
                type: configForm.ssoType,
                issuer: configForm.issuer || undefined,
                clientId: configForm.clientId || undefined,
                clientSecret: configForm.clientSecret || undefined,
                roleClaim: configForm.roleClaim || undefined,
                roleMapping: roleMapping ?? undefined,
                defaultRole: configForm.defaultRole || undefined,
                enabled: configForm.enabled,
            }
        }

        try {
            const res = await fetch(`/api/institutions/${institution.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok) {
                throw new Error(data?.error || configDict.saveError)
            }
        } catch (error) {
            console.error('[SchoolAdminConfig] Save failed', error)
            setConfigError(configDict.saveError)
        } finally {
            setConfigSaving(false)
        }
    }

    const handleToggleProfile = async (userId: string) => {
        if (activeProfileId === userId) {
            setActiveProfileId('')
            return
        }
        setActiveProfileId(userId)
        if (profileDetails[userId]) {
            return
        }
        setProfileLoadingId(userId)
        setProfileErrorId('')
        try {
            const res = await fetch(`/api/admin/school/users/${userId}/detail?includeArchived=${showArchived}`)
            const data = await res.json()
            if (!res.ok) {
                throw new Error(data?.error || dict.loadError)
            }
            setProfileDetails((prev) => ({ ...prev, [userId]: data }))
        } catch (error) {
            console.error('[SchoolAdminProfile] Load failed', error)
            setProfileErrorId(userId)
        } finally {
            setProfileLoadingId('')
        }
    }

    const renderProfileDetail = (detail: UserProfileDetail | null, role: string, userId: string) => {
        if (profileLoadingId === userId) {
            return <div className="text-xs text-gray-500">{dict.profile.loading}</div>
        }
        if (profileErrorId === userId) {
            return <div className="text-xs text-red-600">{dict.profile.loadError}</div>
        }
        if (!detail) {
            return null
        }
        const isStudent = role === 'STUDENT'
        return (
            <div className="space-y-3">
                <div>
                    <div className="text-xs font-semibold text-gray-500">{dict.profile.coursesLabel}</div>
                    {detail.courses.length === 0 ? (
                        <div className="mt-1 text-xs text-gray-500">{dict.profile.emptyCourses}</div>
                    ) : (
                        detail.courses.map((course) => {
                            const visibleSections = course.sections.filter((section) => section.name !== DEFAULT_SECTION_NAME)
                            return (
                                <div key={course.id} className="mt-2 text-xs text-gray-700">
                                    <div className="font-semibold">{course.code} - {course.name}</div>
                                    <div className="text-gray-500">
                                        {dict.profile.sectionsLabel}:{' '}
                                        {visibleSections.length === 0
                                            ? dict.assignCourseOnlyLabel
                                            : visibleSections.map((section) => section.name).join(', ')}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
                <div>
                    <div className="text-xs font-semibold text-gray-500">{dict.profile.examsLabel}</div>
                    {detail.exams.length === 0 ? (
                        <div className="mt-1 text-xs text-gray-500">{dict.profile.emptyExams}</div>
                    ) : (
                        detail.exams.map((exam) => {
                            const statusLabel = isStudent ? getStudentExamStatus(exam) : getTeacherExamStatus(exam)
                            return (
                                <div key={exam.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-700">
                                    <div>
                                        <div className="font-semibold">{exam.title}</div>
                                        <div className="text-gray-500">
                                            {exam.course.code} - {exam.course.name}
                                            {exam.class?.name ? ` · ${exam.class.name}` : ''}
                                        </div>
                                        <div className="text-gray-500">
                                            {dict.profile.startLabel}: {formatExamDate(exam.startAt)}
                                        </div>
                                    </div>
                                    <div className="rounded-full border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700">
                                        {statusLabel}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        )
    }

    const handleArchiveUser = async (userId: string, archived: boolean, role: 'TEACHER' | 'STUDENT') => {
        setActionError('')
        const res = await fetch('/api/admin/school/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, archived }),
        })
        if (!res.ok) {
            setActionError(dict.saveError)
            return
        }
        if (role === 'TEACHER') {
            await loadTeachers()
        } else {
            await loadStudents()
        }
    }

    const handleCreateCourse = async () => {
        setActionError('')
        const res = await fetch('/api/admin/school/courses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(courseForm),
        })
        if (!res.ok) {
            setActionError(dict.saveError)
            return
        }
        setCourseForm({ code: '', name: '' })
        await loadCourses()
        setIsAddOpen(false)
        focusList(listIds.courses)
    }

    const handleArchiveCourse = async (courseId: string, archived: boolean) => {
        setActionError('')
        const res = await fetch('/api/admin/school/courses', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId, archived }),
        })
        if (!res.ok) {
            setActionError(dict.saveError)
            return
        }
        await Promise.all([loadCourses(), loadSections(), loadExams()])
    }

    const handleCreateSection = async () => {
        setActionError('')
        const res = await fetch('/api/admin/school/sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sectionForm),
        })
        if (!res.ok) {
            setActionError(dict.saveError)
            return
        }
        setSectionForm({ courseId: '', name: '' })
        await loadSections()
        setIsAddOpen(false)
        focusList(listIds.sections)
    }

    const handleArchiveSection = async (sectionId: string, archived: boolean) => {
        setActionError('')
        const res = await fetch('/api/admin/school/sections', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sectionId, archived }),
        })
        if (!res.ok) {
            setActionError(dict.saveError)
            return
        }
        await Promise.all([loadSections(), loadExams()])
    }

    const handleCreateEnrollment = async () => {
        setActionError('')
        const payload = {
            role: assignmentForm.role,
            userId: assignmentForm.userId,
            courseId: assignmentForm.courseId,
            classId: assignmentForm.sectionId || undefined,
        }
        const res = await fetch('/api/admin/school/enrollments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        if (!res.ok) {
            setActionError(dict.saveError)
            return
        }
        setAssignmentForm({ role: assignmentForm.role, userId: '', courseId: '', sectionId: '' })
        await Promise.all([loadSections(), loadCourses()])
        setIsAddOpen(false) // If called from main panel
        focusList(listIds.sections)
    }

    const handleRemoveEnrollment = async (enrollmentId: string) => {
        setActionError('')
        const res = await fetch('/api/admin/school/enrollments', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enrollmentId }),
        })
        if (!res.ok) {
            setActionError(dict.saveError)
            return
        }
        await Promise.all([loadSections(), loadCourses()])
    }

    const handleArchiveExam = async (examId: string, archived: boolean) => {
        setActionError('')
        const res = await fetch('/api/admin/school/exams', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ examId, archived }),
        })
        if (!res.ok) {
            setActionError(dict.saveError)
            return
        }
        await loadExams()
    }

    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-brand-900">
                            {dict.titlePrefix} {institution?.name ?? dict.unknownInstitution}
                        </h1>
                        <div className="text-sm text-gray-500">
                            {dict.domainsLabel}: {domainLabel}
                        </div>
                    </div>
                    <div className="text-xs text-gray-500">
                        {dict.ssoLabel}: {ssoStatus}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <StatCardLink
                        label={dict.stats.teachers}
                        value={counts.teachers}
                        onClick={() => navigateToTab('teachers')}
                        ariaLabel={dict.tabs.teachers}
                    />
                    <StatCardLink
                        label={dict.stats.students}
                        value={counts.students}
                        onClick={() => navigateToTab('students')}
                        ariaLabel={dict.tabs.students}
                    />
                    <StatCardLink
                        label={dict.stats.courses}
                        value={counts.courses}
                        onClick={() => navigateToTab('courses')}
                        ariaLabel={dict.tabs.courses}
                    />
                    <StatCardLink
                        label={dict.stats.sections}
                        value={counts.sections}
                        onClick={() => navigateToTab('sections')}
                        ariaLabel={dict.tabs.sections}
                    />
                    <StatCardLink
                        label={dict.stats.exams}
                        value={counts.exams}
                        onClick={() => navigateToTab('exams')}
                        ariaLabel={dict.tabs.exams}
                    />
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap gap-3">
                        {(['overview', 'teachers', 'students', 'courses', 'sections', 'exams', 'configuration'] as AdminTab[]).map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => navigateToTab(tab)}
                                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === tab
                                    ? 'border-brand-900 bg-brand-900 text-white'
                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
                            >
                                {dict.tabs[tab]}
                            </button>
                        ))}
                    </div>

                    {actionError && (
                        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {actionError}
                        </div>
                    )}

                    {activeTab === 'overview' && (
                        <div className="mt-6 space-y-6">
                            <div>
                                <div className="text-sm font-semibold text-gray-900">
                                    {dict.overview.shortcutsTitle}
                                </div>
                                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                                    <QuickActionCard
                                        label={dict.createTeacherTitle}
                                        onClick={() =>
                                            navigateToTab('teachers', {
                                                openAdd: true,
                                                focusId: 'admin-add-teacher-name',
                                            })
                                        }
                                    />
                                    <QuickActionCard
                                        label={dict.createStudentTitle}
                                        onClick={() =>
                                            navigateToTab('students', {
                                                openAdd: true,
                                                focusId: 'admin-add-student-name',
                                            })
                                        }
                                    />
                                    <QuickActionCard
                                        label={dict.createCourseTitle}
                                        onClick={() =>
                                            navigateToTab('courses', {
                                                openAdd: true,
                                                focusId: 'admin-add-course-code',
                                            })
                                        }
                                    />
                                    <QuickActionCard
                                        label={dict.createSectionTitle}
                                        onClick={() =>
                                            navigateToTab('sections', {
                                                openAdd: true,
                                                focusId: 'admin-add-section-name',
                                            })
                                        }
                                    />
                                    <QuickActionCard
                                        label={dict.createExamButton}
                                        onClick={() =>
                                            navigateToTab('exams', {
                                                openAdd: true,
                                                focusId: 'admin-create-exam-link',
                                            })
                                        }
                                    />
                                </div>
                            </div>

                            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                                <div className="text-sm font-semibold text-gray-900">
                                    {dict.overview.activityTitle}
                                </div>
                                {!hasRecentActivity ? (
                                    <div className="mt-3 text-sm text-gray-500">
                                        {dict.overview.activityEmpty}
                                    </div>
                                ) : (
                                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                                                {dict.overview.activityImportsLabel}
                                            </div>
                                            {recentImports.length === 0 ? (
                                                <div className="mt-2 text-sm text-gray-500">
                                                    {dict.overview.activityEmptyItem}
                                                </div>
                                            ) : (
                                                <ul className="mt-2 space-y-2 text-sm text-gray-700">
                                                    {recentImports.map((entry) => (
                                                        <li key={entry.id} className="flex items-center justify-between">
                                                            <span>{entry.label}</span>
                                                            <span className="text-xs text-gray-500">
                                                                {formatActivityDate(entry.createdAt)}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                                                {dict.overview.activityArchivesLabel}
                                            </div>
                                            {recentArchives.length === 0 ? (
                                                <div className="mt-2 text-sm text-gray-500">
                                                    {dict.overview.activityEmptyItem}
                                                </div>
                                            ) : (
                                                <ul className="mt-2 space-y-2 text-sm text-gray-700">
                                                    {recentArchives.map((entry) => (
                                                        <li key={entry.id} className="flex flex-col gap-1">
                                                            <span className="font-medium text-gray-900">
                                                                {entry.type}
                                                            </span>
                                                            <span>{entry.label}</span>
                                                            <span className="text-xs text-gray-500">
                                                                {formatActivityDate(entry.archivedAt)}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                                                {dict.overview.activityExamsLabel}
                                            </div>
                                            {recentExams.length === 0 ? (
                                                <div className="mt-2 text-sm text-gray-500">
                                                    {dict.overview.activityEmptyItem}
                                                </div>
                                            ) : (
                                                <ul className="mt-2 space-y-2 text-sm text-gray-700">
                                                    {recentExams.map((entry) => (
                                                        <li key={entry.id} className="flex flex-col gap-1">
                                                            <span className="font-medium text-gray-900">
                                                                {entry.title}
                                                            </span>
                                                            <span className="text-xs text-gray-500">{entry.status}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'configuration' && (
                        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <label className="flex flex-col gap-1 text-sm text-gray-700">
                                    <span className="font-medium">{configDict.nameLabel}</span>
                                    <input
                                        value={configForm.name}
                                        onChange={(event) => handleConfigChange('name', event.target.value)}
                                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                    />
                                </label>
                                <label className="flex flex-col gap-1 text-sm text-gray-700 md:col-span-2">
                                    <span className="font-medium">{configDict.domainsLabel}</span>
                                    <input
                                        value={configForm.domains}
                                        onChange={(event) => handleConfigChange('domains', event.target.value)}
                                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                    />
                                </label>
                            </div>

                            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                                <label className="flex flex-col gap-1 text-sm text-gray-700">
                                    <span className="font-medium">{configDict.ssoTypeLabel}</span>
                                    <select
                                        value={configForm.ssoType}
                                        onChange={(event) => handleConfigChange('ssoType', event.target.value)}
                                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                    >
                                        <option value="none">{configDict.ssoTypeNone}</option>
                                        <option value="oidc">{configDict.ssoTypeOidc}</option>
                                        <option value="saml">{configDict.ssoTypeSaml}</option>
                                    </select>
                                </label>
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={configForm.enabled}
                                        onChange={(event) => handleConfigChange('enabled', event.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                    />
                                    {configDict.enabledLabel}
                                </label>
                                <label className="flex flex-col gap-1 text-sm text-gray-700">
                                    <span className="font-medium">{configDict.issuerLabel}</span>
                                    <input
                                        value={configForm.issuer}
                                        onChange={(event) => handleConfigChange('issuer', event.target.value)}
                                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                    />
                                </label>
                                <label className="flex flex-col gap-1 text-sm text-gray-700">
                                    <span className="font-medium">{configDict.clientIdLabel}</span>
                                    <input
                                        value={configForm.clientId}
                                        onChange={(event) => handleConfigChange('clientId', event.target.value)}
                                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                    />
                                </label>
                                <label className="flex flex-col gap-1 text-sm text-gray-700">
                                    <span className="font-medium">{configDict.clientSecretLabel}</span>
                                    <input
                                        type="password"
                                        value={configForm.clientSecret}
                                        onChange={(event) => handleConfigChange('clientSecret', event.target.value)}
                                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                    />
                                </label>
                                <label className="flex flex-col gap-1 text-sm text-gray-700">
                                    <span className="font-medium">{configDict.roleClaimLabel}</span>
                                    <input
                                        value={configForm.roleClaim}
                                        onChange={(event) => handleConfigChange('roleClaim', event.target.value)}
                                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                    />
                                </label>
                                <label className="flex flex-col gap-1 text-sm text-gray-700">
                                    <span className="font-medium">{configDict.defaultRoleLabel}</span>
                                    <select
                                        value={configForm.defaultRole}
                                        onChange={(event) => handleConfigChange('defaultRole', event.target.value)}
                                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                    >
                                        <option value="STUDENT">STUDENT</option>
                                        <option value="TEACHER">TEACHER</option>
                                        <option value="SCHOOL_ADMIN">SCHOOL_ADMIN</option>
                                    </select>
                                </label>
                                <label className="flex flex-col gap-1 text-sm text-gray-700 md:col-span-2">
                                    <span className="font-medium">{configDict.roleMappingLabel}</span>
                                    <textarea
                                        value={configForm.roleMapping}
                                        onChange={(event) => handleConfigChange('roleMapping', event.target.value)}
                                        rows={6}
                                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                    />
                                </label>
                            </div>

                            {configError && (
                                <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {configError}
                                </div>
                            )}

                            <div className="mt-6 flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleConfigSave}
                                    disabled={configSaving}
                                    className="inline-flex items-center rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {configDict.updateButton}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'teachers' && (
                        <AdminResourcePage
                            header={
                                <AdminResourceHeader
                                    title={dict.tabs.teachers}
                                    count={teachersList.length}
                                    searchValue={teacherSearch}
                                    onSearchChange={setTeacherSearch}
                                    showArchived={showArchived}
                                    onShowArchivedChange={setShowArchived}
                                    labels={{
                                        searchPlaceholder: dict.searchTeachersPlaceholder,
                                        showArchived: dict.showArchived,
                                        addButton: dict.createTeacherButton,
                                        importButton: dict.bulk.importButton,
                                        exportButton: dict.bulk.exportButton,
                                    }}
                                    onToggleAdd={() => setIsAddOpen((prev) => !prev)}
                                    onToggleImport={() => setIsImportOpen((prev) => !prev)}
                                    onExport={handleExportTeachers}
                                    isAddOpen={isAddOpen}
                                    isImportOpen={isImportOpen}
                                />
                            }
                            listId={listIds.teachers}
                            listContent={
                                teachersList.length === 0 ? (
                                    <div className="flex min-h-[160px] items-center justify-center text-sm text-gray-500">
                                        {dict.emptyTeachers}
                                    </div>
                                ) : filteredTeachers.length === 0 ? (
                                    <div className="flex min-h-[160px] items-center justify-center text-sm text-gray-500">
                                        {dict.searchNoResults}
                                    </div>
                                ) : (
                                    filteredTeachers.map((teacher) => (
                                        <div
                                            key={teacher.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => handleToggleProfile(teacher.id)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault()
                                                    handleToggleProfile(teacher.id)
                                                }
                                            }}
                                            className="cursor-pointer rounded-md border border-gray-200 p-4 transition hover:border-brand-200 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        {teacher.name || dict.unknownName}
                                                    </div>
                                                    <div className="text-xs text-gray-500">{teacher.email || dict.unknownEmail}</div>
                                                </div>
                                                {isArchived(teacher.archivedAt) ? (
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            handleArchiveUser(teacher.id, false, 'TEACHER')
                                                        }}
                                                        className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                    >
                                                        {dict.restoreLabel}
                                                    </button>
                                                ) : pendingArchiveTeacherId === teacher.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                handleArchiveUser(teacher.id, true, 'TEACHER')
                                                                setPendingArchiveTeacherId('')
                                                            }}
                                                            className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                        >
                                                            {dict.confirmArchiveButton}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                setPendingArchiveTeacherId('')
                                                            }}
                                                            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                        >
                                                            {dict.cancelArchiveButton}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            setPendingArchiveTeacherId(teacher.id)
                                                        }}
                                                        className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                    >
                                                        {dict.archiveLabel}
                                                    </button>
                                                )}
                                            </div>
                                            {teacher.enrollments.length > 0 && (
                                                <div className="mt-2 text-xs text-gray-600">
                                                    {teacher.enrollments
                                                        .map((enrollment) => `${enrollment.class.course.code} - ${enrollment.class.name}`)
                                                        .join(', ')}
                                                </div>
                                            )}
                                            {isArchived(teacher.archivedAt) && (
                                                <div className="mt-2 text-xs text-amber-600">{dict.archivedBadge}</div>
                                            )}
                                            {activeProfileId === teacher.id && (
                                                <div
                                                    className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4"
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    {renderProfileDetail(profileDetails[teacher.id] ?? null, 'TEACHER', teacher.id)}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )
                            }
                            panels={
                                <AdminActionPanels
                                    isAddOpen={isAddOpen}
                                    isImportOpen={isImportOpen}
                                    addPanelContent={
                                        <div className="grid gap-3 md:grid-cols-3">
                                            <input
                                                id="admin-add-teacher-name"
                                                value={teacherForm.name}
                                                onChange={(event) => setTeacherForm((prev) => ({ ...prev, name: event.target.value }))}
                                                placeholder={dict.namePlaceholder}
                                                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                            />
                                            <input
                                                value={teacherForm.email}
                                                onChange={(event) => setTeacherForm((prev) => ({ ...prev, email: event.target.value }))}
                                                placeholder={dict.emailPlaceholder}
                                                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                            />
                                            {!ssoEnabled && (
                                                <input
                                                    type="password"
                                                    value={teacherForm.password}
                                                    onChange={(event) => setTeacherForm((prev) => ({ ...prev, password: event.target.value }))}
                                                    placeholder={dict.passwordPlaceholder}
                                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                />
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleCreateUser('TEACHER')}
                                                disabled={!canCreateTeacher}
                                                className="mt-3 inline-flex items-center rounded-md bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300 md:col-span-3 md:mt-0 md:w-auto md:justify-self-start"
                                            >
                                                {dict.createTeacherButton}
                                            </button>
                                            {ssoEnabled && (
                                                <p className="mt-2 text-xs text-gray-500 md:col-span-3">{dict.ssoHint}</p>
                                            )}
                                        </div>
                                    }
                                    importPanelContent={
                                        <>
                                            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                                <div className="font-semibold uppercase tracking-[0.2em]">{dict.bulk.formatLabel}</div>
                                                <div className="mt-1 text-[11px] text-amber-800">{dict.bulk.teachersHint}</div>
                                                <div className="mt-1 font-mono text-[11px] text-amber-900">{dict.bulk.teachersExample}</div>
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <textarea
                                                    value={teacherBulkText}
                                                    onChange={(event) => {
                                                        setTeacherBulkText(event.target.value)
                                                        setTeacherBulkResult('')
                                                        setTeacherBulkErrors([])
                                                        setTeacherBulkPreview([])
                                                    }}
                                                    placeholder={dict.bulk.teachersPlaceholder}
                                                    className="h-28 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                />
                                                <div className="flex flex-col gap-3 md:border-l md:border-gray-200 md:pl-4">
                                                    <input
                                                        type="file"
                                                        accept=".csv,.tsv,.txt"
                                                        onChange={(event) => {
                                                            setTeacherBulkPreview([])
                                                            handleBulkFile(event, setTeacherBulkText, setTeacherBulkResult, setTeacherBulkErrors)
                                                        }}
                                                        className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
                                                    />
                                                    {!ssoEnabled && (
                                                        <input
                                                            type="password"
                                                            value={teacherBulkPassword}
                                                            onChange={(event) => setTeacherBulkPassword(event.target.value)}
                                                            placeholder={dict.passwordPlaceholder}
                                                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                        />
                                                    )}
                                                    {teacherBulkResult && (
                                                        <div className="text-xs text-gray-600">{teacherBulkResult}</div>
                                                    )}
                                                    {teacherBulkErrors.length > 0 && (
                                                        <div className="text-xs text-red-600">
                                                            {summarizeErrors(teacherBulkErrors).map((error, index) => (
                                                                <div key={`${error}-${index}`}>{error}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleBulkPreviewUsers('TEACHER')}
                                                disabled={!canPreviewTeachers}
                                                className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                            >
                                                {dict.bulk.importButton}
                                            </button>
                                            {teacherBulkPreview.length > 0 && (
                                                <div className="mt-4 rounded-md border border-gray-200 bg-white p-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="text-sm font-semibold text-gray-900">{dict.bulk.previewTitle}</div>
                                                        <div className="text-xs text-gray-500">
                                                            {dict.bulk.previewCount.replace('{{count}}', String(teacherBulkPreview.length))}
                                                        </div>
                                                    </div>
                                                    <p className="mt-1 text-xs text-gray-500">{dict.bulk.previewHint}</p>
                                                    <div className="mt-3 space-y-2">
                                                        {(showAllTeacherPreview ? teacherBulkPreview : teacherBulkPreview.slice(0, 5)).map((entry, index) => (
                                                            <div key={`${entry.email}-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr,1fr,auto]">
                                                                <input
                                                                    value={entry.name ?? ''}
                                                                    onChange={(event) => {
                                                                        const next = [...teacherBulkPreview]
                                                                        next[index] = { ...next[index], name: event.target.value }
                                                                        setTeacherBulkPreview(next)
                                                                    }}
                                                                    placeholder={dict.namePlaceholder}
                                                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                                />
                                                                <input
                                                                    value={entry.email}
                                                                    onChange={(event) => {
                                                                        const next = [...teacherBulkPreview]
                                                                        next[index] = { ...next[index], email: event.target.value }
                                                                        setTeacherBulkPreview(next)
                                                                    }}
                                                                    placeholder={dict.emailPlaceholder}
                                                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const next = teacherBulkPreview.filter((_, rowIndex) => rowIndex !== index)
                                                                        setTeacherBulkPreview(next)
                                                                    }}
                                                                    className="inline-flex items-center justify-center rounded-md border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                                >
                                                                    {dict.bulk.removeRow}
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {teacherBulkPreview.length > 5 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowAllTeacherPreview((prev) => !prev)}
                                                            className="mt-3 text-xs font-semibold text-brand-900 hover:text-brand-800"
                                                        >
                                                            {showAllTeacherPreview ? dict.bulk.showLess : dict.bulk.showAll}
                                                        </button>
                                                    )}
                                                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => setTeacherBulkPreview([])}
                                                            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                        >
                                                            {dict.bulk.cancelButton}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleBulkConfirmUsers('TEACHER')}
                                                            disabled={teacherBulkPreview.length === 0}
                                                            className="inline-flex items-center justify-center rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                                        >
                                                            {dict.bulk.confirmButton}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    }
                                />
                            }
                        />
                    )}
                    {activeTab === 'students' && (
                        <AdminResourcePage
                            header={
                                <AdminResourceHeader
                                    title={dict.tabs.students}
                                    count={studentsList.length}
                                    searchValue={studentSearch}
                                    onSearchChange={setStudentSearch}
                                    showArchived={showArchived}
                                    onShowArchivedChange={setShowArchived}
                                    labels={{
                                        searchPlaceholder: dict.searchStudentsPlaceholder,
                                        showArchived: dict.showArchived,
                                        addButton: dict.createStudentButton,
                                        importButton: dict.bulk.importButton,
                                        exportButton: dict.bulk.exportButton,
                                    }}
                                    onToggleAdd={() => setIsAddOpen((prev) => !prev)}
                                    onToggleImport={() => setIsImportOpen((prev) => !prev)}
                                    onExport={handleExportStudents}
                                    isAddOpen={isAddOpen}
                                    isImportOpen={isImportOpen}
                                />
                            }
                            listId={listIds.students}
                            listContent={
                                studentsList.length === 0 ? (
                                    <div className="flex min-h-[160px] items-center justify-center text-sm text-gray-500">
                                        {dict.emptyStudents}
                                    </div>
                                ) : filteredStudents.length === 0 ? (
                                    <div className="flex min-h-[160px] items-center justify-center text-sm text-gray-500">
                                        {dict.searchNoResults}
                                    </div>
                                ) : (
                                    filteredStudents.map((student) => (
                                        <div
                                            key={student.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => handleToggleProfile(student.id)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault()
                                                    handleToggleProfile(student.id)
                                                }
                                            }}
                                            className="cursor-pointer rounded-md border border-gray-200 p-4 transition hover:border-brand-200 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        {student.name || dict.unknownName}
                                                    </div>
                                                    <div className="text-xs text-gray-500">{student.email || dict.unknownEmail}</div>
                                                </div>
                                                {isArchived(student.archivedAt) ? (
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            handleArchiveUser(student.id, false, 'STUDENT')
                                                        }}
                                                        className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                    >
                                                        {dict.restoreLabel}
                                                    </button>
                                                ) : pendingArchiveStudentId === student.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                handleArchiveUser(student.id, true, 'STUDENT')
                                                                setPendingArchiveStudentId('')
                                                            }}
                                                            className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                        >
                                                            {dict.confirmArchiveButton}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                setPendingArchiveStudentId('')
                                                            }}
                                                            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                        >
                                                            {dict.cancelArchiveButton}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            setPendingArchiveStudentId(student.id)
                                                        }}
                                                        className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                    >
                                                        {dict.archiveLabel}
                                                    </button>
                                                )}
                                            </div>
                                            {student.enrollments.length > 0 && (
                                                <div className="mt-2 text-xs text-gray-600">
                                                    {student.enrollments
                                                        .map((enrollment) => `${enrollment.class.course.code} - ${enrollment.class.name}`)
                                                        .join(', ')}
                                                </div>
                                            )}
                                            {isArchived(student.archivedAt) && (
                                                <div className="mt-2 text-xs text-amber-600">{dict.archivedBadge}</div>
                                            )}
                                            {activeProfileId === student.id && (
                                                <div
                                                    className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4"
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    {renderProfileDetail(profileDetails[student.id] ?? null, 'STUDENT', student.id)}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )
                            }
                            panels={
                                <AdminActionPanels
                                    isAddOpen={isAddOpen}
                                    isImportOpen={isImportOpen}
                                    addPanelContent={
                                        <div className="grid gap-3 md:grid-cols-3">
                                            <input
                                                id="admin-add-student-name"
                                                value={studentForm.name}
                                                onChange={(event) => setStudentForm((prev) => ({ ...prev, name: event.target.value }))}
                                                placeholder={dict.namePlaceholder}
                                                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                            />
                                            <input
                                                value={studentForm.email}
                                                onChange={(event) => setStudentForm((prev) => ({ ...prev, email: event.target.value }))}
                                                placeholder={dict.emailPlaceholder}
                                                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                            />
                                            {!ssoEnabled && (
                                                <input
                                                    type="password"
                                                    value={studentForm.password}
                                                    onChange={(event) => setStudentForm((prev) => ({ ...prev, password: event.target.value }))}
                                                    placeholder={dict.passwordPlaceholder}
                                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                />
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleCreateUser('STUDENT')}
                                                disabled={!canCreateStudent}
                                                className="mt-3 inline-flex items-center rounded-md bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300 md:col-span-3 md:mt-0 md:w-auto md:justify-self-start"
                                            >
                                                {dict.createStudentButton}
                                            </button>
                                            {ssoEnabled && (
                                                <p className="mt-2 text-xs text-gray-500 md:col-span-3">{dict.ssoHint}</p>
                                            )}
                                        </div>
                                    }
                                    importPanelContent={
                                        <>
                                            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                                <div className="font-semibold uppercase tracking-[0.2em]">{dict.bulk.formatLabel}</div>
                                                <div className="mt-1 text-[11px] text-amber-800">{dict.bulk.studentsHint}</div>
                                                <div className="mt-1 font-mono text-[11px] text-amber-900">{dict.bulk.studentsExample}</div>
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <textarea
                                                    value={studentBulkText}
                                                    onChange={(event) => {
                                                        setStudentBulkText(event.target.value)
                                                        setStudentBulkResult('')
                                                        setStudentBulkErrors([])
                                                        setStudentBulkPreview([])
                                                    }}
                                                    placeholder={dict.bulk.studentsPlaceholder}
                                                    className="h-28 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                />
                                                <div className="flex flex-col gap-3 md:border-l md:border-gray-200 md:pl-4">
                                                    <input
                                                        type="file"
                                                        accept=".csv,.tsv,.txt"
                                                        onChange={(event) => {
                                                            setStudentBulkPreview([])
                                                            handleBulkFile(event, setStudentBulkText, setStudentBulkResult, setStudentBulkErrors)
                                                        }}
                                                        className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
                                                    />
                                                    {!ssoEnabled && (
                                                        <input
                                                            type="password"
                                                            value={studentBulkPassword}
                                                            onChange={(event) => setStudentBulkPassword(event.target.value)}
                                                            placeholder={dict.passwordPlaceholder}
                                                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                        />
                                                    )}
                                                    {studentBulkResult && (
                                                        <div className="text-xs text-gray-600">{studentBulkResult}</div>
                                                    )}
                                                    {studentBulkErrors.length > 0 && (
                                                        <div className="text-xs text-red-600">
                                                            {summarizeErrors(studentBulkErrors).map((error, index) => (
                                                                <div key={`${error}-${index}`}>{error}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleBulkPreviewUsers('STUDENT')}
                                                disabled={!canPreviewStudents}
                                                className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                            >
                                                {dict.bulk.importButton}
                                            </button>
                                            {studentBulkPreview.length > 0 && (
                                                <div className="mt-4 rounded-md border border-gray-200 bg-white p-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="text-sm font-semibold text-gray-900">{dict.bulk.previewTitle}</div>
                                                        <div className="text-xs text-gray-500">
                                                            {dict.bulk.previewCount.replace('{{count}}', String(studentBulkPreview.length))}
                                                        </div>
                                                    </div>
                                                    <p className="mt-1 text-xs text-gray-500">{dict.bulk.previewHint}</p>
                                                    <div className="mt-3 space-y-2">
                                                        {(showAllStudentPreview ? studentBulkPreview : studentBulkPreview.slice(0, 5)).map((entry, index) => (
                                                            <div key={`${entry.email}-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr,1fr,auto]">
                                                                <input
                                                                    value={entry.name ?? ''}
                                                                    onChange={(event) => {
                                                                        const next = [...studentBulkPreview]
                                                                        next[index] = { ...next[index], name: event.target.value }
                                                                        setStudentBulkPreview(next)
                                                                    }}
                                                                    placeholder={dict.namePlaceholder}
                                                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                                />
                                                                <input
                                                                    value={entry.email}
                                                                    onChange={(event) => {
                                                                        const next = [...studentBulkPreview]
                                                                        next[index] = { ...next[index], email: event.target.value }
                                                                        setStudentBulkPreview(next)
                                                                    }}
                                                                    placeholder={dict.emailPlaceholder}
                                                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const next = studentBulkPreview.filter((_, rowIndex) => rowIndex !== index)
                                                                        setStudentBulkPreview(next)
                                                                    }}
                                                                    className="inline-flex items-center justify-center rounded-md border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                                >
                                                                    {dict.bulk.removeRow}
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {studentBulkPreview.length > 5 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowAllStudentPreview((prev) => !prev)}
                                                            className="mt-3 text-xs font-semibold text-brand-900 hover:text-brand-800"
                                                        >
                                                            {showAllStudentPreview ? dict.bulk.showLess : dict.bulk.showAll}
                                                        </button>
                                                    )}
                                                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => setStudentBulkPreview([])}
                                                            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                        >
                                                            {dict.bulk.cancelButton}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleBulkConfirmUsers('STUDENT')}
                                                            disabled={studentBulkPreview.length === 0}
                                                            className="inline-flex items-center justify-center rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                                        >
                                                            {dict.bulk.confirmButton}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    }
                                />
                            }
                        />
                    )}
                    {activeTab === 'courses' && (
                        <AdminResourcePage
                            header={
                                <AdminResourceHeader
                                title={dict.tabs.courses}
                                count={coursesList.length}
                                searchValue={courseSearch}
                                onSearchChange={setCourseSearch}
                                showArchived={showArchived}
                                onShowArchivedChange={setShowArchived}
                                labels={{
                                    searchPlaceholder: dict.searchCoursesPlaceholder,
                                    showArchived: dict.showArchived,
                                    addButton: dict.createCourseButton,
                                    importButton: dict.bulk.importButton,
                                    exportButton: dict.bulk.exportButton,
                                }}
                                onToggleAdd={() => setIsAddOpen((prev) => !prev)}
                                onToggleImport={() => setIsImportOpen((prev) => !prev)}
                                onExport={handleExportCourses}
                                isAddOpen={isAddOpen}
                                isImportOpen={isImportOpen}
                            />
                            }
                            listId={listIds.courses}
                            listContent={
                            coursesList.length === 0 ? (
                                <div className="flex min-h-[160px] items-center justify-center text-sm text-gray-500">{dict.emptyCourses}</div>
                            ) : filteredCourses.length === 0 ? (
                                <div className="flex min-h-[160px] items-center justify-center text-sm text-gray-500">{dict.searchNoResults}</div>
                            ) : (
                                filteredCourses.map((course) => {
                                    const detail = getCourseDetail(course.id)
                                    return (
                                        <div
                                            key={course.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() =>
                                                setActiveCourseDetailId((current) => (current === course.id ? '' : course.id))
                                            }
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault()
                                                    setActiveCourseDetailId((current) => (current === course.id ? '' : course.id))
                                                }
                                            }}
                                            className="cursor-pointer rounded-md border border-gray-200 p-4 transition hover:border-brand-200 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        {course.code} - {course.name}
                                                    </div>
                                                    <div className="mt-1 text-xs text-gray-500">
                                                        {dict.courseMeta.sectionsLabel}: {getCourseSectionCount(course.id)}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {dict.courseMeta.examsLabel}: {course._count.exams}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {!isArchived(course.archivedAt) && (
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                setActiveCourseAssignId((current) => (current === course.id ? '' : course.id))
                                                                setAssignmentForm((prev) => ({
                                                                    ...prev,
                                                                    courseId: course.id,
                                                                    sectionId: '',
                                                                    userId: '',
                                                                }))
                                                                setAssignmentBulkCourseId(course.id)
                                                                setAssignmentBulkSectionId('')
                                                                setAssignmentBulkPreview([])
                                                                setAssignmentBulkErrors([])
                                                                setAssignmentBulkResult('')
                                                                setAssignmentBulkText('')
                                                            }}
                                                            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                        >
                                                            {dict.assignButton}
                                                        </button>
                                                    )}
                                                    {isArchived(course.archivedAt) ? (
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                handleArchiveCourse(course.id, false)
                                                            }}
                                                            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                        >
                                                            {dict.restoreLabel}
                                                        </button>
                                                    ) : pendingArchiveCourseId === course.id ? (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation()
                                                                    handleArchiveCourse(course.id, true)
                                                                    setPendingArchiveCourseId('')
                                                                }}
                                                                className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                            >
                                                                {dict.confirmArchiveButton}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation()
                                                                    setPendingArchiveCourseId('')
                                                                }}
                                                                className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                            >
                                                                {dict.cancelArchiveButton}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                setPendingArchiveCourseId(course.id)
                                                            }}
                                                            className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                        >
                                                            {dict.archiveLabel}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {isArchived(course.archivedAt) && (
                                                <div className="mt-2 text-xs text-amber-600">{dict.archivedBadge}</div>
                                            )}
                                            {activeCourseDetailId === course.id && (
                                                <div
                                                    className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4"
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        {/* Details Logic */}
                                                        <div>
                                                            <div className="text-xs font-semibold text-gray-500">{dict.profile.sectionsLabel}</div>
                                                            {detail.sections.length === 0 ? (
                                                                <div className="mt-1 text-xs text-gray-500">{dict.assignCourseOnlyLabel}</div>
                                                            ) : (
                                                                detail.sections.map((section) => (
                                                                    <div key={section.id} className="mt-1 text-xs text-gray-700">
                                                                        {section.name}
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-semibold text-gray-500">{dict.profile.examsLabel}</div>
                                                            {detail.exams.length === 0 ? (
                                                                <div className="mt-1 text-xs text-gray-500">{dict.profile.emptyExams}</div>
                                                            ) : (
                                                                detail.exams.map((exam) => (
                                                                    <div key={exam.id} className="mt-1 text-xs text-gray-700">
                                                                        {exam.title} · {getTeacherExamStatus(exam)}
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                        {/* Teachers / Students */}
                                                        <div>
                                                            <div className="text-xs font-semibold text-gray-500">
                                                                {dict.profile.teachersLabel} ({detail.teachers.length})
                                                            </div>
                                                            {detail.teachers.length === 0 ? (
                                                                <div className="mt-1 text-xs text-gray-500">{dict.none}</div>
                                                            ) : (
                                                                detail.teachers.map((name) => (
                                                                    <div key={name} className="mt-1 text-xs text-gray-700">
                                                                        {name}
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-semibold text-gray-500">
                                                                {dict.profile.studentsLabel} ({detail.students.length})
                                                            </div>
                                                            {detail.students.length === 0 ? (
                                                                <div className="mt-1 text-xs text-gray-500">{dict.none}</div>
                                                            ) : (
                                                                detail.students.map((name) => (
                                                                    <div key={name} className="mt-1 text-xs text-gray-700">
                                                                        {name}
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {activeCourseAssignId === course.id && (
                                                <div className="mt-4 space-y-3 rounded-md border border-dashed border-gray-200 p-4">
                                                    <div className="text-sm font-semibold text-gray-900">{dict.assignCourseTitle}</div>
                                                    <div className="grid gap-3 md:grid-cols-3">
                                                        <select
                                                            value={assignmentForm.role}
                                                            onChange={(event) => {
                                                                setAssignmentForm((prev) => ({
                                                                    ...prev,
                                                                    role: event.target.value,
                                                                    userId: '',
                                                                }))
                                                                setAssignmentBulkPreview([])
                                                                setAssignmentBulkErrors([])
                                                                setAssignmentBulkResult('')
                                                            }}
                                                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                        >
                                                            <option value="STUDENT">{dict.assignStudentLabel}</option>
                                                            <option value="TEACHER">{dict.assignTeacherLabel}</option>
                                                        </select>
                                                        <select
                                                            value={assignmentForm.userId}
                                                            onChange={(event) =>
                                                                setAssignmentForm((prev) => ({ ...prev, userId: event.target.value }))
                                                            }
                                                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                        >
                                                            <option value="">{dict.selectUserPlaceholder}</option>
                                                            {(assignmentForm.role === 'TEACHER' ? teachersList : studentsList)
                                                                .filter((user) => !isArchived(user.archivedAt))
                                                                .map((user) => (
                                                                    <option key={user.id} value={user.id}>
                                                                        {user.name || user.email}
                                                                    </option>
                                                                ))}
                                                        </select>
                                                        <button
                                                            type="button"
                                                            onClick={handleCreateEnrollment}
                                                            disabled={!canAssignUser}
                                                            className="inline-flex items-center justify-center rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                                        >
                                                            {dict.assignButton}
                                                        </button>
                                                    </div>
                                                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                                        <div className="font-semibold uppercase tracking-[0.2em]">{dict.bulk.formatLabel}</div>
                                                        <div className="mt-1 text-[11px] text-amber-800">{dict.assignBulkHint}</div>
                                                        <div className="mt-1 font-mono text-[11px] text-amber-900">{dict.assignBulkExample}</div>
                                                        <div className="mt-1 text-[11px] text-amber-700">{dict.bulk.fileHint}</div>
                                                        <div className="mt-1 text-[11px] text-amber-700">{dict.bulk.sourceHint}</div>
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <div>
                                                            <select
                                                                value={assignmentBulkCourseId}
                                                                onChange={(event) => handleAssignmentBulkCourseChange(event.target.value)}
                                                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                            >
                                                                <option value="">{dict.assignBulkCoursePlaceholder}</option>
                                                                {coursesList
                                                                    .filter((course) => !isArchived(course.archivedAt))
                                                                    .map((course) => (
                                                                        <option key={course.id} value={course.id}>
                                                                            {course.code} - {course.name}
                                                                        </option>
                                                                    ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <select
                                                                value={assignmentBulkSectionId}
                                                                onChange={(event) => setAssignmentBulkSectionId(event.target.value)}
                                                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                                disabled={!assignmentBulkCourseId}
                                                            >
                                                                <option value="">
                                                                    {assignmentBulkCourseId &&
                                                                    sectionsList.some(
                                                                        (entry) =>
                                                                            !isArchived(entry.archivedAt) &&
                                                                            !isDefaultSection(entry) &&
                                                                            entry.course.id === assignmentBulkCourseId
                                                                    )
                                                                        ? dict.assignBulkSectionOptional
                                                                        : dict.assignCourseOnlyLabel}
                                                                </option>
                                                                {sectionsList
                                                                    .filter(
                                                                        (entry) =>
                                                                            !isArchived(entry.archivedAt) &&
                                                                            !isDefaultSection(entry) &&
                                                                            entry.course.id === assignmentBulkCourseId
                                                                    )
                                                                    .map((entry) => (
                                                                        <option key={entry.id} value={entry.id}>
                                                                            {entry.course.code} - {entry.name}
                                                                        </option>
                                                                    ))}
                                                            </select>
                                                            <div className="mt-1 text-[11px] text-gray-500">{dict.assignOptionalLabel}</div>
                                                        </div>
                                                        <textarea
                                                            value={assignmentBulkText}
                                                            onChange={(event) => {
                                                                setAssignmentBulkText(event.target.value)
                                                                setAssignmentBulkResult('')
                                                                setAssignmentBulkErrors([])
                                                                setAssignmentBulkPreview([])
                                                            }}
                                                            placeholder={dict.assignBulkPlaceholder}
                                                            className="h-24 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                        />
                                                        <div className="flex flex-col gap-3 md:border-l md:border-gray-200 md:pl-4">
                                                            <input
                                                                type="file"
                                                                accept=".csv,.tsv,.txt"
                                                                onChange={(event) => {
                                                                    setAssignmentBulkPreview([])
                                                                    handleBulkFile(event, setAssignmentBulkText, setAssignmentBulkResult, setAssignmentBulkErrors)
                                                                }}
                                                                className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
                                                            />
                                                            {assignmentBulkResult && (
                                                                <div className="text-xs text-gray-600">{assignmentBulkResult}</div>
                                                            )}
                                                            {assignmentBulkErrors.length > 0 && (
                                                                <div className="text-xs text-red-600">
                                                                    {summarizeErrors(assignmentBulkErrors).map((error, index) => (
                                                                        <div key={`${error}-${index}`}>{error}</div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleBulkPreviewAssignments}
                                                        disabled={!canPreviewAssignment}
                                                        className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                                    >
                                                        {dict.assignBulkButton}
                                                    </button>
                                                    {/* Preview Assignments */}
                                                    {assignmentBulkPreview.length > 0 && (
                                                        <div className="mt-3 rounded-md border border-gray-200 bg-white p-4">
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <div className="text-sm font-semibold text-gray-900">{dict.bulk.previewTitle}</div>
                                                                <div className="text-xs text-gray-500">
                                                                    {dict.bulk.previewCount.replace(
                                                                        '{{count}}',
                                                                        String(assignmentBulkPreview.length)
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <p className="mt-1 text-xs text-gray-500">{dict.bulk.previewHint}</p>
                                                            <div className="mt-3 space-y-2">
                                                                {(showAllAssignmentPreview
                                                                    ? assignmentBulkPreview
                                                                    : assignmentBulkPreview.slice(0, 5)
                                                                ).map((entry, index) => (
                                                                    <div
                                                                        key={`${entry.email}-${index}`}
                                                                        className="grid grid-cols-1 gap-2 md:grid-cols-[1fr,auto]"
                                                                    >
                                                                        <input
                                                                            value={entry.email}
                                                                            onChange={(event) => {
                                                                                const next = [...assignmentBulkPreview]
                                                                                next[index] = { ...next[index], email: event.target.value }
                                                                                setAssignmentBulkPreview(next)
                                                                            }}
                                                                            placeholder={dict.emailPlaceholder}
                                                                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const next = assignmentBulkPreview.filter(
                                                                                    (_, rowIndex) => rowIndex !== index
                                                                                )
                                                                                setAssignmentBulkPreview(next)
                                                                            }}
                                                                            className="inline-flex items-center justify-center rounded-md border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                                        >
                                                                            {dict.bulk.removeRow}
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {assignmentBulkPreview.length > 5 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowAllAssignmentPreview((prev) => !prev)}
                                                                    className="mt-3 text-xs font-semibold text-brand-900 hover:text-brand-800"
                                                                >
                                                                    {showAllAssignmentPreview ? dict.bulk.showLess : dict.bulk.showAll}
                                                                </button>
                                                            )}
                                                            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setAssignmentBulkPreview([])}
                                                                    className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                                >
                                                                    {dict.bulk.cancelButton}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleBulkConfirmAssignments}
                                                                    disabled={assignmentBulkPreview.length === 0}
                                                                    className="inline-flex items-center justify-center rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                                                >
                                                                    {dict.bulk.confirmButton}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                            panels={
                                <AdminActionPanels
                                isAddOpen={isAddOpen}
                                isImportOpen={isImportOpen}
                                addPanelContent={
                                    <div className="space-y-6">
                                        <div className="grid gap-3 md:grid-cols-3">
                                            <input
                                                id="admin-add-course-code"
                                                value={courseForm.code}
                                                onChange={(event) => setCourseForm((prev) => ({ ...prev, code: event.target.value }))}
                                                placeholder={dict.courseCodePlaceholder}
                                                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                            />
                                            <input
                                                value={courseForm.name}
                                                onChange={(event) => setCourseForm((prev) => ({ ...prev, name: event.target.value }))}
                                                placeholder={dict.courseNamePlaceholder}
                                                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleCreateCourse}
                                                disabled={!canCreateCourse}
                                                className="mt-3 inline-flex items-center rounded-md bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300 md:mt-0"
                                            >
                                                {dict.createCourseButton}
                                            </button>
                                        </div>
                                        <div className="border-t border-gray-200 pt-6">
                                            <div className="text-sm font-semibold text-gray-900 mb-3">{dict.assignCourseTitle}</div>
                                            <div className="grid gap-3 md:grid-cols-4">
                                                <select
                                                    value={assignmentForm.role}
                                                    onChange={(event) => {
                                                        setAssignmentForm((prev) => ({ ...prev, role: event.target.value, userId: '' }))
                                                        setAssignmentBulkPreview([])
                                                        setAssignmentBulkErrors([])
                                                        setAssignmentBulkResult('')
                                                    }}
                                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                >
                                                    <option value="STUDENT">{dict.assignStudentLabel}</option>
                                                    <option value="TEACHER">{dict.assignTeacherLabel}</option>
                                                </select>
                                                <select
                                                    value={assignmentForm.userId}
                                                    onChange={(event) =>
                                                        setAssignmentForm((prev) => ({ ...prev, userId: event.target.value }))
                                                    }
                                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                >
                                                    <option value="">{dict.selectUserPlaceholder}</option>
                                                    {(assignmentForm.role === 'TEACHER' ? teachersList : studentsList)
                                                        .filter((user) => !isArchived(user.archivedAt))
                                                        .map((user) => (
                                                            <option key={user.id} value={user.id}>
                                                                {user.name || user.email}
                                                            </option>
                                                        ))}
                                                </select>
                                                <select
                                                    value={assignmentForm.courseId}
                                                    onChange={(event) =>
                                                        {
                                                            const nextCourseId = event.target.value
                                                            setAssignmentForm((prev) => ({
                                                                ...prev,
                                                                courseId: nextCourseId,
                                                                sectionId: '',
                                                            }))
                                                            setAssignmentBulkPreview([])
                                                            setAssignmentBulkErrors([])
                                                            setAssignmentBulkResult('')
                                                        }
                                                    }
                                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                >
                                                    <option value="">{dict.selectCoursePlaceholder}</option>
                                                    {coursesList.filter((course) => !isArchived(course.archivedAt)).map((course) => (
                                                        <option key={course.id} value={course.id}>
                                                            {course.code} - {course.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <select
                                                    value={assignmentForm.sectionId}
                                                    onChange={(event) =>
                                                        setAssignmentForm((prev) => ({ ...prev, sectionId: event.target.value }))
                                                    }
                                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                    disabled={!assignmentForm.courseId}
                                                >
                                                    <option value="">{dict.assignCourseOnlyLabel}</option>
                                                    {sectionsList
                                                        .filter(
                                                            (section) =>
                                                                !isArchived(section.archivedAt) &&
                                                                !isDefaultSection(section) &&
                                                                section.course.id === assignmentForm.courseId
                                                        )
                                                        .map((section) => (
                                                            <option key={section.id} value={section.id}>
                                                                {section.course.code} - {section.name}
                                                            </option>
                                                        ))}
                                                </select>
                                            </div>
                                            {assignmentForm.courseId &&
                                                sectionsList.filter(
                                                    (section) =>
                                                        !isArchived(section.archivedAt) &&
                                                        !isDefaultSection(section) &&
                                                        section.course.id === assignmentForm.courseId
                                                ).length === 0 && (
                                                    <p className="mt-2 text-xs text-gray-500">{dict.assignNoSectionsHint}</p>
                                                )}
                                            <button
                                                type="button"
                                                onClick={handleCreateEnrollment}
                                                disabled={!canAssignUser}
                                                className="mt-3 inline-flex items-center rounded-md bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                            >
                                                {dict.assignButton}
                                            </button>
                                        </div>
                                    </div>
                                }
                                importPanelContent={
                                    <div className="space-y-6">
                                        {/* Bulk Courses */}
                                        <div>
                                            <div className="text-sm font-semibold text-gray-900 mb-3">{dict.bulk.title}</div>
                                            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 mb-3">
                                                <div className="font-semibold uppercase tracking-[0.2em]">{dict.bulk.formatLabel}</div>
                                                <div className="mt-1 text-[11px] text-amber-800">{dict.bulk.coursesHint}</div>
                                                <div className="mt-1 font-mono text-[11px] text-amber-900">{dict.bulk.coursesExample}</div>
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <textarea
                                                    value={courseBulkText}
                                                    onChange={(event) => {
                                                        setCourseBulkText(event.target.value)
                                                        setCourseBulkResult('')
                                                        setCourseBulkErrors([])
                                                        setCourseBulkPreview([])
                                                    }}
                                                    placeholder={dict.bulk.coursesPlaceholder}
                                                    className="h-28 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                />
                                                <div className="flex flex-col gap-3 md:border-l md:border-gray-200 md:pl-4">
                                                    <input
                                                        type="file"
                                                        accept=".csv,.tsv,.txt"
                                                        onChange={(event) => {
                                                            setCourseBulkPreview([])
                                                            handleBulkFile(event, setCourseBulkText, setCourseBulkResult, setCourseBulkErrors)
                                                        }}
                                                        className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
                                                    />
                                                    {courseBulkResult && (
                                                        <div className="text-xs text-gray-600">{courseBulkResult}</div>
                                                    )}
                                                    {courseBulkErrors.length > 0 && (
                                                        <div className="text-xs text-red-600">
                                                            {summarizeErrors(courseBulkErrors).map((error, index) => (
                                                                <div key={`${error}-${index}`}>{error}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleBulkPreviewCourses}
                                                disabled={!canPreviewCourses}
                                                className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                            >
                                                {dict.bulk.importButton}
                                            </button>
                                            {/* Preview Courses Logic */}
                                            {courseBulkPreview.length > 0 && (
                                                <div className="mt-4 rounded-md border border-gray-200 bg-white p-4">
                                                    {/* ... Preview Logic Copy ... */}
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="text-sm font-semibold text-gray-900">{dict.bulk.previewTitle}</div>
                                                        <div className="text-xs text-gray-500">
                                                            {dict.bulk.previewCount.replace('{{count}}', String(courseBulkPreview.length))}
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 space-y-2">
                                                        {(showAllCoursePreview ? courseBulkPreview : courseBulkPreview.slice(0, 5)).map((entry, index) => (
                                                            <div key={`${entry.code}-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr,1fr,auto]">
                                                                <input
                                                                    value={entry.code}
                                                                    onChange={(event) => {
                                                                        const next = [...courseBulkPreview]
                                                                        next[index] = { ...next[index], code: event.target.value }
                                                                        setCourseBulkPreview(next)
                                                                    }}
                                                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                                />
                                                                <input
                                                                    value={entry.name}
                                                                    onChange={(event) => {
                                                                        const next = [...courseBulkPreview]
                                                                        next[index] = { ...next[index], name: event.target.value }
                                                                        setCourseBulkPreview(next)
                                                                    }}
                                                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const next = courseBulkPreview.filter((_, rowIndex) => rowIndex !== index)
                                                                        setCourseBulkPreview(next)
                                                                    }}
                                                                    className="inline-flex items-center justify-center rounded-md border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                                >
                                                                    {dict.bulk.removeRow}
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {/* ... Confirm buttons ... */}
                                                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => setCourseBulkPreview([])}
                                                            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                        >
                                                            {dict.bulk.cancelButton}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleBulkConfirmCourses}
                                                            disabled={courseBulkPreview.length === 0}
                                                            className="inline-flex items-center justify-center rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                                        >
                                                            {dict.bulk.confirmButton}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Bulk Assignments */}
                                        <div className="border-t border-gray-200 pt-6">
                                            <div className="text-sm font-semibold text-gray-900 mb-3">{dict.assignBulkTitle}</div>
                                            {/* ... Bulk Assign Logic ... */}
                                            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 mb-3">
                                                <div className="mt-1 text-[11px] text-amber-800">{dict.assignBulkHint}</div>
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-2 mb-3">
                                                <select
                                                    value={assignmentBulkCourseId}
                                                    onChange={(event) => handleAssignmentBulkCourseChange(event.target.value)}
                                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                >
                                                    <option value="">{dict.assignBulkCoursePlaceholder}</option>
                                                    {coursesList.filter((course) => !isArchived(course.archivedAt)).map((course) => (
                                                        <option key={course.id} value={course.id}>
                                                            {course.code} - {course.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <select
                                                    value={assignmentBulkSectionId}
                                                    onChange={(event) => setAssignmentBulkSectionId(event.target.value)}
                                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                    disabled={!assignmentBulkCourseId}
                                                >
                                                    <option value="">{dict.assignBulkSectionOptional}</option>
                                                    {sectionsList
                                                        .filter(
                                                            (entry) =>
                                                                !isArchived(entry.archivedAt) &&
                                                                !isDefaultSection(entry) &&
                                                                entry.course.id === assignmentBulkCourseId
                                                        )
                                                        .map((entry) => (
                                                            <option key={entry.id} value={entry.id}>
                                                                {entry.course.code} - {entry.name}
                                                            </option>
                                                        ))}
                                                </select>
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <textarea
                                                    value={assignmentBulkText}
                                                    onChange={(event) => setAssignmentBulkText(event.target.value)}
                                                    placeholder={dict.assignBulkPlaceholder}
                                                    className="h-28 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                />
                                                <div className="flex flex-col gap-3 md:border-l md:border-gray-200 md:pl-4">
                                                    <input
                                                        type="file"
                                                        accept=".csv,.tsv,.txt"
                                                        onChange={(event) => {
                                                            setAssignmentBulkPreview([])
                                                            handleBulkFile(event, setAssignmentBulkText, setAssignmentBulkResult, setAssignmentBulkErrors)
                                                        }}
                                                        className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
                                                    />
                                                    {assignmentBulkResult && (
                                                        <div className="text-xs text-gray-600">{assignmentBulkResult}</div>
                                                    )}
                                                    {assignmentBulkErrors.length > 0 && (
                                                        <div className="text-xs text-red-600">
                                                            {summarizeErrors(assignmentBulkErrors).map((error, index) => (
                                                                <div key={`${error}-${index}`}>{error}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleBulkPreviewAssignments}
                                                disabled={!canPreviewAssignment}
                                                className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                            >
                                                {dict.assignBulkButton}
                                            </button>
                                            {/* Preview Assignments */}
                                            {assignmentBulkPreview.length > 0 && (
                                                <div className="mt-3 rounded-md border border-gray-200 bg-white p-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="text-sm font-semibold text-gray-900">
                                                            {dict.bulk.previewTitle}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {dict.bulk.previewCount.replace(
                                                                '{{count}}',
                                                                String(assignmentBulkPreview.length)
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="mt-1 text-xs text-gray-500">{dict.bulk.previewHint}</p>
                                                    <div className="mt-3 space-y-2">
                                                        {(showAllAssignmentPreview
                                                            ? assignmentBulkPreview
                                                            : assignmentBulkPreview.slice(0, 5)
                                                        ).map(
                                                            (entry, index) => (
                                                                <div
                                                                    key={`${entry.email}-${index}`}
                                                                    className="grid grid-cols-1 gap-2 md:grid-cols-[1fr,auto]"
                                                                >
                                                                    <input
                                                                        value={entry.email}
                                                                        onChange={(event) => {
                                                                            const next = [...assignmentBulkPreview]
                                                                            next[index] = { ...next[index], email: event.target.value }
                                                                            setAssignmentBulkPreview(next)
                                                                        }}
                                                                        placeholder={dict.emailPlaceholder}
                                                                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const next = assignmentBulkPreview.filter((_, rowIndex) => rowIndex !== index)
                                                                            setAssignmentBulkPreview(next)
                                                                        }}
                                                                        className="inline-flex items-center justify-center rounded-md border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                                    >
                                                                        {dict.bulk.removeRow}
                                                                    </button>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => setAssignmentBulkPreview([])}
                                                            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                        >
                                                            {dict.bulk.cancelButton}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleBulkConfirmAssignments}
                                                            disabled={assignmentBulkPreview.length === 0}
                                                            className="inline-flex items-center justify-center rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                                        >
                                                            {dict.bulk.confirmButton}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                }
                            />
                            }
                        />
                    )}
                    {activeTab === 'sections' && (
                        <AdminResourcePage
                            header={
                                <AdminResourceHeader
                                title={dict.tabs.sections}
                                count={sectionsList.length}
                                searchValue={sectionSearch}
                                onSearchChange={setSectionSearch}
                                showArchived={showArchived}
                                onShowArchivedChange={setShowArchived}
                                labels={{
                                    searchPlaceholder: dict.searchSectionsPlaceholder,
                                    showArchived: dict.showArchived,
                                    addButton: dict.createSectionButton,
                                    importButton: dict.bulk.importButton,
                                    exportButton: dict.bulk.exportButton,
                                }}
                                onToggleAdd={() => setIsAddOpen((prev) => !prev)}
                                onToggleImport={() => setIsImportOpen((prev) => !prev)}
                                onExport={handleExportSections}
                                isAddOpen={isAddOpen}
                                isImportOpen={isImportOpen}
                            />
                            }
                            listId={listIds.sections}
                            listContent={
                                visibleSections.length === 0 ? (
                                <div className="flex min-h-[160px] items-center justify-center text-sm text-gray-500">{dict.emptySections}</div>
                            ) : filteredSections.length === 0 ? (
                                <div className="flex min-h-[160px] items-center justify-center text-sm text-gray-500">{dict.searchNoResults}</div>
                            ) : (
                                filteredSections.map((section) => {
                                    const teacherEnrollments = section.enrollments.filter((enrollment) => enrollment.role === 'TEACHER')
                                    const studentEnrollments = section.enrollments.filter((enrollment) => enrollment.role === 'STUDENT')
                                    const sectionExams = examsList.filter(
                                        (exam) =>
                                            exam.course.code === section.course.code &&
                                            exam.course.name === section.course.name &&
                                            exam.class?.name === section.name
                                    )
                                    return (
                                        <div
                                            key={section.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() =>
                                                setActiveSectionDetailId((current) => (current === section.id ? '' : section.id))
                                            }
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault()
                                                    setActiveSectionDetailId((current) => (current === section.id ? '' : section.id))
                                                }
                                            }}
                                            className="cursor-pointer rounded-md border border-gray-200 p-4 transition hover:border-brand-200 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        {section.course.code} - {section.name}
                                                    </div>
                                                    <div className="mt-1 text-xs text-gray-500">{section.course.name}</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {!isArchived(section.archivedAt) && (
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                setActiveSectionAssignId((current) => (current === section.id ? '' : section.id))
                                                                setAssignmentForm((prev) => ({
                                                                    ...prev,
                                                                    courseId: section.course.id,
                                                                    sectionId: section.id,
                                                                    userId: '',
                                                                }))
                                                                setAssignmentBulkCourseId(section.course.id)
                                                                setAssignmentBulkSectionId(section.id)
                                                                setAssignmentBulkPreview([])
                                                                setAssignmentBulkErrors([])
                                                                setAssignmentBulkResult('')
                                                                setAssignmentBulkText('')
                                                            }}
                                                            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                        >
                                                            {dict.assignSectionButton}
                                                        </button>
                                                    )}
                                                    {isArchived(section.archivedAt) ? (
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                handleArchiveSection(section.id, false)
                                                            }}
                                                            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                        >
                                                            {dict.restoreLabel}
                                                        </button>
                                                    ) : pendingArchiveSectionId === section.id ? (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation()
                                                                    handleArchiveSection(section.id, true)
                                                                    setPendingArchiveSectionId('')
                                                                }}
                                                                className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                            >
                                                                {dict.confirmArchiveButton}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation()
                                                                    setPendingArchiveSectionId('')
                                                                }}
                                                                className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                            >
                                                                {dict.cancelArchiveButton}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                setPendingArchiveSectionId(section.id)
                                                            }}
                                                            className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                        >
                                                            {dict.archiveLabel}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {activeSectionAssignId === section.id && (
                                                <div className="mt-4 space-y-3 rounded-md border border-dashed border-gray-200 p-4">
                                                    <div className="text-sm font-semibold text-gray-900">{dict.assignSectionTitle}</div>
                                                    <div className="grid gap-3 md:grid-cols-3">
                                                        <select
                                                            value={assignmentForm.role}
                                                            onChange={(event) => {
                                                                setAssignmentForm((prev) => ({
                                                                    ...prev,
                                                                    role: event.target.value,
                                                                    userId: '',
                                                                }))
                                                                setAssignmentBulkPreview([])
                                                                setAssignmentBulkErrors([])
                                                                setAssignmentBulkResult('')
                                                            }}
                                                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                        >
                                                            <option value="STUDENT">{dict.assignStudentLabel}</option>
                                                            <option value="TEACHER">{dict.assignTeacherLabel}</option>
                                                        </select>
                                                        <select
                                                            value={assignmentForm.userId}
                                                            onChange={(event) =>
                                                                setAssignmentForm((prev) => ({ ...prev, userId: event.target.value }))
                                                            }
                                                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                        >
                                                            <option value="">{dict.selectUserPlaceholder}</option>
                                                            {(assignmentForm.role === 'TEACHER' ? teachersList : studentsList)
                                                                .filter((user) => !isArchived(user.archivedAt))
                                                                .map((user) => (
                                                                    <option key={user.id} value={user.id}>
                                                                        {user.name || user.email}
                                                                    </option>
                                                                ))}
                                                        </select>
                                                        <button
                                                            type="button"
                                                            onClick={handleCreateEnrollment}
                                                            disabled={!canAssignUser}
                                                            className="inline-flex items-center justify-center rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                                        >
                                                            {dict.assignButton}
                                                        </button>
                                                    </div>
                                                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                                        <div className="font-semibold uppercase tracking-[0.2em]">{dict.bulk.formatLabel}</div>
                                                        <div className="mt-1 text-[11px] text-amber-800">{dict.assignBulkHint}</div>
                                                        <div className="mt-1 font-mono text-[11px] text-amber-900">{dict.assignBulkExample}</div>
                                                        <div className="mt-1 text-[11px] text-amber-700">{dict.bulk.fileHint}</div>
                                                        <div className="mt-1 text-[11px] text-amber-700">{dict.bulk.sourceHint}</div>
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <div>
                                                            <select
                                                                value={assignmentBulkCourseId}
                                                                onChange={(event) => handleAssignmentBulkCourseChange(event.target.value)}
                                                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                            >
                                                                <option value="">{dict.assignBulkCoursePlaceholder}</option>
                                                                {coursesList
                                                                    .filter((course) => !isArchived(course.archivedAt))
                                                                    .map((course) => (
                                                                        <option key={course.id} value={course.id}>
                                                                            {course.code} - {course.name}
                                                                        </option>
                                                                    ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <select
                                                                value={assignmentBulkSectionId}
                                                                onChange={(event) => setAssignmentBulkSectionId(event.target.value)}
                                                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                                disabled={!assignmentBulkCourseId}
                                                            >
                                                                <option value="">
                                                                    {assignmentBulkCourseId &&
                                                                    sectionsList.some(
                                                                        (entry) =>
                                                                            !isArchived(entry.archivedAt) &&
                                                                            !isDefaultSection(entry) &&
                                                                            entry.course.id === assignmentBulkCourseId
                                                                    )
                                                                        ? dict.assignBulkSectionOptional
                                                                        : dict.assignCourseOnlyLabel}
                                                                </option>
                                                                {sectionsList
                                                                    .filter(
                                                                        (entry) =>
                                                                            !isArchived(entry.archivedAt) &&
                                                                            !isDefaultSection(entry) &&
                                                                            entry.course.id === assignmentBulkCourseId
                                                                    )
                                                                    .map((entry) => (
                                                                        <option key={entry.id} value={entry.id}>
                                                                            {entry.course.code} - {entry.name}
                                                                        </option>
                                                                    ))}
                                                            </select>
                                                            <div className="mt-1 text-[11px] text-gray-500">{dict.assignOptionalLabel}</div>
                                                        </div>
                                                        <textarea
                                                            value={assignmentBulkText}
                                                            onChange={(event) => {
                                                                setAssignmentBulkText(event.target.value)
                                                                setAssignmentBulkResult('')
                                                                setAssignmentBulkErrors([])
                                                                setAssignmentBulkPreview([])
                                                            }}
                                                            placeholder={dict.assignBulkPlaceholder}
                                                            className="h-24 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                        />
                                                        <div className="flex flex-col gap-3 md:border-l md:border-gray-200 md:pl-4">
                                                            <input
                                                                type="file"
                                                                accept=".csv,.tsv,.txt"
                                                                onChange={(event) => {
                                                                    setAssignmentBulkPreview([])
                                                                    handleBulkFile(event, setAssignmentBulkText, setAssignmentBulkResult, setAssignmentBulkErrors)
                                                                }}
                                                                className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
                                                            />
                                                            {assignmentBulkResult && (
                                                                <div className="text-xs text-gray-600">{assignmentBulkResult}</div>
                                                            )}
                                                            {assignmentBulkErrors.length > 0 && (
                                                                <div className="text-xs text-red-600">
                                                                    {summarizeErrors(assignmentBulkErrors).map((error, index) => (
                                                                        <div key={`${error}-${index}`}>{error}</div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleBulkPreviewAssignments}
                                                        disabled={!canPreviewAssignment}
                                                        className="inline-flex w-full items-center justify-center rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                                    >
                                                        {dict.assignBulkButton}
                                                    </button>
                                                    {assignmentBulkPreview.length > 0 && (
                                                        <div className="mt-3 rounded-md border border-gray-200 bg-white p-4">
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <div className="text-sm font-semibold text-gray-900">
                                                                    {dict.bulk.previewTitle}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    {dict.bulk.previewCount.replace(
                                                                        '{{count}}',
                                                                        String(assignmentBulkPreview.length)
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <p className="mt-1 text-xs text-gray-500">{dict.bulk.previewHint}</p>
                                                            <div className="mt-3 space-y-2">
                                                                {(showAllAssignmentPreview
                                                                    ? assignmentBulkPreview
                                                                    : assignmentBulkPreview.slice(0, 5)
                                                                ).map(
                                                                    (entry, index) => (
                                                                        <div
                                                                            key={`${entry.email}-${index}`}
                                                                            className="grid grid-cols-1 gap-2 md:grid-cols-[1fr,auto]"
                                                                        >
                                                                            <input
                                                                                value={entry.email}
                                                                                onChange={(event) => {
                                                                                    const next = [...assignmentBulkPreview]
                                                                                    next[index] = { ...next[index], email: event.target.value }
                                                                                    setAssignmentBulkPreview(next)
                                                                                }}
                                                                                placeholder={dict.emailPlaceholder}
                                                                                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    const next = assignmentBulkPreview.filter((_, rowIndex) => rowIndex !== index)
                                                                                    setAssignmentBulkPreview(next)
                                                                                }}
                                                                                className="inline-flex items-center justify-center rounded-md border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                                            >
                                                                                {dict.bulk.removeRow}
                                                                            </button>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setAssignmentBulkPreview([])}
                                                                    className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                                >
                                                                    {dict.bulk.cancelButton}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleBulkConfirmAssignments}
                                                                    disabled={assignmentBulkPreview.length === 0}
                                                                    className="inline-flex items-center justify-center rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                                                >
                                                                    {dict.bulk.confirmButton}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {activeSectionDetailId === section.id && (
                                                <div
                                                    className="mt-3 grid gap-3 md:grid-cols-2"
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    <div>
                                                        <div className="text-xs font-semibold text-gray-500">{dict.sectionMeta.teachersLabel}</div>
                                                        {teacherEnrollments.length === 0 ? (
                                                            <div className="text-xs text-gray-500">{dict.none}</div>
                                                        ) : (
                                                            teacherEnrollments.map((enrollment) => (
                                                                <div key={enrollment.id} className="mt-1 flex items-center justify-between text-xs text-gray-700">
                                                                    <span>{enrollment.user.name || enrollment.user.email}</span>
                                                                    {pendingRemoveEnrollmentId === enrollment.id ? (
                                                                        <span className="flex items-center gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    handleRemoveEnrollment(enrollment.id)
                                                                                    setPendingRemoveEnrollmentId('')
                                                                                }}
                                                                                className="text-red-600 hover:text-red-700"
                                                                            >
                                                                                {dict.confirmArchiveButton}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setPendingRemoveEnrollmentId('')}
                                                                                className="text-gray-500 hover:text-gray-700"
                                                                            >
                                                                                {dict.cancelArchiveButton}
                                                                            </button>
                                                                        </span>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setPendingRemoveEnrollmentId(enrollment.id)}
                                                                            className="text-red-600 hover:text-red-700"
                                                                        >
                                                                            {dict.removeLabel}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-semibold text-gray-500">{dict.sectionMeta.studentsLabel}</div>
                                                        {studentEnrollments.length === 0 ? (
                                                            <div className="text-xs text-gray-500">{dict.none}</div>
                                                        ) : (
                                                            studentEnrollments.map((enrollment) => (
                                                                <div key={enrollment.id} className="mt-1 flex items-center justify-between text-xs text-gray-700">
                                                                    <span>{enrollment.user.name || enrollment.user.email}</span>
                                                                    {pendingRemoveEnrollmentId === enrollment.id ? (
                                                                        <span className="flex items-center gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    handleRemoveEnrollment(enrollment.id)
                                                                                    setPendingRemoveEnrollmentId('')
                                                                                }}
                                                                                className="text-red-600 hover:text-red-700"
                                                                            >
                                                                                {dict.confirmArchiveButton}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setPendingRemoveEnrollmentId('')}
                                                                                className="text-gray-500 hover:text-gray-700"
                                                                            >
                                                                                {dict.cancelArchiveButton}
                                                                            </button>
                                                                        </span>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setPendingRemoveEnrollmentId(enrollment.id)}
                                                                            className="text-red-600 hover:text-red-700"
                                                                        >
                                                                            {dict.removeLabel}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <div className="text-xs font-semibold text-gray-500">{dict.profile.examsLabel}</div>
                                                        {sectionExams.length === 0 ? (
                                                            <div className="mt-1 text-xs text-gray-500">{dict.profile.emptyExams}</div>
                                                        ) : (
                                                            sectionExams.map((exam) => (
                                                                <div key={exam.id} className="mt-1 text-xs text-gray-700">
                                                                    {exam.title} · {getTeacherExamStatus(exam)}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {isArchived(section.archivedAt) && (
                                                <div className="mt-2 text-xs text-amber-600">{dict.archivedBadge}</div>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                            panels={
                                <AdminActionPanels
                                isAddOpen={isAddOpen}
                                isImportOpen={isImportOpen}
                                addPanelContent={
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <select
                                            value={sectionForm.courseId}
                                            onChange={(event) => setSectionForm((prev) => ({ ...prev, courseId: event.target.value }))}
                                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        >
                                            <option value="">{dict.selectCoursePlaceholder}</option>
                                            {coursesList.filter((course) => !isArchived(course.archivedAt)).map((course) => (
                                                <option key={course.id} value={course.id}>
                                                    {course.code} - {course.name}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            id="admin-add-section-name"
                                            value={sectionForm.name}
                                            onChange={(event) => setSectionForm((prev) => ({ ...prev, name: event.target.value }))}
                                            placeholder={dict.sectionNamePlaceholder}
                                            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleCreateSection}
                                            disabled={!canCreateSection}
                                            className="mt-3 inline-flex items-center rounded-md bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300 md:mt-0"
                                        >
                                            {dict.createSectionButton}
                                        </button>
                                    </div>
                                }
                                importPanelContent={
                                    <>
                                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 mb-3">
                                            <div className="font-semibold uppercase tracking-[0.2em]">{dict.bulk.formatLabel}</div>
                                            <div className="mt-1 text-[11px] text-amber-800">{dict.bulk.sectionsHint}</div>
                                            <div className="mt-1 font-mono text-[11px] text-amber-900">{dict.bulk.sectionsExample}</div>
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <textarea
                                                value={sectionBulkText}
                                                onChange={(event) => {
                                                    setSectionBulkText(event.target.value)
                                                    setSectionBulkResult('')
                                                    setSectionBulkErrors([])
                                                    setSectionBulkPreview([])
                                                }}
                                                placeholder={dict.bulk.sectionsPlaceholder}
                                                className="h-28 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                            />
                                            <div className="flex flex-col gap-3 md:border-l md:border-gray-200 md:pl-4">
                                                <input
                                                    type="file"
                                                    accept=".csv,.tsv,.txt"
                                                    onChange={(event) => {
                                                        setSectionBulkPreview([])
                                                        handleBulkFile(event, setSectionBulkText, setSectionBulkResult, setSectionBulkErrors)
                                                    }}
                                                    className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
                                                />
                                                {sectionBulkResult && (
                                                    <div className="text-xs text-gray-600">{sectionBulkResult}</div>
                                                )}
                                                {sectionBulkErrors.length > 0 && (
                                                    <div className="text-xs text-red-600">
                                                        {summarizeErrors(sectionBulkErrors).map((error, index) => (
                                                            <div key={`${error}-${index}`}>{error}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleBulkPreviewSections}
                                            disabled={!canPreviewSections}
                                            className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                        >
                                            {dict.bulk.importButton}
                                        </button>
                                        {sectionBulkPreview.length > 0 && (
                                            <div className="mt-4 rounded-md border border-gray-200 bg-white p-4">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="text-sm font-semibold text-gray-900">{dict.bulk.previewTitle}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {dict.bulk.previewCount.replace('{{count}}', String(sectionBulkPreview.length))}
                                                    </div>
                                                </div>
                                                <p className="mt-1 text-xs text-gray-500">{dict.bulk.previewHint}</p>
                                                <div className="mt-3 space-y-2">
                                                    {(showAllSectionPreview ? sectionBulkPreview : sectionBulkPreview.slice(0, 5)).map((entry, index) => (
                                                        <div key={`${entry.courseCode}-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr,1fr,auto]">
                                                            <input
                                                                value={entry.courseCode}
                                                                onChange={(event) => {
                                                                    const next = [...sectionBulkPreview]
                                                                    next[index] = { ...next[index], courseCode: event.target.value }
                                                                    setSectionBulkPreview(next)
                                                                }}
                                                                placeholder={dict.courseCodePlaceholder}
                                                                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                            />
                                                            <input
                                                                value={entry.name}
                                                                onChange={(event) => {
                                                                    const next = [...sectionBulkPreview]
                                                                    next[index] = { ...next[index], name: event.target.value }
                                                                    setSectionBulkPreview(next)
                                                                }}
                                                                placeholder={dict.sectionNamePlaceholder}
                                                                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const next = sectionBulkPreview.filter((_, rowIndex) => rowIndex !== index)
                                                                    setSectionBulkPreview(next)
                                                                }}
                                                                className="inline-flex items-center justify-center rounded-md border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                            >
                                                                {dict.bulk.removeRow}
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                                {sectionBulkPreview.length > 5 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowAllSectionPreview((prev) => !prev)}
                                                        className="mt-3 text-xs font-semibold text-brand-900 hover:text-brand-800"
                                                    >
                                                        {showAllSectionPreview ? dict.bulk.showLess : dict.bulk.showAll}
                                                    </button>
                                                )}
                                                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSectionBulkPreview([])}
                                                        className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                    >
                                                        {dict.bulk.cancelButton}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleBulkConfirmSections}
                                                        disabled={sectionBulkPreview.length === 0}
                                                        className="inline-flex items-center justify-center rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                                    >
                                                        {dict.bulk.confirmButton}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                }
                            />
                            }
                        />
                    )}
                    {activeTab === 'exams' && (
                        <AdminResourcePage
                            header={
                                <AdminResourceHeader
                                    title={dict.tabs.exams}
                                    count={examsList.length}
                                    searchValue={examSearch}
                                    onSearchChange={setExamSearch}
                                    showArchived={showArchived}
                                    onShowArchivedChange={setShowArchived}
                                    labels={{
                                        searchPlaceholder: dict.searchExamsPlaceholder,
                                        showArchived: dict.showArchived,
                                        addButton: dict.createExamButton,
                                    }}
                                    onToggleAdd={() => setIsAddOpen((prev) => !prev)}
                                    isAddOpen={isAddOpen}
                                />
                            }
                            listId={listIds.exams}
                            listContent={
                                examsList.length === 0 ? (
                                    <div className="flex min-h-[160px] items-center justify-center text-sm text-gray-500">{dict.emptyExams}</div>
                                ) : filteredExams.length === 0 ? (
                                    <div className="flex min-h-[160px] items-center justify-center text-sm text-gray-500">{dict.searchNoResults}</div>
                                ) : (
                                    filteredExams.map((exam) => {
                                    const startAt = exam.startAt ? new Date(exam.startAt).toLocaleString() : dict.notScheduled
                                    const statusLabel = exam.status === 'DRAFT' ? dict.examStatusDraft : dict.examStatusPublished
                                    return (
                                        <div key={exam.id} className="rounded-md border border-gray-200 p-4 mb-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        {exam.title}
                                                    </div>
                                                    <div className="mt-1 text-xs text-gray-500">
                                                        {exam.course.code} - {exam.course.name}
                                                    </div>
                                                    {exam.class?.name && (
                                                        <div className="text-xs text-gray-500">
                                                            {dict.examMeta.sectionLabel}: {exam.class.name}
                                                        </div>
                                                    )}
                                                </div>
                                                {isArchived(exam.archivedAt) ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleArchiveExam(exam.id, false)}
                                                        className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                    >
                                                        {dict.restoreLabel}
                                                    </button>
                                                ) : pendingArchiveExamId === exam.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                handleArchiveExam(exam.id, true)
                                                                setPendingArchiveExamId('')
                                                            }}
                                                            className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                        >
                                                            {dict.confirmArchiveButton}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setPendingArchiveExamId('')}
                                                            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                        >
                                                            {dict.cancelArchiveButton}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPendingArchiveExamId(exam.id)}
                                                        className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                    >
                                                        {dict.archiveLabel}
                                                    </button>
                                                )}
                                            </div>
                                            <div className="mt-2 text-xs text-gray-600">
                                                {dict.examMeta.startLabel}: {startAt}
                                            </div>
                                            <div className="text-xs text-gray-600">
                                                {dict.examMeta.statusLabel}: {statusLabel}
                                            </div>
                                            {isArchived(exam.archivedAt) && (
                                                <div className="mt-2 text-xs text-amber-600">{dict.archivedBadge}</div>
                                            )}
                                        </div>
                                    )
                                })
                                )
                            }
                            panels={
                                <AdminActionPanels
                                    isAddOpen={isAddOpen}
                                    isImportOpen={false}
                                    addPanelContent={
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="text-sm text-gray-600">{dict.createExamButton}</div>
                                            <a
                                                id="admin-create-exam-link"
                                                href="/teacher/exams/new"
                                                className="inline-flex items-center rounded-md bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800"
                                            >
                                                {dict.createExamButton}
                                            </a>
                                        </div>
                                    }
                                />
                            }
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
