import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseContent, serializeContent } from '@/lib/content'
import { getExamPermissions } from '@/lib/exam-permissions'
import { getAuthSession, isTeacher } from '@/lib/api-auth'
import { getAllowedOrigins, getCsrfCookieName, verifyCsrf } from '@/lib/csrf'

type ExamParams = { examId?: string }

type BatchOp =
    | {
          type: 'updateExam'
          data: {
              title?: string
              startAt?: string | null
              durationMinutes?: number | null
              requireHonorCommitment?: boolean
              allowedMaterials?: string | null
              gradingConfig?: unknown
          }
      }
    | {
          type: 'updateSection'
          data: {
              sectionId: string
              patch: {
                  title?: string
                  order?: number
                  customLabel?: string | null
                  introContent?: string | null
              }
          }
      }
    | {
          type: 'updateQuestion'
          data: {
              sectionId: string
              questionId: string
              patch: {
                  content?: unknown
                  answerTemplate?: unknown
                  answerTemplateLocked?: boolean
                  studentTools?: unknown
                  type?: 'TEXT' | 'MCQ' | 'CODE'
                  order?: number
                  customLabel?: string | null
                  requireAllCorrect?: boolean
                  shuffleOptions?: boolean
                  maxPoints?: number | string | null
                  targetSectionId?: string
                  targetOrder?: number
              }
          }
      }
    | {
          type: 'updateSegment'
          data: {
              questionId: string
              segmentId: string
              patch: {
                  instruction?: string | null
                  maxPoints?: number | string | null
                  rubric?: {
                      criteria?: string
                      levels?: unknown[]
                      examples?: unknown
                  } | null
                  isCorrect?: boolean | string
                  order?: number
              }
          }
      }

