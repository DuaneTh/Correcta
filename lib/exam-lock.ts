import { prisma } from "@/lib/prisma"

/**
 * Check if an exam is locked for editing.
 * An exam is locked if:
 * - startAt is defined, AND
 * - current time is within 10 minutes of startAt
 * 
 * @param examId - The exam ID to check
 * @returns true if locked, false if editable
 */
export async function isExamLocked(examId: string): Promise<boolean> {
    const exam = await prisma.exam.findUnique({
        where: { id: examId },
        select: { startAt: true }
    })

    if (!exam || !exam.startAt) {
        return false // No exam or no start time = not locked
    }

    const now = new Date()
    const lockTime = new Date(exam.startAt.getTime() - 10 * 60 * 1000) // 10 minutes before start

    return now >= lockTime
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
