import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { isStudent } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { getDictionary, getLocale } from "@/lib/i18n/server"
import { resolvePublishedExamsForClasses } from "@/lib/exam-variants"
import StudentExamsClient from "./StudentExamsClient"

const DEFAULT_SECTION_NAME = '__DEFAULT__'

export const metadata: Metadata = {
    title: "Mes Examens | Correcta",
}

export default async function StudentExamsPage() {
    const authOptions = await buildAuthOptions()
    const session = await getServerSession(authOptions)
    const dictionary = await getDictionary()
    const locale = await getLocale()

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
        },
    })

    const classIdSet = new Set(enrollments.map((e) => e.classId))
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
        status: "PUBLISHED" as const,
        durationMinutes: { not: null, gt: 0 },
        startAt: { not: null, gt: new Date("2000-01-01") },
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
                                some: { userId: studentId },
                            },
                        },
                    },
                },
            },
            {
                classIds: {
                    hasSome: classIds,
                },
            },
        ],
    }

    const variantExamWhere = {
        archivedAt: null,
        status: "PUBLISHED" as const,
        durationMinutes: { not: null, gt: 0 },
        startAt: { not: null, gt: new Date("2000-01-01") },
        classId: { in: classIds },
    }

    const examSelect = {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
        durationMinutes: true,
        gradingConfig: true,
        parentExamId: true,
        classId: true,
        classIds: true,
        course: {
            select: {
                code: true,
                name: true,
                classes: {
                    select: {
                        enrollments: {
                            where: { role: "TEACHER", user: { archivedAt: null } },
                            select: {
                                user: { select: { name: true } },
                            },
                            take: 1,
                        },
                    },
                    take: 1,
                },
            },
        },
        attempts: {
            where: { studentId: studentId },
            select: {
                id: true,
                status: true,
                startedAt: true,
                submittedAt: true,
            },
        },
    }

    const [variantExams, baseExams] = await Promise.all([
        prisma.exam.findMany({
            where: variantExamWhere,
            select: examSelect,
        }),
        prisma.exam.findMany({
            where: baseExamWhere,
            select: examSelect,
        }),
    ])

    const exams = resolvePublishedExamsForClasses({
        baseExams,
        variantExams,
        classIds,
        context: 'student-exams',
    }).sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())

    return (
        <StudentExamsClient
            exams={exams}
            dictionary={dictionary}
            locale={locale}
        />
    )
}
