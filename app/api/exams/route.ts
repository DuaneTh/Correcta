import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { getAllowedOrigins, getCsrfCookieToken, verifyCsrf } from "@/lib/csrf"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getExamPermissions } from "@/lib/exam-permissions"

interface SessionUser {
    id: string
    institutionId: string
    role: 'TEACHER' | 'STUDENT' | 'ADMIN' | string
}

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
                    studentTools: (question.studentTools ?? null) as Prisma.InputJsonValue,
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
                            levels: segment.rubric.levels as Prisma.InputJsonValue,
                            examples: (segment.rubric.examples ?? null) as Prisma.InputJsonValue,
                        },
                    })
                }
            }
        }
    }
}

export async function GET(req: Request) {
    try {
        // 1. Get Session
        // Note: We need to handle the institutionId cookie if we want to be strict, 
        // but for now we can rely on the session if it's already established.
        // However, buildAuthOptions needs institutionId to verify signature if using custom providers.
        // Let's try to get it from cookie or header if possible, or just use default.
        // Actually, for API routes, we should probably trust the session token.

        // Extract institutionId from cookie for buildAuthOptions
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions) as { user?: SessionUser } | null

        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // 2. Fetch Exams
        // Filter by institution and author if teacher
        const whereClause: {
            archivedAt?: null
            parentExamId?: null
            course: { institutionId: string; archivedAt?: null }
            authorId?: string
        } = {
            archivedAt: null,
            parentExamId: null,
            course: {
                institutionId: session.user.institutionId,
                archivedAt: null
            }
        }

        if (session.user.role === 'TEACHER') {
            whereClause.authorId = session.user.id
        }

        const exams = await prisma.exam.findMany({
            where: whereClause,
            include: {
                course: {
                    select: { code: true, name: true }
                },
                class: {
                    select: { id: true, name: true }
                },
                _count: {
                    select: { attempts: true, sections: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        // Fetch student counts for all classes involved
        const allClassIds = Array.from(
            new Set(
                exams.flatMap(e => [
                    ...(Array.isArray(e.classIds) ? e.classIds : []),
                    ...(e.classId ? [e.classId] : []),
                ])
            )
        )

        const classesWithCounts = await prisma.class.findMany({
            where: { id: { in: allClassIds }, archivedAt: null },
            select: {
                id: true,
                _count: {
                    select: {
                        enrollments: {
                            where: { role: 'STUDENT', user: { archivedAt: null } }
                        }
                    }
                }
            }
        })

        const classStudentCounts = new Map(
            classesWithCounts.map(c => [c.id, c._count.enrollments])
        )

        const examsWithCounts = exams.map(exam => {
            const hasVariantClass = Boolean(exam.classId)
            const hasTargetClasses = Array.isArray(exam.classIds) && exam.classIds.length > 0
            const studentCount = hasVariantClass
                ? (classStudentCounts.get(exam.classId as string) || 0)
                : hasTargetClasses
                    ? exam.classIds.reduce((sum, classId) => sum + (classStudentCounts.get(classId) || 0), 0)
                    : exam._count?.attempts ?? 0

            return {
                ...exam,
                studentCount,
                sectionCount: exam._count?.sections ?? 0
            }
        })

        return NextResponse.json(examsWithCounts)
    } catch (error) {
        console.error("[API] Get Exams Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions) as { user?: SessionUser } | null

        if (!session || !session.user || session.user.role === 'STUDENT') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const csrfResult = verifyCsrf({
            req,
            cookieToken: getCsrfCookieToken(req),
            headerToken: req.headers.get('x-csrf-token'),
            allowedOrigins: getAllowedOrigins()
        })
        if (!csrfResult.ok) {
            return NextResponse.json({ error: "CSRF" }, { status: 403 })
        }

        const body = (await req.json()) as {
            title?: string
            courseId?: string
            startAt?: string | null
            durationMinutes?: number | string | null
            status?: string
            classIds?: string[]
            sourceExamId?: string
        }
        const { title, courseId, startAt, durationMinutes, status, classIds, sourceExamId } = body

        if (!courseId || !title) {
            return NextResponse.json(
                { error: 'courseId and title are required' },
                { status: 400 }
            )
        }

        // Verify course belongs to user's institution
        const course = await prisma.course.findUnique({
            where: { id: courseId }
        })

        if (!course || course.archivedAt || course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Invalid course" }, { status: 400 })
        }

        let sourceExam: {
            id: string
            description: string | null
            requireHonorCommitment: boolean
            allowedMaterials: string | null
            antiCheatConfig: Prisma.JsonValue | null
            gradingConfig: Prisma.JsonValue | null
        } | null = null
        if (typeof sourceExamId === 'string' && sourceExamId.trim()) {
            const { exam: sourceExamPermission, canEdit } = await getExamPermissions(
                sourceExamId,
                {
                    id: session.user.id,
                    institutionId: session.user.institutionId,
                    role: session.user.role,
                }
            )
            if (!sourceExamPermission || !canEdit) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
            sourceExam = await prisma.exam.findUnique({
                where: { id: sourceExamId },
                select: {
                    id: true,
                    description: true,
                    requireHonorCommitment: true,
                    allowedMaterials: true,
                    antiCheatConfig: true,
                    gradingConfig: true,
                },
            })
            if (!sourceExam) {
                return NextResponse.json({ error: 'Source exam not found' }, { status: 404 })
            }
        }

        const trimmedTitle = String(title).trim()
        const isDraft = status === 'DRAFT'
        const finalStatus = isDraft ? 'DRAFT' : 'PUBLISHED'
        const normalizedDurationMinutes = durationMinutes != null ? Number(durationMinutes) : null

        // Si ce n’est PAS un brouillon, on exige date + durée
        if (!isDraft && (!startAt || normalizedDurationMinutes == null)) {
            return NextResponse.json(
                { error: 'startAt and durationMinutes are required unless status is DRAFT' },
                { status: 400 }
            )
        }

        const normalizedClassIds = Array.isArray(classIds)
            ? Array.from(new Set(classIds.filter((id) => typeof id === 'string' && id.trim().length > 0)))
            : []

        if (session.user.role === 'TEACHER') {
            const teacherEnrollments = await prisma.enrollment.findMany({
                where: {
                    userId: session.user.id,
                    role: 'TEACHER',
                    class: { courseId, archivedAt: null },
                },
                select: {
                    classId: true,
                    class: { select: { name: true } },
                },
            })
            const hasDefaultEnrollment = teacherEnrollments.some(
                (enrollment) => enrollment.class?.name === '__DEFAULT__'
            )
            const teacherClassIds = hasDefaultEnrollment
                ? new Set(
                    (await prisma.class.findMany({
                        where: { courseId, archivedAt: null },
                        select: { id: true },
                    })).map((cls) => cls.id)
                )
                : new Set(teacherEnrollments.map((enrollment) => enrollment.classId))
            const unauthorizedTargets = normalizedClassIds.filter((id) => !teacherClassIds.has(id))
            if (unauthorizedTargets.length > 0) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        }

        if (normalizedClassIds.length > 0) {
            const validClasses = await prisma.class.findMany({
                where: {
                    id: { in: normalizedClassIds },
                    courseId,
                    archivedAt: null,
                },
                select: { id: true },
            })
            const validIds = new Set(validClasses.map((cls) => cls.id))
            const invalidIds = normalizedClassIds.filter((id) => !validIds.has(id))
            if (invalidIds.length > 0) {
                return NextResponse.json(
                    { error: 'Invalid classIds for this course' },
                    { status: 400 }
                )
            }
        }

        const data: Record<string, unknown> = {
            courseId,
            title: trimmedTitle,
            authorId: session.user.id,
            antiCheatConfig: { webcam: false, screen: false },
            classIds: normalizedClassIds,
            startAt: isDraft ? null : new Date(startAt || Date.now()),
            durationMinutes: isDraft ? null : normalizedDurationMinutes,
            requireHonorCommitment: false,
        }

        if (finalStatus !== 'DRAFT') {
            data.status = finalStatus
        }

        if (sourceExam) {
            data.description = sourceExam.description
            data.requireHonorCommitment = sourceExam.requireHonorCommitment
            data.allowedMaterials = sourceExam.allowedMaterials
            data.antiCheatConfig = sourceExam.antiCheatConfig as Prisma.InputJsonValue
            data.gradingConfig = sourceExam.gradingConfig as Prisma.InputJsonValue
        }

        const exam = sourceExam
            ? await prisma.$transaction(async (tx) => {
                const created = await tx.exam.create({ data: data as Prisma.ExamCreateInput })
                await cloneExamContent(tx, sourceExam.id, created.id)
                return created
            })
            : await prisma.exam.create({ data: data as Prisma.ExamCreateInput })

        return NextResponse.json({ id: exam.id }, { status: 201 })
    } catch (error: unknown) {
        console.error('POST /api/exams error', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
