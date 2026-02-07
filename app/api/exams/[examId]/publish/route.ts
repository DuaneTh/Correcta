import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { buildAuthOptions } from '@/lib/auth'
import { getAllowedOrigins, getCsrfCookieToken, verifyCsrf } from '@/lib/csrf'
import { parseContent, segmentsToPlainText } from '@/lib/content'
import { getExamPermissions } from '@/lib/exam-permissions'
import { logAudit, getClientIp } from '@/lib/audit'
import { assertExamVariantShape, getDraftVariantsForBaseExam, getPublishPolicyResult, PublishPolicy } from '@/lib/exam-variants'

export async function POST(
    req: Request,
    { params }: { params: Promise<{ examId: string }> }
) {
    const { examId } = await params
    const authOptions = await buildAuthOptions()
    const session = await getServerSession(authOptions)

    // Auth check
    if (!session?.user?.id || session.user.role === 'STUDENT') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const csrfResult = verifyCsrf({
        req,
        cookieToken: getCsrfCookieToken(req),
        headerToken: req.headers.get('x-csrf-token'),
        allowedOrigins: getAllowedOrigins()
    })
    if (!csrfResult.ok) {
        return NextResponse.json({ error: 'CSRF' }, { status: 403 })
    }

    let body: { policy?: PublishPolicy } | null = null
    try {
        body = await req.json()
    } catch {
        body = null
    }

    try {
        // Fetch exam with full structure
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                course: {
                    select: { institutionId: true, archivedAt: true }
                },
                sections: {
                    include: {
                        questions: {
                            include: {
                                segments: true
                            },
                            orderBy: { order: 'asc' }
                        }
                    },
                    orderBy: { order: 'asc' }
                }
            }
        })

        if (!exam || exam.archivedAt || exam.course.archivedAt) {
            return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
        }

        assertExamVariantShape(exam, { context: 'api-exam-publish' })

        const { canEdit } = await getExamPermissions(examId, {
            id: session.user.id,
            institutionId: session.user.institutionId,
            role: session.user.role,
        })
        if (!canEdit) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Validation
        const missing: string[] = []

        if (!exam.title || exam.title.trim() === '') {
            missing.push('title')
        }

        if (!exam.startAt) {
            missing.push('date')
        } else if (exam.startAt < new Date()) {
            missing.push('date_past')
        }

        if (!exam.durationMinutes || exam.durationMinutes <= 0) {
            missing.push('duration')
        }
        const gradingConfig = exam.gradingConfig as { correctionReleaseAt?: string | null } | null
        const correctionReleaseAt = gradingConfig?.correctionReleaseAt
        if (correctionReleaseAt) {
            const releaseDate = new Date(correctionReleaseAt)
            const now = new Date()
            if (Number.isNaN(releaseDate.getTime())) {
                missing.push('correction_release_at_invalid')
            } else {
                if (releaseDate < now) {
                    missing.push('correction_release_at_past')
                }
                if (exam.startAt) {
                    const startDate = new Date(exam.startAt)
                    if (exam.durationMinutes && exam.durationMinutes > 0) {
                        const endDate = new Date(startDate)
                        endDate.setMinutes(endDate.getMinutes() + exam.durationMinutes)
                        if (releaseDate < endDate) {
                            missing.push('correction_release_at_before_end')
                        }
                    } else if (releaseDate < startDate) {
                        missing.push('correction_release_at_before_start')
                    }
                }
            }
        }

        // Check if exam has at least one question
        const hasQuestions = exam.sections.some(section => section.questions.length > 0)
        if (!hasQuestions) {
            missing.push('content')
        }

        const getPlainStringValue = (value?: string | null) => {
            if (!value) return ''
            try {
                const parsed = JSON.parse(value)
                if (Array.isArray(parsed)) {
                    return segmentsToPlainText(parseContent(parsed)).trim()
                }
            } catch {
                // Not JSON, use raw string
            }
            return value.trim()
        }

        // Validate all questions and their segments
        for (const section of exam.sections) {
            for (const question of section.questions) {
                // Check if question has content (intitulé)
                if (!question.content || question.content.trim() === '') {
                    missing.push('question_content')
                    continue // Skip segment validation if question is invalid
                }

                // Check if question has a label (numéro de question)
                if (!question.customLabel || question.customLabel.trim() === '') {
                    missing.push('question_label')
                    continue // Skip segment validation if question is invalid
                }

                // For MCQ questions, validate that all segments (options) have instructions and points
                if (question.type === 'MCQ') {
                    if (!question.segments || question.segments.length === 0) {
                        missing.push('mcq_options')
                        continue
                    }
                    const requireAllCorrect = question.requireAllCorrect === true
                    if (requireAllCorrect && !question.segments.some((segment) => segment.isCorrect)) {
                        missing.push('mcq_correct_options')
                    }
                    for (const segment of question.segments) {
                        if (getPlainStringValue(segment.instruction) === '') {
                            missing.push('mcq_option_text')
                            break // Only add once
                        }
                        // Only validate points per option if NOT in "all or nothing" mode
                        // In "all or nothing" mode, we validate total points at question level instead
                        if (!requireAllCorrect) {
                            // Check if points are defined (can be 0, but not null/undefined/-999)
                            // -999 is a marker value we use to indicate "not yet set by user"
                            if (segment.maxPoints === null || segment.maxPoints === undefined) {
                                missing.push('mcq_option_points')
                                break // Only add once
                            }
                        }
                    }
                    // Always validate total points at question level
                    if (question.maxPoints === null || question.maxPoints === undefined) {
                        missing.push('question_points')
                    } else if (!requireAllCorrect) {
                        const positiveSum = question.segments.reduce((sum, segment) => {
                            if (segment.maxPoints !== null && segment.maxPoints !== undefined && segment.maxPoints > 0) {
                                return sum + segment.maxPoints
                            }
                            return sum
                        }, 0)
                        if (Math.abs(question.maxPoints - positiveSum) > 1e-6) {
                            missing.push('mcq_points_mismatch')
                        }
                    }
                } else {
                    // For TEXT and CODE questions, validate that segments have maxPoints
                    if (!question.segments || question.segments.length === 0) {
                        missing.push('question_points')
                        continue
                    }
                    for (const segment of question.segments) {
                        if (segment.maxPoints === null || segment.maxPoints === undefined || segment.maxPoints < 0) {
                            missing.push('question_points')
                            break // Only add once
                        }
                    }
                }
            }
        }

        if (missing.length > 0) {
            return NextResponse.json({
                error: 'validation',
                missing
            }, { status: 400 })
        }

        const policy = body?.policy
        if (policy) {
            if (!['PUBLISH_ALL', 'PUBLISH_EXCEPT_DRAFT_SECTIONS', 'DELETE_DRAFTS_THEN_PUBLISH'].includes(policy)) {
                return NextResponse.json({ error: 'Invalid publish policy' }, { status: 400 })
            }
            if (exam.parentExamId || exam.classId) {
                return NextResponse.json({ error: 'Publish policy is only valid for base exams' }, { status: 400 })
            }

            const result = await prisma.$transaction(async (tx) => {
                const draftVariants = await getDraftVariantsForBaseExam(examId, tx)
                const baseClassIds = Array.isArray(exam.classIds) ? exam.classIds : []
                const policyResult = getPublishPolicyResult(
                    policy,
                    baseClassIds,
                    draftVariants
                )

                if (policy === 'DELETE_DRAFTS_THEN_PUBLISH' && policyResult.deletedDraftVariantIds.length > 0) {
                    await tx.exam.deleteMany({
                        where: { id: { in: policyResult.deletedDraftVariantIds } },
                    })
                }

                const updateData: { status: 'PUBLISHED'; classIds?: string[] } = {
                    status: 'PUBLISHED',
                }
                if (policy === 'PUBLISH_EXCEPT_DRAFT_SECTIONS') {
                    updateData.classIds = policyResult.updatedClassIds
                }

                await tx.exam.update({
                    where: { id: examId },
                    data: updateData,
                })

                return policyResult
            })

            logAudit({
                action: 'EXAM_PUBLISH',
                actorId: session.user.id,
                institutionId: session.user.institutionId,
                targetType: 'EXAM',
                targetId: examId,
                metadata: { policy, updatedClassIds: result.updatedClassIds.length, deletedDrafts: result.deletedDraftVariantIds.length },
                ipAddress: getClientIp(req),
            })

            return NextResponse.json({
                baseExamId: examId,
                updatedClassIds: result.updatedClassIds,
                deletedDraftVariantIds: result.deletedDraftVariantIds,
                affectedDraftSections: result.affectedDraftSections,
            })
        }

        // All valid - publish exam (default)
        const updated = await prisma.exam.update({
            where: { id: examId },
            data: { status: 'PUBLISHED' }
        })

        logAudit({
            action: 'EXAM_PUBLISH',
            actorId: session.user.id,
            institutionId: session.user.institutionId,
            targetType: 'EXAM',
            targetId: examId,
            ipAddress: getClientIp(req),
        })

        return NextResponse.json({ success: true, exam: updated })
    } catch (error) {
        console.error('[Publish Exam] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ examId: string }> }
) {
    const { examId } = await params
    const authOptions = await buildAuthOptions()
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || session.user.role === 'STUDENT') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const csrfResult = verifyCsrf({
        req,
        cookieToken: getCsrfCookieToken(req),
        headerToken: req.headers.get('x-csrf-token'),
        allowedOrigins: getAllowedOrigins()
    })
    if (!csrfResult.ok) {
        return NextResponse.json({ error: 'CSRF' }, { status: 403 })
    }

    try {
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: { course: true },
        })

        if (!exam || exam.archivedAt || exam.course.archivedAt) {
            return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
        }

        if (exam.course.institutionId !== session.user.institutionId) {
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

        // Reset in-progress attempts so a republish starts fresh.
        await prisma.$transaction(async (tx) => {
            const attempts = await tx.attempt.findMany({
                where: { examId },
                select: { id: true },
            })
            const attemptIds = attempts.map((attempt) => attempt.id)

            if (attemptIds.length > 0) {
                await tx.gradingTask.deleteMany({
                    where: { attemptId: { in: attemptIds } },
                })

                await tx.proctorEvent.deleteMany({
                    where: { attemptId: { in: attemptIds } },
                })

                const answers = await tx.answer.findMany({
                    where: { attemptId: { in: attemptIds } },
                    select: { id: true },
                })
                const answerIds = answers.map((answer) => answer.id)

                if (answerIds.length > 0) {
                    const answerSegments = await tx.answerSegment.findMany({
                        where: { answerId: { in: answerIds } },
                        select: { id: true },
                    })
                    const answerSegmentIds = answerSegments.map((segment) => segment.id)

                    await tx.grade.deleteMany({
                        where: {
                            OR: [
                                { answerId: { in: answerIds } },
                                { answerSegmentId: { in: answerSegmentIds } },
                            ],
                        },
                    })

                    await tx.answerSegment.deleteMany({
                        where: { answerId: { in: answerIds } },
                    })

                    await tx.answer.deleteMany({
                        where: { attemptId: { in: attemptIds } },
                    })
                }

                await tx.attempt.deleteMany({
                    where: { id: { in: attemptIds } },
                })
            }

            await tx.exam.update({
                where: { id: examId },
                data: { status: 'DRAFT' },
            })
        })

        const updated = await prisma.exam.findUnique({
            where: { id: examId },
        })

        logAudit({
            action: 'EXAM_UNPUBLISH',
            actorId: session.user.id,
            institutionId: session.user.institutionId,
            targetType: 'EXAM',
            targetId: examId,
            ipAddress: getClientIp(req),
        })

        return NextResponse.json({ success: true, exam: updated })
    } catch (error) {
        console.error('[Unpublish Exam] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
