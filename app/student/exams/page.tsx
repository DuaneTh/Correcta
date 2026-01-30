import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { isStudent } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { getDictionary, getLocale } from "@/lib/i18n/server"
import { resolvePublishedExamsForClasses } from "@/lib/exam-variants"
import StudentExamsClient from "./StudentExamsClient"
import { UserRole } from "@prisma/client"

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

    // Active exams (not archived) that the student can take
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

    // Also get archived exams where the student has attempts (to see past results)
    const archivedExamsWithAttemptsWhere = {
        archivedAt: { not: null },
        status: "PUBLISHED" as const,
        attempts: {
            some: { studentId: studentId },
        },
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
        archivedAt: true,
        course: {
            select: {
                code: true,
                name: true,
                classes: {
                    select: {
                        enrollments: {
                            where: { role: UserRole.TEACHER, user: { archivedAt: null } },
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
                answers: {
                    select: {
                        grades: {
                            select: { score: true },
                            take: 1
                        }
                    }
                }
            },
        },
        sections: {
            select: {
                questions: {
                    select: {
                        segments: {
                            select: { maxPoints: true }
                        }
                    }
                }
            }
        }
    }

    const [variantExams, baseExams, archivedExamsWithAttempts] = await Promise.all([
        prisma.exam.findMany({
            where: variantExamWhere,
            select: examSelect,
        }),
        prisma.exam.findMany({
            where: baseExamWhere,
            select: examSelect,
        }),
        // Archived exams where student has attempts (to view past results)
        prisma.exam.findMany({
            where: archivedExamsWithAttemptsWhere,
            select: examSelect,
        }),
    ])

    type ExamWithAttempts = (typeof variantExams)[number] & { archivedAt?: Date | null }
    const activeExams = resolvePublishedExamsForClasses({
        baseExams,
        variantExams,
        classIds,
        context: 'student-exams',
    }) as ExamWithAttempts[]

    // Combine active exams with archived exams that have attempts
    // Use a Map to avoid duplicates (in case an exam appears in both)
    const examMap = new Map<string, ExamWithAttempts>()
    activeExams.forEach(exam => examMap.set(exam.id, exam))
    archivedExamsWithAttempts.forEach(exam => {
        if (!examMap.has(exam.id)) {
            examMap.set(exam.id, exam as ExamWithAttempts)
        }
    })

    const exams = Array.from(examMap.values())
        .sort((a, b) => new Date(b.startAt as Date).getTime() - new Date(a.startAt as Date).getTime())

    return (
        <StudentExamsClient
            exams={exams.map((exam) => {
                // Calculate max points from exam sections
                const maxPoints = exam.sections?.reduce((total, section) => {
                    return total + section.questions.reduce((qTotal, question) => {
                        return qTotal + question.segments.reduce((sTotal, segment) => sTotal + (segment.maxPoints || 0), 0)
                    }, 0)
                }, 0) || 0

                // Calculate score from attempt grades
                const attempt = exam.attempts[0]
                const score = attempt?.answers?.reduce((total, answer) => {
                    const grade = answer.grades?.[0]
                    return total + (grade?.score || 0)
                }, 0) ?? null

                return {
                    ...exam,
                    startAt: exam.startAt as Date,
                    durationMinutes: exam.durationMinutes as number,
                    gradingConfig: exam.gradingConfig as Record<string, unknown> | null,
                    archivedAt: exam.archivedAt ?? null,
                    attempts: exam.attempts.map(a => ({
                        id: a.id,
                        status: a.status,
                        startedAt: a.startedAt,
                        submittedAt: a.submittedAt,
                        score: a.status === 'GRADED' ? score : null,
                        maxPoints: maxPoints > 0 ? maxPoints : null
                    }))
                }
            })}
            dictionary={dictionary}
            locale={locale}
        />
    )
}
