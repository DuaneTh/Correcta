import { notFound } from 'next/navigation'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getLocale } from '@/lib/i18n/server'
import { prisma } from '@/lib/prisma'
import TeacherCourseDetailClient from './TeacherCourseDetailClient'

export default async function TeacherCourseDetailPage({
    params,
}: {
    params: Promise<{ courseId: string }>
}) {
    const { courseId } = await params
    const locale = await getLocale()
    const dictionary = getDictionary(locale)

    // TODO: Add authentication/authorization check
    // Ensure the current user is a teacher and has access to this course

    const course = await prisma.course.findFirst({
        where: { id: courseId, archivedAt: null },
        include: {
            exams: {
                where: { archivedAt: null, parentExamId: null },
                include: {
                    class: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
            classes: {
                where: { archivedAt: null },
                include: {
                    enrollments: {
                        where: {
                            user: { archivedAt: null }
                        },
                        include: {
                            user: true,
                        },
                    },
                },
            },
        },
    })

    if (!course) {
        notFound()
    }

    const hasMultipleSections = course.classes.length > 1

    // Flatten students from all classes and remove duplicates by ID
    const allStudentsMap = new Map<string, { id: string; name: string | null; email: string | null; role?: string }>()
    course.classes.forEach((cls) => {
        cls.enrollments.forEach((enrollment) => {
            if (enrollment.user.role === 'STUDENT') {
                allStudentsMap.set(enrollment.user.id, enrollment.user)
            }
        })
    })
    const students = Array.from(allStudentsMap.values())

    const exams = course.exams.map(exam => ({
        id: exam.id,
        title: exam.title,
        startAt: exam.startAt ? exam.startAt.toISOString() : null,
        endAt: exam.endAt ? exam.endAt.toISOString() : null,
        status: exam.status,
        createdAt: exam.createdAt.toISOString(),
        durationMinutes: exam.durationMinutes,
        classId: exam.classId ?? null,
        parentExamId: exam.parentExamId ?? null,
        className: exam.class?.name ?? null,
    }))

    return (
        <TeacherCourseDetailClient
            courseId={course.id}
            courseCode={course.code}
            courseName={course.name}
            exams={exams}
            sections={course.classes}
            students={students}
            hasMultipleSections={hasMultipleSections}
            dictionary={dictionary}
        />
    )
}
