import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { isStudent } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import StudentCoursesClient from "./StudentCoursesClient"
import { getDictionary, getLocale } from "@/lib/i18n/server"
import { resolvePublishedExamsForClasses } from "@/lib/exam-variants"

const DEFAULT_SECTION_NAME = '__DEFAULT__'

export const metadata: Metadata = {
    title: "Mes Cours | Correcta",
}

export default async function StudentCoursesPage() {
    const authOptions = await buildAuthOptions()
    const session = await getServerSession(authOptions)

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
    const dictionary = await getDictionary()
    const locale = await getLocale()

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

    // Récupérer les cours de l'étudiant avec leurs examens ET les professeurs
    const courses = await prisma.course.findMany({
        where: {
            archivedAt: null,
            classes: {
                some: {
                    archivedAt: null,
                    enrollments: {
                        some: { userId: studentId }
                    }
                }
            }
        },
        include: {
            exams: {
                where: {
                    archivedAt: null,
                    status: 'PUBLISHED',
                    durationMinutes: { not: null, gt: 0 },
                    startAt: { not: null, gt: new Date('2000-01-01') }
                },
                include: {
                    attempts: {
                        where: { studentId: studentId },
                        select: {
                            id: true,
                            status: true,
                            startedAt: true,
                            submittedAt: true
                        }
                    }
                },
                orderBy: { startAt: 'desc' }
            },
            classes: {
                include: {
                    enrollments: {
                        where: { role: 'TEACHER', user: { archivedAt: null } },
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true
                                }
                            }
                        },
                        take: 1
                    }
                }
            }
        },
        orderBy: { name: 'asc' }
    })

    // Transformer les données pour extraire le premier professeur
    const coursesWithInstructor = courses.map(course => {
        // Trouver le premier professeur parmi toutes les classes
        const instructor = course.classes
            .flatMap(c => c.enrollments)
            .find(e => e.user)?.user

        const variantExams = course.exams.filter((exam) => exam.classId && classIds.includes(exam.classId))
        const baseExams = course.exams.filter((exam) => !exam.classId && !exam.parentExamId)
        const examsForStudent = resolvePublishedExamsForClasses({
            baseExams,
            variantExams,
            classIds,
            context: 'student-courses',
        })

        return {
            id: course.id,
            code: course.code,
            name: course.name,
            instructor: instructor ? {
                name: instructor.name,
                email: instructor.email
            } : undefined,
            exams: examsForStudent.map(exam => ({
                id: exam.id,
                title: exam.title,
                startAt: exam.startAt,
                endAt: exam.endAt,
                durationMinutes: exam.durationMinutes,
                gradingConfig: exam.gradingConfig,
                attempts: exam.attempts
            }))
        }
    })

    // Chronological sorting based on exams
    function getSortDate(course: typeof coursesWithInstructor[0]): Date | null {
        const now = new Date()

        const futureExams = course.exams.filter(e => e.startAt && new Date(e.startAt) > now)
        if (futureExams.length > 0) {
            return futureExams
                .map(e => new Date(e.startAt!))
                .sort((a, b) => a.getTime() - b.getTime())[0]
        }

        const pastExams = course.exams.filter(e => e.startAt && new Date(e.startAt) <= now)
        if (pastExams.length > 0) {
            return pastExams
                .map(e => new Date(e.startAt!))
                .sort((a, b) => b.getTime() - a.getTime())[0]
        }

        return null
    }

    const sortedCourses = [...coursesWithInstructor].sort((a, b) => {
        const da = getSortDate(a)
        const db = getSortDate(b)

        // Both have no reference date - sort alphabetically
        if (!da && !db) {
            return a.name.localeCompare(b.name)
        }

        // Only a has no reference date - b comes first
        if (!da) return 1

        // Only b has no reference date - a comes first
        if (!db) return -1

        // Both have dates - sort by date (latest first - reverse chronological)
        const diff = db.getTime() - da.getTime()
        if (diff !== 0) return diff

        // Same date - sort alphabetically as tiebreaker
        return a.name.localeCompare(b.name)
    })

    return <StudentCoursesClient courses={sortedCourses} dictionary={dictionary} locale={locale} />
}
