import { prisma } from '@/lib/prisma'

type UserRole = 'TEACHER' | 'STUDENT' | 'ADMIN' | 'SCHOOL_ADMIN' | 'PLATFORM_ADMIN' | string

const DEFAULT_SECTION_NAME = '__DEFAULT__'

type SessionUser = {
    id: string
    institutionId: string
    role: UserRole
}

type ExamPermission = {
    exam: {
        id: string
        courseId: string
        classId: string | null
        parentExamId: string | null
        authorId: string | null
        course: { institutionId: string }
    } | null
    canEdit: boolean
    teacherClassIds: string[]
}

const isAdmin = (role: UserRole) => role === 'ADMIN' || role === 'SCHOOL_ADMIN' || role === 'PLATFORM_ADMIN'

export async function getExamPermissions(examId: string, user: SessionUser): Promise<ExamPermission> {
    const exam = await prisma.exam.findUnique({
        where: { id: examId },
        select: {
            id: true,
            courseId: true,
            classId: true,
            parentExamId: true,
            authorId: true,
            archivedAt: true,
            course: { select: { institutionId: true, archivedAt: true } },
        },
    })

    if (!exam || exam.archivedAt || exam.course.archivedAt || exam.course.institutionId !== user.institutionId) {
        return { exam: null, canEdit: false, teacherClassIds: [] }
    }

    if (isAdmin(user.role)) {
        return { exam, canEdit: true, teacherClassIds: [] }
    }

    const teacherEnrollments = await prisma.enrollment.findMany({
        where: {
            userId: user.id,
            role: 'TEACHER',
            class: { courseId: exam.courseId, archivedAt: null },
        },
        select: {
            classId: true,
            class: { select: { name: true } },
        },
    })
    const hasDefaultEnrollment = teacherEnrollments.some(
        (enrollment) => enrollment.class?.name === DEFAULT_SECTION_NAME
    )
    const teacherClassIds = hasDefaultEnrollment
        ? (await prisma.class.findMany({
            where: { courseId: exam.courseId, archivedAt: null },
            select: { id: true },
        })).map((cls) => cls.id)
        : teacherEnrollments.map((enrollment) => enrollment.classId)

    let canEdit = false
    if (exam.classId) {
        canEdit = teacherClassIds.includes(exam.classId)
    } else {
        canEdit = exam.authorId === user.id
    }

    return { exam, canEdit, teacherClassIds }
}
