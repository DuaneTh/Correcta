import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

type ExamStatusShape = {
    status?: string | null
    startAt?: Date | string | null
}

export const isExamLive = (exam: ExamStatusShape) => {
    if (exam.status !== 'PUBLISHED') return false
    if (!exam.startAt) return false
    const startAt = typeof exam.startAt === 'string' ? new Date(exam.startAt) : exam.startAt
    return Boolean(startAt && new Date() >= startAt)
}

const isSameValue = (a: unknown, b: unknown) => {
    if (a === b) return true
    try {
        return JSON.stringify(a) === JSON.stringify(b)
    } catch {
        return false
    }
}

type ExamChangeInput = {
    examId: string
    entityType: 'EXAM' | 'SECTION' | 'QUESTION' | 'SEGMENT'
    entityId: string
    entityLabel?: string | null
    field: string
    beforeValue?: unknown
    afterValue?: unknown
    createdById?: string | null
    examStatus: ExamStatusShape
}

const normalizeJsonValue = (value: unknown): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull => {
    if (value === null || value === undefined) {
        return Prisma.JsonNull
    }
    return value as Prisma.InputJsonValue
}

export async function logExamChange({
    examId,
    entityType,
    entityId,
    entityLabel,
    field,
    beforeValue,
    afterValue,
    createdById,
    examStatus,
}: ExamChangeInput) {
    if (!isExamLive(examStatus)) return
    if (isSameValue(beforeValue, afterValue)) return

    await prisma.examChange.create({
        data: {
            examId,
            entityType,
            entityId,
            entityLabel: entityLabel ?? null,
            field,
            beforeValue: normalizeJsonValue(beforeValue),
            afterValue: normalizeJsonValue(afterValue),
            createdById: createdById ?? null,
        },
    })
}

export async function logExamChanges(
    examStatus: ExamStatusShape,
    changes: Array<Omit<ExamChangeInput, 'examStatus'>>
) {
    if (!isExamLive(examStatus)) return
    const filtered = changes.filter((change) => !isSameValue(change.beforeValue, change.afterValue))
    if (filtered.length === 0) return
    await prisma.examChange.createMany({
        data: filtered.map((change) => ({
            examId: change.examId,
            entityType: change.entityType,
            entityId: change.entityId,
            entityLabel: change.entityLabel ?? null,
            field: change.field,
            beforeValue: normalizeJsonValue(change.beforeValue),
            afterValue: normalizeJsonValue(change.afterValue),
            createdById: change.createdById ?? null,
        })),
    })
}
