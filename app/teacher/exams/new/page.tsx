import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getDictionary, getLocale } from "@/lib/i18n/server"
import { redirect } from "next/navigation"
import NewExamFormClient from "./NewExamFormClient"

const DEFAULT_SECTION_NAME = '__DEFAULT__'

export default async function TeacherNewExamPage() {
    const session = await getServerSession(await buildAuthOptions())

    if (!session || !session.user) {
        redirect('/login')
    }

    const dictionary = await getDictionary()
    const locale = await getLocale()

    // Fetch courses where user is teacher or admin
    // Reusing logic from /teacher/courses to ensure consistency
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
                session.user.role === 'SCHOOL_ADMIN' || session.user.role === 'PLATFORM_ADMIN' ? {
                    institutionId: session.user.institutionId
                } : {}
            ],
            institutionId: session.user.institutionId
        },
        select: {
            id: true,
            code: true,
            name: true,
            classes: {
                where: { archivedAt: null },
                select: {
                    id: true,
                    name: true,
                },
            },
        },
        orderBy: {
            code: 'asc'
        }
    })

    const visibleCourses = session.user.role === 'TEACHER'
        ? (() => {
            const courseIds = courses.map((course) => course.id)
            return prisma.enrollment.findMany({
                where: {
                    userId: session.user.id,
                    role: 'TEACHER',
                    class: {
                        courseId: { in: courseIds },
                        archivedAt: null,
                    },
                },
                select: {
                    classId: true,
                    class: { select: { courseId: true, name: true } },
                },
            }).then((teacherEnrollments) => {
                const accessByCourse = new Map<string, { hasDefault: boolean; classIds: Set<string> }>()
                teacherEnrollments.forEach((enrollment) => {
                    const courseId = enrollment.class?.courseId
                    if (!courseId) {
                        return
                    }
                    const entry = accessByCourse.get(courseId) ?? { hasDefault: false, classIds: new Set() }
                    entry.classIds.add(enrollment.classId)
                    if (enrollment.class?.name === DEFAULT_SECTION_NAME) {
                        entry.hasDefault = true
                    }
                    accessByCourse.set(courseId, entry)
                })

                return courses.map((course) => {
                    const access = accessByCourse.get(course.id)
                    if (!access) {
                        return { ...course, classes: [] }
                    }
                    const hasNonDefault = course.classes.some((cls) => cls.name !== DEFAULT_SECTION_NAME)
                    const allowedIds = access.hasDefault
                        ? new Set(course.classes.map((cls) => cls.id))
                        : access.classIds
                    const nextClasses = course.classes.filter((cls) => allowedIds.has(cls.id))
                    return {
                        ...course,
                        classes: hasNonDefault ? nextClasses.filter((cls) => cls.name !== DEFAULT_SECTION_NAME) : nextClasses,
                    }
                })
            })
        })()
        : Promise.resolve(courses)

    const resolvedCourses = await visibleCourses

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <NewExamFormClient courses={resolvedCourses} dictionary={dictionary} currentLocale={locale} />
        </div>
    )
}