const resolveExamId = async (req: Request, params: Promise<ExamParams>) => {
    const resolvedParams = await params
    const paramExamId = resolvedParams?.examId
    if (paramExamId && paramExamId !== 'undefined' && paramExamId !== 'null') {
        return paramExamId
    }
    try {
        const path = new URL(req.url).pathname
        const parts = path.split('/').filter(Boolean)
        return parts[parts.length - 2] ?? null
    } catch {
        return null
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<ExamParams> }) {
    try {
        const examId = await resolveExamId(req, params)
        if (!examId) {
            return NextResponse.json({ error: 'Invalid exam id' }, { status: 400 })
        }

        const session = await getAuthSession(req)
        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const csrfResult = verifyCsrf({
            req,
            cookieToken: req.cookies.get(getCsrfCookieName())?.value,
            headerToken: req.headers.get('x-csrf-token'),
            allowedOrigins: getAllowedOrigins()
        })
        if (!csrfResult.ok) {
            return NextResponse.json({ error: 'CSRF' }, { status: 403 })
        }

        const existingExam = await prisma.exam.findUnique({
            where: { id: examId },
            include: { course: true },
        })

        if (!existingExam || existingExam.archivedAt || existingExam.course.archivedAt || existingExam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const { canEdit } = await getExamPermissions(examId, {
            id: session.user.id,
            institutionId: session.user.institutionId,
            role: session.user.role,
        })
        if (!canEdit) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = (await req.json()) as { ops?: BatchOp[] }
        const ops = Array.isArray(body.ops) ? body.ops : []
        if (ops.length === 0) {
            return NextResponse.json({ error: 'No operations provided' }, { status: 400 })
        }

        let examSnapshot = existingExam
        const { logExamChanges } = await import('@/lib/exam-change')

        await prisma.$transaction(async (tx) => {
            for (const op of ops) {
                if (op.type === 'updateExam') {
                    const updateData: Record<string, unknown> = {}
                    if (op.data.title !== undefined) updateData.title = op.data.title
                    if (op.data.startAt !== undefined) {
                        updateData.startAt = op.data.startAt ? new Date(op.data.startAt) : null
                    }
                    if (op.data.durationMinutes !== undefined) updateData.durationMinutes = op.data.durationMinutes
                    if (op.data.requireHonorCommitment !== undefined) {
                        updateData.requireHonorCommitment = op.data.requireHonorCommitment
                    }
                    if (op.data.allowedMaterials !== undefined) updateData.allowedMaterials = op.data.allowedMaterials
                    if (op.data.gradingConfig !== undefined) updateData.gradingConfig = op.data.gradingConfig

                    if (Object.keys(updateData).length === 0) continue

                    const updatedExam = await tx.exam.update({
                        where: { id: examId },
                        data: updateData,
                        include: { course: true },
                    })

                    const examChanges: Array<Parameters<typeof logExamChanges>[1][number]> = []
                    if (op.data.title !== undefined) {
                        examChanges.push({
                            examId,
                            entityType: 'EXAM',
                            entityId: examId,
                            entityLabel: examSnapshot.title,
                            field: 'title',
                            beforeValue: examSnapshot.title,
                            afterValue: op.data.title,
                            createdById: session.user.id,
                        })
                    }
                    if (op.data.allowedMaterials !== undefined) {
                        examChanges.push({
                            examId,
                            entityType: 'EXAM',
                            entityId: examId,
                            entityLabel: examSnapshot.title,
                            field: 'allowedMaterials',
                            beforeValue: examSnapshot.allowedMaterials ?? null,
                            afterValue: op.data.allowedMaterials ?? null,
                            createdById: session.user.id,
                        })
                    }
                    if (op.data.requireHonorCommitment !== undefined) {
                        examChanges.push({
                            examId,
                            entityType: 'EXAM',
                            entityId: examId,
                            entityLabel: examSnapshot.title,
                            field: 'requireHonorCommitment',
                            beforeValue: examSnapshot.requireHonorCommitment,
                            afterValue: op.data.requireHonorCommitment,
                            createdById: session.user.id,
                        })
                    }
                    await logExamChanges({ status: examSnapshot.status, startAt: examSnapshot.startAt }, examChanges)
                    examSnapshot = updatedExam
                    continue
                }

                if (op.type === 'updateSection') {
                    const section = await tx.examSection.findUnique({
                        where: { id: op.data.sectionId },
                        include: { exam: { include: { course: true } } },
                    })
                    if (!section || section.examId !== examId || section.exam.archivedAt || section.exam.course.archivedAt) {
                        throw new Error('Invalid section')
                    }
                    if (section.exam.course.institutionId !== session.user.institutionId) {
                        throw new Error('Unauthorized')
                    }
                    if (section.isDefault) continue

                    const { title, order, customLabel, introContent } = op.data.patch
                    const updatedSection = await tx.examSection.update({
                        where: { id: op.data.sectionId },
                        data: {
                            ...(title !== undefined && { title }),
                            ...(order !== undefined && { order }),
                            ...(customLabel !== undefined && { customLabel: customLabel || null }),
                            ...(introContent !== undefined && {
                                introContent: introContent ? serializeContent(parseContent(introContent)) : null,
                            }),
                        },
                    })

                    const fallbackSectionLabel = section.title?.trim() ? section.title : 'Section'
                    const sectionLabel = section.customLabel || fallbackSectionLabel
                    const sectionChanges: Array<Parameters<typeof logExamChanges>[1][number]> = []
                    if (title !== undefined) {
                        sectionChanges.push({
                            examId,
                            entityType: 'SECTION',
                            entityId: section.id,
                            entityLabel: sectionLabel,
                            field: 'title',
                            beforeValue: section.title,
                            afterValue: title,
                            createdById: session.user.id,
                        })
                    }
                    if (customLabel !== undefined) {
                        sectionChanges.push({
                            examId,
                            entityType: 'SECTION',
                            entityId: section.id,
                            entityLabel: sectionLabel,
                            field: 'customLabel',
                            beforeValue: section.customLabel ?? null,
                            afterValue: customLabel || null,
                            createdById: session.user.id,
                        })
                    }
                    if (introContent !== undefined) {
                        sectionChanges.push({
                            examId,
                            entityType: 'SECTION',
                            entityId: section.id,
                            entityLabel: sectionLabel,
                            field: 'introContent',
                            beforeValue: parseContent(section.introContent || ''),
                            afterValue: parseContent(introContent || ''),
                            createdById: session.user.id,
                        })
                    }
                    await logExamChanges({ status: section.exam.status, startAt: section.exam.startAt }, sectionChanges)
                    void updatedSection
                    continue
                }

                if (op.type === 'updateQuestion') {
                    const question = await tx.question.findUnique({
                        where: { id: op.data.questionId },
                        include: {
                            section: {
                                include: {
                                    exam: {
                                        include: { course: true },
                                    },
                                },
                            },
                        },
                    })
                    if (!question || question.section.examId !== examId || question.section.exam.archivedAt || question.section.exam.course.archivedAt) {
                        throw new Error('Invalid question')
                    }
                    if (question.section.exam.course.institutionId !== session.user.institutionId) {
                        throw new Error('Unauthorized')
                    }

                    const {
                        content,
                        answerTemplate,
                        answerTemplateLocked,
                        studentTools,
                        type,
                        order,
                        customLabel,
                        requireAllCorrect,
                        shuffleOptions,
                        maxPoints,
                        targetSectionId,
                        targetOrder,
                    } = op.data.patch

                    if (type && !['TEXT', 'MCQ', 'CODE'].includes(type)) {
                        throw new Error('Invalid question type')
                    }
                    if (targetSectionId) {
                        const targetSection = await tx.examSection.findUnique({
                            where: { id: targetSectionId },
                            select: { id: true, examId: true },
                        })
                        if (!targetSection || targetSection.examId !== examId) {
                            throw new Error('Invalid target section')
                        }
                    }

                    const updateData: Record<string, unknown> = {}
                    if (content !== undefined) updateData.content = serializeContent(parseContent(content))
                    if (answerTemplate !== undefined) updateData.answerTemplate = serializeContent(parseContent(answerTemplate))
                    if (answerTemplateLocked !== undefined) updateData.answerTemplateLocked = Boolean(answerTemplateLocked)
                    if (studentTools !== undefined) updateData.studentTools = studentTools ?? null
                    if (type !== undefined) updateData.type = type
                    if (targetOrder !== undefined) {
                        updateData.order = targetOrder
                    } else if (order !== undefined) {
                        updateData.order = order
                    }
                    if (targetSectionId) {
                        updateData.sectionId = targetSectionId
                    }
                    if (customLabel !== undefined) updateData.customLabel = customLabel
                    if (requireAllCorrect !== undefined) updateData.requireAllCorrect = requireAllCorrect
                    if (shuffleOptions !== undefined) updateData.shuffleOptions = shuffleOptions
                    if (maxPoints !== undefined) {
                        if (maxPoints === null || maxPoints === '') {
                            updateData.maxPoints = null
                        } else {
                            const parsed = typeof maxPoints === 'number' ? maxPoints : parseFloat(String(maxPoints))
                            updateData.maxPoints = Number.isNaN(parsed) ? null : parsed
                        }
                    }

                    await tx.question.update({
                        where: { id: question.id },
                        data: updateData,
                    })

                    const fallbackQuestionLabel = `Question ${question.order + 1}`
                    const questionLabel = question.customLabel || fallbackQuestionLabel
                    const questionChanges: Array<Parameters<typeof logExamChanges>[1][number]> = []
                    if (content !== undefined) {
                        questionChanges.push({
                            examId,
                            entityType: 'QUESTION',
                            entityId: question.id,
                            entityLabel: questionLabel,
                            field: 'content',
                            beforeValue: parseContent(question.content),
                            afterValue: parseContent(content),
                            createdById: session.user.id,
                        })
                    }
                    if (answerTemplate !== undefined) {
                        questionChanges.push({
                            examId,
                            entityType: 'QUESTION',
                            entityId: question.id,
                            entityLabel: questionLabel,
                            field: 'answerTemplate',
                            beforeValue: parseContent(question.answerTemplate || ''),
                            afterValue: parseContent(answerTemplate),
                            createdById: session.user.id,
                        })
                    }
                    if (studentTools !== undefined) {
                        questionChanges.push({
                            examId,
                            entityType: 'QUESTION',
                            entityId: question.id,
                            entityLabel: questionLabel,
                            field: 'studentTools',
                            beforeValue: question.studentTools ?? null,
                            afterValue: studentTools ?? null,
                            createdById: session.user.id,
                        })
                    }
                    await logExamChanges({ status: question.section.exam.status, startAt: question.section.exam.startAt }, questionChanges)
                    continue
                }

                if (op.type === 'updateSegment') {
                    const segment = await tx.questionSegment.findUnique({
                        where: { id: op.data.segmentId },
                        include: {
                            question: {
                                include: {
                                    section: {
                                        include: {
                                            exam: {
                                                include: { course: true },
                                            },
                                        },
                                    },
                                },
                            },
                            rubric: true,
                        },
                    })
                    if (!segment || segment.question.section.examId !== examId || segment.question.section.exam.archivedAt || segment.question.section.exam.course.archivedAt) {
                        throw new Error('Invalid segment')
                    }
                    if (segment.question.section.exam.course.institutionId !== session.user.institutionId) {
                        throw new Error('Unauthorized')
                    }

                    const { instruction, maxPoints, rubric, isCorrect, order } = op.data.patch
                    const updateData: Record<string, unknown> = {}
                    if (instruction !== undefined) {
                        updateData.instruction = instruction === null ? '' : String(instruction)
                    }
                    if (maxPoints !== undefined) {
                        if (maxPoints === null || maxPoints === '') {
                            updateData.maxPoints = null
                        } else {
                            const parsed = typeof maxPoints === 'number' ? maxPoints : parseFloat(String(maxPoints))
                            if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
                                updateData.maxPoints = parsed
                            }
                        }
                    }
                    if (isCorrect !== undefined) {
                        updateData.isCorrect = isCorrect === true || isCorrect === 'true'
                    }
                    if (order !== undefined) {
                        const parsed = typeof order === 'number' ? order : parseInt(String(order), 10)
                        if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
                            updateData.order = parsed
                        }
                    }

                    const hasUpdateData = Object.keys(updateData).length > 0
                    if (hasUpdateData) {
                        await tx.questionSegment.update({
                            where: { id: op.data.segmentId },
                            data: updateData,
                        })
                    }

                    if (rubric !== undefined) {
                        if (rubric === null) {
                            if (segment.rubric) {
                                await tx.rubric.delete({
                                    where: { id: segment.rubric.id },
                                })
                            }
                        } else if (segment.rubric) {
                            await tx.rubric.update({
                                where: { id: segment.rubric.id },
                                data: {
                                    criteria: rubric.criteria,
                                    levels: rubric.levels as any,
                                    examples: (rubric.examples || null) as any,
                                },
                            })
                        } else {
                            await tx.rubric.create({
                                data: {
                                    segmentId: segment.id,
                                    criteria: rubric.criteria || '',
                                    levels: (rubric.levels || []) as any,
                                    examples: (rubric.examples || null) as any,
                                },
                            })
                        }
                    }

                    const fallbackQuestionLabel = `Question ${segment.question.order + 1}`
                    const segmentLabel = segment.question.customLabel || fallbackQuestionLabel
                    const segmentChanges: Array<Parameters<typeof logExamChanges>[1][number]> = []
                    if (instruction !== undefined) {
                        segmentChanges.push({
                            examId,
                            entityType: 'SEGMENT',
                            entityId: segment.id,
                            entityLabel: segmentLabel,
                            field: 'instruction',
                            beforeValue: segment.instruction,
                            afterValue: instruction ?? '',
                            createdById: session.user.id,
                        })
                    }
                    await logExamChanges({ status: segment.question.section.exam.status, startAt: segment.question.section.exam.startAt }, segmentChanges)
                    continue
                }
            }
        })

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        console.error('[API] Batch Exam Update Error:', error)
        return NextResponse.json({ error: (error as Error)?.message || 'Internal Server Error' }, { status: 500 })
    }
}
