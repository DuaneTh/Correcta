import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export type ExamVariantShape = {
    id: string
    parentExamId: string | null
    classId: string | null
    classIds?: string[] | null
}

export type DraftVariantInfo = {
    id: string
    classId: string
    title: string
    updatedAt: Date
    className: string | null
}

export type PublishPolicy =
    | 'PUBLISH_ALL'
    | 'PUBLISH_EXCEPT_DRAFT_SECTIONS'
    | 'DELETE_DRAFTS_THEN_PUBLISH'

type ExamInvariantContext = {
    examId?: string
    context: string
    expect?: 'base' | 'variant'
}

const normalizeClassIds = (classIds?: string[] | null) =>
    Array.isArray(classIds) ? classIds.filter((id) => typeof id === 'string') : []

export const examAppliesToClassIds = (exam: ExamVariantShape, classIds: string[]) => {
    const normalized = normalizeClassIds(exam.classIds)
    if (normalized.length === 0) {
        return true
    }
    return normalized.some((id) => classIds.includes(id))
}

export const assertExamVariantShape = (exam: ExamVariantShape, info: ExamInvariantContext) => {
    const isBase = exam.parentExamId == null && exam.classId == null
    const isVariant = exam.parentExamId != null && exam.classId != null
    const normalizedClassIds = normalizeClassIds(exam.classIds)
    const isVariantClassIdsValid = normalizedClassIds.length === 0

    if (isBase && info.expect === 'variant') {
        console.error('[ExamInvariant] Expected variant, got base', { ...info, exam })
        throw new Error('Invalid exam variant shape (expected variant)')
    }

    if (isVariant && !isVariantClassIdsValid) {
        console.error('[ExamInvariant] Variant has classIds set', { ...info, exam })
        throw new Error('Invalid exam variant shape (classIds must be empty)')
    }

    if (isVariant && info.expect === 'base') {
        console.error('[ExamInvariant] Expected base, got variant', { ...info, exam })
        throw new Error('Invalid exam variant shape (expected base)')
    }

    if (!isBase && !isVariant) {
        console.error('[ExamInvariant] Invalid base/variant shape', { ...info, exam })
        throw new Error('Invalid exam variant shape')
    }
}

export const resolvePublishedExamsForClasses = <T extends ExamVariantShape>(args: {
    baseExams: T[]
    variantExams: T[]
    classIds: string[]
    context: string
}) => {
    const { baseExams, variantExams, classIds, context } = args
    baseExams.forEach((exam) => assertExamVariantShape(exam, { context }))
    variantExams.forEach((exam) => assertExamVariantShape(exam, { context, expect: 'variant' }))

    const applicableBaseExams = baseExams.filter((exam) => examAppliesToClassIds(exam, classIds))
    const variantBaseIds = new Set(
        variantExams.map((exam) => exam.parentExamId).filter(Boolean) as string[]
    )

    return [
        ...variantExams,
        ...applicableBaseExams.filter((exam) => !variantBaseIds.has(exam.id)),
    ]
}

export const getDraftVariantsForBaseExam = async (
    baseExamId: string,
    client: Prisma.TransactionClient | typeof prisma = prisma
) => {
    const variants = await client.exam.findMany({
        where: {
            parentExamId: baseExamId,
            status: 'DRAFT',
            archivedAt: null,
        },
        select: {
            id: true,
            classId: true,
            title: true,
            updatedAt: true,
            class: { select: { name: true } },
        },
    })

    return variants
        .filter((variant) => variant.classId)
        .map((variant) => ({
            id: variant.id,
            classId: variant.classId as string,
            title: variant.title,
            updatedAt: variant.updatedAt,
            className: variant.class?.name ?? null,
        }))
}

export const getPublishPolicyResult = (
    policy: PublishPolicy,
    baseClassIds: string[],
    draftVariants: Array<Pick<DraftVariantInfo, 'id' | 'classId' | 'className'>>
) => {
    const draftClassIds = Array.from(new Set(draftVariants.map((variant) => variant.classId)))
    const affectedDraftSections = draftVariants.map((variant) => ({
        classId: variant.classId,
        className: variant.className ?? null,
    }))

    if (policy === 'PUBLISH_EXCEPT_DRAFT_SECTIONS') {
        const updatedClassIds = baseClassIds.filter((id) => !draftClassIds.includes(id))
        return {
            updatedClassIds,
            deletedDraftVariantIds: [],
            affectedDraftSections,
        }
    }

    if (policy === 'DELETE_DRAFTS_THEN_PUBLISH') {
        return {
            updatedClassIds: baseClassIds,
            deletedDraftVariantIds: draftVariants.map((variant) => variant.id),
            affectedDraftSections,
        }
    }

    return {
        updatedClassIds: baseClassIds,
        deletedDraftVariantIds: [],
        affectedDraftSections,
    }
}
