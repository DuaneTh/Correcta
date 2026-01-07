import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAuthSession, isTeacher } from '@/lib/api-auth'
import { getExamPermissions } from '@/lib/exam-permissions'
import { assertExamVariantShape } from '@/lib/exam-variants'

const cloneExamContent = async (tx: Prisma.TransactionClient, sourceExamId: string, targetExamId: string) => {
    const sourceSections = await tx.examSection.findMany({
        where: { examId: sourceExamId },
        include: {
            questions: {
                include: {
                    segments: {
                        include: { rubric: true },
                    },
                },
                orderBy: { order: 'asc' },
            },
        },
        orderBy: { order: 'asc' },
    })

    for (const section of sourceSections) {
        const createdSection = await tx.examSection.create({
            data: {
                examId: targetExamId,
                title: section.title,
                order: section.order,
                isDefault: section.isDefault,
                customLabel: section.customLabel,
                introContent: section.introContent ?? null,
            },
        })

        for (const question of section.questions) {
            const createdQuestion = await tx.question.create({
                data: {
                    sectionId: createdSection.id,
                    content: question.content,
                    answerTemplate: question.answerTemplate ?? null,
                    answerTemplateLocked: question.answerTemplateLocked ?? false,
                    studentTools: (question.studentTools ?? null) as any,
                    shuffleOptions: question.shuffleOptions ?? false,
                    type: question.type,
                    order: question.order,
                    customLabel: question.customLabel ?? null,
                    requireAllCorrect: question.requireAllCorrect ?? false,
                    maxPoints: question.maxPoints ?? null,
                },
            })

            for (const segment of question.segments) {
                const createdSegment = await tx.questionSegment.create({
                    data: {
                        questionId: createdQuestion.id,
                        order: segment.order,
                        instruction: segment.instruction,
                        maxPoints: segment.maxPoints ?? null,
                        isCorrect: segment.isCorrect ?? null,
                    },
                })

                if (segment.rubric) {
                    await tx.rubric.create({
                        data: {
                            segmentId: createdSegment.id,
                            criteria: segment.rubric.criteria ?? null,
                            levels: segment.rubric.levels as any,
                            examples: (segment.rubric.examples ?? null) as any,
                        },
                    })
                }
            }
        }
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
    try {
        const { examId } = await params
        const session = await getAuthSession(req)
        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { classIds } = (await req.json()) as { classIds?: string[] }
        if (!Array.isArray(classIds) || classIds.length === 0) {
            return NextResponse.json({ error: 'Missing classIds' }, { status: 400 })
        }

        const baseExam = await prisma.exam.findUnique({
            where: { id: examId },
            include: { course: { select: { institutionId: true, archivedAt: true } } },
        })

        if (!baseExam || baseExam.archivedAt || baseExam.course.archivedAt || baseExam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        assertExamVariantShape(baseExam, { context: 'api-exams-variants-post', expect: 'base' })

        if (baseExam.parentExamId) {
            return NextResponse.json({ error: 'Cannot duplicate from a variant' }, { status: 400 })
        }

        const { canEdit, teacherClassIds } = await getExamPermissions(examId, {
            id: session.user.id,
            institutionId: session.user.institutionId,
            role: session.user.role,
        })
        if (!canEdit) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const normalizedClassIds = Array.from(new Set(classIds.filter((id) => typeof id === 'string' && id.trim().length > 0)))

        const validClasses = await prisma.class.findMany({
            where: {
                id: { in: normalizedClassIds },
                courseId: baseExam.courseId,
                archivedAt: null,
            },
            select: { id: true },
        })
        const validIds = new Set(validClasses.map((cls) => cls.id))
        const invalidIds = normalizedClassIds.filter((id) => !validIds.has(id))
        if (invalidIds.length > 0) {
            return NextResponse.json({ error: 'Invalid classIds for this course' }, { status: 400 })
        }

        if (!['ADMIN', 'SCHOOL_ADMIN', 'PLATFORM_ADMIN'].includes(session.user.role)) {
            const unauthorizedTargets = normalizedClassIds.filter((id) => !teacherClassIds.includes(id))
            if (unauthorizedTargets.length > 0) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        }

        const existingVariants = await prisma.exam.findMany({
            where: {
                parentExamId: baseExam.id,
                classId: { in: normalizedClassIds },
            },
            select: { classId: true },
        })
        const existingVariantIds = new Set(existingVariants.map((variant) => variant.classId))

        const classIdsToCreate = normalizedClassIds.filter((id) => !existingVariantIds.has(id))

        const createdVariants: Array<{ id: string; classId: string }> = []

        await prisma.$transaction(async (tx) => {
            if (classIdsToCreate.length > 0) {
                const nextClassIds = Array.from(new Set([...(baseExam.classIds || []), ...classIdsToCreate]))
                await tx.exam.update({
                    where: { id: baseExam.id },
                    data: { classIds: nextClassIds },
                })
            }

            for (const classId of classIdsToCreate) {
                const variant = await tx.exam.create({
                    data: {
                        title: baseExam.title,
                        description: baseExam.description,
                        courseId: baseExam.courseId,
                        classIds: [],
                        classId,
                        parentExamId: baseExam.id,
                        startAt: baseExam.startAt,
                        endAt: baseExam.endAt,
                        durationMinutes: baseExam.durationMinutes,
                        authorId: baseExam.authorId ?? session.user.id,
                        status: baseExam.status,
                        requireHonorCommitment: baseExam.requireHonorCommitment,
                        allowedMaterials: baseExam.allowedMaterials,
                        antiCheatConfig: baseExam.antiCheatConfig as any,
                        gradingConfig: baseExam.gradingConfig as any,
                    },
                })

                await cloneExamContent(tx, baseExam.id, variant.id)
                createdVariants.push({ id: variant.id, classId })
            }
        })

        return NextResponse.json({
            created: createdVariants,
            skipped: normalizedClassIds.filter((id) => existingVariantIds.has(id)),
        })
    } catch (error) {
        console.error('[API] Duplicate Exam Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
