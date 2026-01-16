import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getDictionary } from "@/lib/i18n/server"
import { redirect } from "next/navigation"
import TeacherCoursesClient from "./TeacherCoursesClient"

export default async function TeacherCoursesPage() {
    const session = await getServerSession(await buildAuthOptions())

    if (!session || !session.user) {
        redirect('/login')
    }

    const dictionary = await getDictionary()

    // Fetch courses where user is teacher or admin
    const courses = await prisma.course.findMany({
        where: {
            archivedAt: null,
            OR: [
                {
                    // User is enrolled as TEACHER
                    classes: {
                        some: {
                            archivedAt: null,
                            enrollments: {
                                some: {
                                    userId: session.user.id,
                                    role: 'TEACHER'
                                }
                            }
                        }
                    }
                },
                // Or user is ADMIN (can see all courses in institution)
                session.user.role === 'ADMIN' || session.user.role === 'SCHOOL_ADMIN' ? {
                    institutionId: session.user.institutionId
                } : {}
            ],
            institutionId: session.user.institutionId
        },
        include: {
            exams: {
                where: { archivedAt: null, parentExamId: null },
                orderBy: {
                    startAt: 'desc'
                },
                include: {
                    class: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
            _count: {
                select: { exams: true }
            }
        },
        orderBy: {
            code: 'asc'
        }
    })

    const serializedCourses = courses.map(course => ({
        ...course,
        _count: {
            exams: course.exams.length,
        },
        exams: course.exams.map(exam => ({
            ...exam,
            startAt: exam.startAt ? exam.startAt.toISOString() : null,
            endAt: exam.endAt ? exam.endAt.toISOString() : null,
            createdAt: exam.createdAt.toISOString(),
            updatedAt: exam.updatedAt.toISOString(),
            classId: exam.classId ?? null,
            parentExamId: exam.parentExamId ?? null,
            className: exam.class?.name ?? null,
            gradingConfig: exam.gradingConfig as Record<string, unknown> | null,
        }))
    }))

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <TeacherCoursesClient courses={serializedCourses} dictionary={dictionary} />
        </div>
    )
}
