import { prisma } from '@/lib/prisma'
import { AttemptStatus } from '@prisma/client'

/**
 * Centralized logic to recompute and update Attempt status based on grading progress.
 * 
 * Rules:
 * - If attempt is IN_PROGRESS, do not modify (student still taking exam)
 * - Otherwise, based on number of graded answers:
 *   - 0 graded → SUBMITTED
 *   - Some graded (0 < count < total) → GRADING_IN_PROGRESS
 *   - All graded (count === total) → GRADED
 * 
 * @param attemptId - The ID of the attempt to recompute status for
 * @returns The updated Attempt object
 */
export async function recomputeAttemptStatus(attemptId: string) {
    // Fetch attempt with answers and grades
    const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
            answers: {
                include: {
                    grades: true
                }
            }
        }
    })

    if (!attempt) {
        throw new Error(`Attempt ${attemptId} not found`)
    }

    // If in progress, don't touch it (student still taking exam)
    if (attempt.status === AttemptStatus.IN_PROGRESS) {
        return attempt
    }

    // Calculate grading progress
    const totalQuestions = attempt.answers.length
    const gradedCount = attempt.answers.filter(answer => answer.grades.length > 0).length

    // Determine new status
    let newStatus: AttemptStatus

    if (gradedCount === 0) {
        newStatus = AttemptStatus.SUBMITTED
    } else if (gradedCount < totalQuestions) {
        newStatus = AttemptStatus.GRADING_IN_PROGRESS
    } else {
        newStatus = AttemptStatus.GRADED
    }

    // Update if status changed
    if (attempt.status !== newStatus) {
        const updatedAttempt = await prisma.attempt.update({
            where: { id: attemptId },
            data: { status: newStatus }
        })
        return updatedAttempt
    }

    return attempt
}
