import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export class AttemptNotEditableError extends Error {
    constructor(message: string = 'Attempt content is not editable (already submitted)') {
        super(message)
        this.name = 'AttemptNotEditableError'
    }
}

/**
 * Verifies that an attempt's content (Answers, AnswerSegments) can be edited.
 * 
 * Rules:
 * - ADMIN users can always edit
 * - For all other users, attempt must be IN_PROGRESS
 * - Once submitted (status !== IN_PROGRESS), content is immutable
 * 
 * @param attemptId - The ID of the attempt to check
 * @param user - The user attempting to edit (id and role required)
 * @throws AttemptNotEditableError if content cannot be edited
 */
export async function assertAttemptContentEditable(
    attemptId: string,
    user: { id: string; role: UserRole }
) {
    // ADMIN can always edit
    if (user.role === UserRole.ADMIN) {
        return
    }

    // For non-admins, check attempt status
    const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        select: { status: true, studentId: true }
    })

    if (!attempt) {
        throw new Error(`Attempt ${attemptId} not found`)
    }

    // Only IN_PROGRESS attempts are editable
    if (attempt.status !== 'IN_PROGRESS') {
        throw new AttemptNotEditableError(
            `Attempt content is locked (status: ${attempt.status}). Only grades can be modified.`
        )
    }

    // Additional check: student can only edit their own attempt
    if (user.role === UserRole.STUDENT && attempt.studentId !== user.id) {
        throw new AttemptNotEditableError('You can only edit your own attempt')
    }
}
