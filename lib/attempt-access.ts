import { prisma } from '@/lib/prisma'
import { getExamPermissions } from '@/lib/exam-permissions'

type SessionUser = {
    id: string
    role: string
    institutionId?: string | null
}

export type AttemptAuthContext = {
    id: string
    studentId: string
    examId: string
    institutionId: string | null
}

export async function getAttemptAuthContext(attemptId: string): Promise<AttemptAuthContext | null> {
    const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        select: {
            id: true,
            studentId: true,
            examId: true,
            exam: {
                select: {
                    course: {
                        select: { institutionId: true }
                    }
                }
            }
        }
    })

    if (!attempt) {
        return null
    }

    return {
        id: attempt.id,
        studentId: attempt.studentId,
        examId: attempt.examId,
        institutionId: attempt.exam.course.institutionId
    }
}

export async function getTeacherAccessForAttempt(
    examId: string,
    sessionUser: SessionUser
): Promise<boolean> {
    if (sessionUser.role !== 'TEACHER') {
        return false
    }

    const permissions = await getExamPermissions(examId, {
        id: sessionUser.id,
        role: sessionUser.role,
        institutionId: sessionUser.institutionId as string
    })

    return permissions.canEdit
}
