import { prisma } from "@/lib/prisma"

/**
 * Check if an exam is locked for editing.
 * An exam is locked if it has been published and has started.
 *
 * @param examId - The exam ID to check
 * @returns true if locked, false if editable
 */
export async function isExamLocked(examId: string): Promise<boolean> {
    const exam = await prisma.exam.findUnique({
        where: { id: examId },
        select: { status: true, startAt: true }
    })

    if (!exam) {
        return false
    }

    if (exam.status !== 'PUBLISHED') {
        return false
    }
    if (!exam.startAt) {
        return false
    }
    return new Date() >= exam.startAt
}

/**
 * Get the exam start time for client-side lock computation
 */
export async function getExamStartTime(examId: string): Promise<Date | null> {
    const exam = await prisma.exam.findUnique({
        where: { id: examId },
        select: { startAt: true }
    })

    return exam?.startAt || null
}
