import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { isStudent } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import StartExamButton from "@/app/student/components/StartExamButton"
import { getDictionary, getLocale } from "@/lib/i18n/server"
import { getExamEndAt } from "@/lib/exam-time"
import { resolvePublishedExamsForClasses } from "@/lib/exam-variants"

const DEFAULT_SECTION_NAME = '__DEFAULT__'

export const metadata: Metadata = {
    title: "Prochain Examen | Correcta",
}

type ExamCard = {
    id: string
    title: string
    durationMinutes: number
    startAt: Date
    endAt: Date | null
    course: { code: string; name: string }
    attemptId?: string
    attemptStatus?: string
    isBeforeStart: boolean
    isWithinWindow: boolean
}

export default async function NextExamPage() {
    const authOptions = await buildAuthOptions()
    const session = await getServerSession(authOptions)
    const dictionary = await getDictionary()
    const dict = dictionary.student.nextExamPage
    const locale = await getLocale()
    const localeString = locale === 'fr' ? 'fr-FR' : 'en-US'

    if (!session || !session.user) {
        redirect("/login")
    }

    if (!isStudent(session)) {
        const role = session.user.role
        if (role === 'TEACHER') {
            redirect('/teacher/courses')
        }
        if (role === 'SCHOOL_ADMIN' || role === 'PLATFORM_ADMIN') {
            redirect('/admin')
        }
        redirect('/login')
    }

    const studentId = session.user.id
    const now = new Date()

    const enrollments = await prisma.enrollment.findMany({
        where: {
            userId: studentId,
            class: {
                archivedAt: null,
                course: { archivedAt: null }
            }
        },
        select: {
            classId: true,
            class: { select: { courseId: true, name: true } },
        }
    })
    const classIdSet = new Set(enrollments.map((enrollment) => enrollment.classId))
    const coursesWithDefault = Array.from(new Set(
        enrollments
            .filter((enrollment) => enrollment.class?.name === DEFAULT_SECTION_NAME)
            .map((enrollment) => enrollment.class?.courseId)
            .filter(Boolean) as string[]
    ))
    if (coursesWithDefault.length > 0) {
        const extraClasses = await prisma.class.findMany({
            where: {
                courseId: { in: coursesWithDefault },
                archivedAt: null,
            },
            select: { id: true },
        })
        extraClasses.forEach((cls) => classIdSet.add(cls.id))
    }
    const classIds = Array.from(classIdSet)

    const baseExamWhere = {
        archivedAt: null,
        status: 'PUBLISHED' as const,
        durationMinutes: { not: null, gt: 0 },
        startAt: { not: null, gt: new Date('2000-01-01') },
        classId: null,
        parentExamId: null,
        OR: [
            {
                course: {
                    archivedAt: null,
                    classes: {
                        some: {
                            archivedAt: null,
                            enrollments: {
                                some: { userId: studentId }
                            }
                        }
                    }
                }
            },
            {
                classIds: {
                    hasSome: classIds
                }
            }
        ]
    }

    const variantExamWhere = {
        archivedAt: null,
        status: 'PUBLISHED' as const,
        durationMinutes: { not: null, gt: 0 },
        startAt: { not: null, gt: new Date('2000-01-01') },
        classId: { in: classIds }
    }

    const examInclude = {
        course: true,
        attempts: {
            where: { studentId: studentId },
            orderBy: { startedAt: 'desc' as const },
            take: 1
        },
    }
    const examSelect = {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
        durationMinutes: true,
        status: true,
        parentExamId: true,
        classId: true,
        classIds: true,
    }

    const [variantExams, baseExams] = await Promise.all([
        prisma.exam.findMany({
            where: variantExamWhere,
            select: {
                ...examSelect,
                course: true,
                attempts: examInclude.attempts,
            },
            orderBy: { startAt: 'asc' }
        }),
        prisma.exam.findMany({
            where: baseExamWhere,
            select: {
                ...examSelect,
                course: true,
                attempts: examInclude.attempts,
            },
            orderBy: { startAt: 'asc' }
        })
    ])

    type ExamWithAttempts = (typeof variantExams)[number]
    const exams = resolvePublishedExamsForClasses({
        baseExams,
        variantExams,
        classIds,
        context: 'student-next-exam',
    }) as ExamWithAttempts[]

    const eligibleExams = exams.filter(exam => {
        if (!exam.durationMinutes || exam.durationMinutes <= 0) {
            return false
        }
        if (!exam.startAt || exam.startAt <= new Date('2000-01-01')) {
            return false
        }

        const computedEndAt = getExamEndAt(exam.startAt, exam.durationMinutes, exam.endAt)
        if (computedEndAt && computedEndAt < now) {
            return false
        }

        const attempt = exam.attempts[0]

        if (!attempt) return true

        if (attempt.status === 'IN_PROGRESS') {
            if (exam.status !== 'PUBLISHED' || !exam.durationMinutes || exam.durationMinutes <= 0 || !exam.startAt || exam.startAt <= new Date('2000-01-01')) {
                return false
            }
            return true
        }

        if (attempt.status === 'SUBMITTED' ||
            attempt.status === 'GRADED' ||
            attempt.status === 'GRADING_IN_PROGRESS') {
            return false
        }

        return true
    })

    if (eligibleExams.length === 0) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="max-w-2xl mx-auto text-center">
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
                        <h1 className="text-3xl font-semibold text-brand-900 mb-4">
                            {dict.noExam.title}
                        </h1>
                        <p className="text-gray-600 mb-8">
                            {dict.noExam.description}
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <a
                                href="/student/courses"
                                className="inline-flex items-center justify-center px-6 py-3 rounded-full text-base font-semibold text-white bg-brand-900 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-900"
                            >
                                {dict.noExam.backToCoursesButton}
                            </a>
                            <a
                                href="/student/exams"
                                className="inline-flex items-center justify-center px-6 py-3 rounded-full text-base font-semibold text-brand-900 border border-brand-200 hover:border-brand-300 hover:text-brand-700 transition-colors"
                            >
                                {dict.noExam.backToExamsButton}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const formatDateTime = (value: Date) =>
        value.toLocaleString(localeString, { dateStyle: 'full', timeStyle: 'short' })

    const formatDate = (value: Date) =>
        value.toLocaleDateString(localeString, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

    const formatTime = (value: Date) =>
        value.toLocaleTimeString(localeString, { hour: '2-digit', minute: '2-digit' })

    const cards: ExamCard[] = eligibleExams.map(exam => {
        const startAt = new Date(exam.startAt as Date)
        const endAt = getExamEndAt(startAt, exam.durationMinutes, exam.endAt)
        const isBeforeStart = now < startAt
        const isAfterEnd = endAt && now > endAt
        const isWithinWindow = !isBeforeStart && !isAfterEnd
        const attempt = exam.attempts[0]

        return {
            id: exam.id,
            title: exam.title,
            durationMinutes: exam.durationMinutes!,
            startAt,
            endAt,
            course: { code: exam.course.code, name: exam.course.name },
            attemptId: attempt?.id,
            attemptStatus: attempt?.status,
            isBeforeStart,
            isWithinWindow
        }
    })

    const inProgressExams = cards
        .filter(exam => exam.isWithinWindow)
        .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())

    const upcomingExams = cards
        .filter(exam => exam.isBeforeStart)
        .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
                    {dict.title}
                </h1>
                <a
                    href="/student/courses"
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-full text-sm font-semibold text-brand-900 border border-brand-200 hover:border-brand-300 hover:text-brand-700 transition-colors"
                >
                    {dict.availableExam.backButton}
                </a>
            </div>

            {inProgressExams.length > 0 && (
                <section className="space-y-4">
                    {inProgressExams.map(exam => (
                        <div
                            key={exam.id}
                            className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 shadow-sm flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
                        >
                            <div className="space-y-2">
                                <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold text-white bg-brand-900 border border-brand-900">
                                    {dictionary.student.coursesPage.statusInProgress}
                                </span>
                                <div>
                                    <p className="text-sm text-gray-500">
                                        {exam.course.code} - {exam.course.name}
                                    </p>
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        {exam.title}
                                    </h3>
                                </div>
                                <div className="text-sm text-gray-600 space-y-1">
                                    <p>{dict.availableExam.durationLabel} : {exam.durationMinutes} minutes</p>
                                    <p>{dict.availableExam.startLabel} : {formatDateTime(exam.startAt)}</p>
                                    {exam.endAt && (
                                        <p>{dict.availableExam.endLabel} : {formatDateTime(exam.endAt)}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-start lg:justify-end">
                                {exam.attemptStatus === 'IN_PROGRESS' ? (
                                    <a
                                        href={`/student/attempts/${exam.attemptId}`}
                                        className="inline-flex items-center justify-center px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-brand-900 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-900"
                                    >
                                        {dict.availableExam.resumeButton}
                                    </a>
                                ) : (
                                    <StartExamButton
                                        examId={exam.id}
                                        label={dict.availableExam.startButton}
                                        className="inline-flex items-center justify-center px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-brand-900 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                </section>
            )}

            {upcomingExams.length > 0 && (
                <section className="bg-white rounded-2xl shadow-sm border border-gray-200 px-6 py-6 sm:px-8 sm:py-7 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                            {dictionary.student.coursesPage.statusUpcoming}
                        </h2>
                        <span className="text-xs text-gray-500">
                            {upcomingExams.length}
                        </span>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        {upcomingExams.map(exam => (
                            <div
                                key={exam.id}
                                className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm flex flex-col gap-3"
                            >
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                                        {dict.upcomingExam.title}
                                    </p>
                                    <span className="text-xs font-medium text-gray-500">
                                        {formatDate(exam.startAt)}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">
                                        {exam.course.code} - {exam.course.name}
                                    </p>
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        {exam.title}
                                    </h3>
                                </div>
                                <div className="text-sm text-gray-600 space-y-1">
                                    <p>{dict.availableExam.durationLabel} : {exam.durationMinutes} minutes</p>
                                    <p>{dict.availableExam.startLabel} : {formatDateTime(exam.startAt)}</p>
                                    {exam.endAt && (
                                        <p>{dict.availableExam.endLabel} : {formatDateTime(exam.endAt)}</p>
                                    )}
                                </div>
                                <div className="text-sm text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                                    {dict.upcomingExam.willOpenPrefix} {formatDate(exam.startAt)} {formatTime(exam.startAt)}.
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    )
}
