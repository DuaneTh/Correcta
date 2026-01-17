import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { getAllowedOrigins, getCsrfCookieToken, verifyCsrf } from "@/lib/csrf"
import { prisma } from "@/lib/prisma"
import { parseContent } from "@/lib/content"
import { getExamPermissions } from "@/lib/exam-permissions"
import { assertExamVariantShape, getDraftVariantsForBaseExam } from "@/lib/exam-variants"
import { safeJson } from "@/lib/logging"

const resolveCourseTeacherName = (course: {
    classes?: Array<{
        enrollments?: Array<{ user?: { name?: string | null } | null }>
    }>
}) =>
    course.classes
        ?.flatMap((cls) => cls.enrollments ?? [])
        .map((enrollment) => enrollment.user?.name)
        .find(Boolean) ?? null

type ExamParams = { examId?: string }

const mapExamContent = <T extends { sections: Array<{ questions: Array<{ content: unknown; answerTemplate?: unknown }> }> }>(
    exam: T
) => ({
    ...exam,
    sections: exam.sections.map((section) => ({
        ...section,
        questions: section.questions.map((question) => ({
            ...question,
            content: parseContent(question.content),
            answerTemplate: parseContent(question.answerTemplate),
        })),
    })),
})

export async function GET(req: Request, { params }: { params: Promise<ExamParams> }) {
    try {
        const resolvedParams = await params
        const paramExamId = resolvedParams?.examId
        const urlExamId = (() => {
            try {
                const path = new URL(req.url).pathname
                const parts = path.split('/').filter(Boolean)
                return parts[parts.length - 1]
            } catch {
                return undefined
            }
        })()
        const examId = paramExamId && paramExamId !== 'undefined' && paramExamId !== 'null' ? paramExamId : urlExamId
        if (!examId) {
            return NextResponse.json({ error: "Invalid exam id" }, { status: 400 })
        }
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions)

        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                course: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        institutionId: true,
                        archivedAt: true,
                        classes: {
                            where: { archivedAt: null },
                            select: {
                                enrollments: {
                                    where: { role: 'TEACHER', user: { archivedAt: null } },
                                    select: {
                                        user: { select: { name: true } }
                                    }
                                }
                            }
                        }
                    }
                },
                class: {
                    select: {
                        id: true,
                        name: true,
                        archivedAt: true,
                    },
                },
                variants: {
                    where: { archivedAt: null },
                    select: {
                        id: true,
                        classId: true,
                        startAt: true,
                        endAt: true,
                        durationMinutes: true,
                        status: true,
                        class: {
                            select: {
                                id: true,
                                name: true,
                                archivedAt: true,
                            },
                        },
                    },
                },
                sections: {
                    include: {
                        questions: {
                            include: {
                                segments: {
                                    include: {
                                        rubric: true
                                    },
                                    orderBy: { order: 'asc' }
                                }
                            },
                            orderBy: { order: 'asc' }
                        }
                    },
                    orderBy: { order: 'asc' }
                },
                changes: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        })

        if (!exam || exam.archivedAt || exam.course.archivedAt || exam.class?.archivedAt) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        assertExamVariantShape(exam, { context: 'api-exams-get' })

        // Authorization check
        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // Students should not see DRAFT exams or exams without valid duration/start date
        if (session.user.role === 'STUDENT') {
            const hasValidDuration = exam.durationMinutes !== null && exam.durationMinutes > 0
            const hasValidStartDate = exam.startAt !== null && exam.startAt > new Date('2000-01-01')
            if (exam.status === 'DRAFT' || !hasValidDuration || !hasValidStartDate) {
                return NextResponse.json({ error: "Not found" }, { status: 404 })
            }
        }

        const courseTeacherName = resolveCourseTeacherName(exam.course)
        const mapped = mapExamContent(exam)
        const draftVariants =
            exam.parentExamId == null && exam.classId == null
                ? await getDraftVariantsForBaseExam(exam.id)
                : []
        return NextResponse.json({
            ...mapped,
            classId: exam.classId ?? null,
            className: exam.class?.name ?? null,
            parentExamId: exam.parentExamId ?? null,
            variants: exam.variants
                .filter((variant) => !variant.class?.archivedAt)
                .map((variant) => ({
                id: variant.id,
                classId: variant.classId,
                className: variant.class?.name ?? null,
                startAt: variant.startAt ? variant.startAt.toISOString() : null,
                endAt: variant.endAt ? variant.endAt.toISOString() : null,
                durationMinutes: variant.durationMinutes ?? null,
                status: variant.status,
            })),
            course: {
                id: exam.course.id,
                code: exam.course.code,
                name: exam.course.name,
                teacherName: courseTeacherName ?? null,
                institutionId: exam.course.institutionId
            },
            courseId: exam.course.id,
            changes: exam.changes.map((change) => ({
                ...change,
                createdAt: change.createdAt.toISOString(),
            })),
            draftVariantsCount: draftVariants.length,
            draftVariantsBySection: draftVariants,
        })
    } catch (error) {
        console.error("[API] Get Exam Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function PUT(req: Request, { params }: { params: Promise<ExamParams> }) {
    let updateData: Record<string, unknown> = {}
    try {
        // Resolve examId safely (params in turbopack may be undefined)
        const resolvedParams = await params
        const { examId: paramExamId } = resolvedParams || { examId: undefined }
        const urlExamId = (() => {
            try {
                const path = new URL(req.url).pathname
                const parts = path.split('/').filter(Boolean)
                return parts[parts.length - 1]
            } catch {
                return undefined
            }
        })()
        const examId = paramExamId && paramExamId !== 'undefined' && paramExamId !== 'null' ? paramExamId : urlExamId
        if (!examId || examId === 'undefined' || examId === 'null') {
            return NextResponse.json({ error: "Invalid exam id" }, { status: 400 })
        }

        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions)

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

        const body = await req.json()

        // Validate ownership before update
        const existingExam = await prisma.exam.findUnique({
            where: { id: examId },
            include: { course: true }
        })

        if (!existingExam || existingExam.archivedAt || existingExam.course.archivedAt || existingExam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        const { canEdit } = await getExamPermissions(examId, {
            id: session.user.id,
            institutionId: session.user.institutionId,
            role: session.user.role,
        })
        if (!canEdit) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        // Allow edits during live exams; changes will be tracked separately.

        updateData = {}
        if (body.title !== undefined) updateData.title = body.title
        if (body.startAt !== undefined) updateData.startAt = body.startAt ? new Date(body.startAt) : null
        if (body.durationMinutes !== undefined) updateData.durationMinutes = body.durationMinutes ? parseInt(body.durationMinutes) : null
        if (body.requireHonorCommitment !== undefined) updateData.requireHonorCommitment = body.requireHonorCommitment
        if (body.allowedMaterials !== undefined) updateData.allowedMaterials = body.allowedMaterials
        if (body.antiCheatConfig !== undefined) updateData.antiCheatConfig = body.antiCheatConfig
        if (body.gradingConfig !== undefined) updateData.gradingConfig = body.gradingConfig

        const fieldNames = Object.keys(updateData)
        if (fieldNames.length === 0) {
            return NextResponse.json({ error: "No fields to update" }, { status: 400 })
        }

        console.log("[API] Update Exam", safeJson({
            examId,
            userId: session.user.id,
            fieldNames,
            fieldCount: fieldNames.length
        }))

        try {
            const updatedExam = await prisma.exam.update({
                where: { id: examId },
                data: updateData,
                include: {
                    course: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                            institutionId: true,
                            archivedAt: true,
                            classes: {
                                where: { archivedAt: null },
                                select: {
                                    enrollments: {
                                        where: { role: 'TEACHER', user: { archivedAt: null } },
                                        select: {
                                            user: { select: { name: true } }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    class: {
                        select: {
                            id: true,
                            name: true,
                            archivedAt: true,
                        },
                    },
                    variants: {
                        where: { archivedAt: null },
                        select: {
                            id: true,
                            classId: true,
                            startAt: true,
                            endAt: true,
                            durationMinutes: true,
                            status: true,
                            class: {
                                select: {
                                    id: true,
                                    name: true,
                                    archivedAt: true,
                                },
                            },
                        },
                    },
                    sections: {
                        include: {
                            questions: {
                                include: {
                                    segments: {
                                        include: { rubric: true },
                                        orderBy: { order: 'asc' }
                                    }
                                },
                                orderBy: [{ order: 'asc' }, { id: 'asc' }]
                            }
                        },
                        orderBy: { order: 'asc' }
                    },
                    changes: {
                        orderBy: { createdAt: 'desc' }
                    }
                }
            })

            console.log("[API] Update Exam - Success")
            const { logExamChanges } = await import("@/lib/exam-change")
            const examChanges: Array<Parameters<typeof logExamChanges>[1][number]> = []
            if (body.title !== undefined) {
                examChanges.push({
                    examId,
                    entityType: 'EXAM',
                    entityId: examId,
                    entityLabel: existingExam.title,
                    field: 'title',
                    beforeValue: existingExam.title,
                    afterValue: body.title,
                    createdById: session.user.id,
                })
            }
            if (body.allowedMaterials !== undefined) {
                examChanges.push({
                    examId,
                    entityType: 'EXAM',
                    entityId: examId,
                    entityLabel: existingExam.title,
                    field: 'allowedMaterials',
                    beforeValue: existingExam.allowedMaterials ?? null,
                    afterValue: body.allowedMaterials ?? null,
                    createdById: session.user.id,
                })
            }
            if (body.requireHonorCommitment !== undefined) {
                examChanges.push({
                    examId,
                    entityType: 'EXAM',
                    entityId: examId,
                    entityLabel: existingExam.title,
                    field: 'requireHonorCommitment',
                    beforeValue: existingExam.requireHonorCommitment,
                    afterValue: body.requireHonorCommitment,
                    createdById: session.user.id,
                })
            }
            await logExamChanges({ status: existingExam.status, startAt: existingExam.startAt }, examChanges)
            assertExamVariantShape(updatedExam, { context: 'api-exams-put' })
            const courseTeacherName = resolveCourseTeacherName(updatedExam.course)
            const mapped = mapExamContent(updatedExam)
            const draftVariants =
                updatedExam.parentExamId == null && updatedExam.classId == null
                    ? await getDraftVariantsForBaseExam(updatedExam.id)
                    : []
            return NextResponse.json({
                ...mapped,
                classId: updatedExam.classId ?? null,
                className: updatedExam.class?.name ?? null,
                parentExamId: updatedExam.parentExamId ?? null,
                variants: updatedExam.variants
                    .filter((variant) => !variant.class?.archivedAt)
                    .map((variant) => ({
                    id: variant.id,
                    classId: variant.classId,
                    className: variant.class?.name ?? null,
                    startAt: variant.startAt ? variant.startAt.toISOString() : null,
                    endAt: variant.endAt ? variant.endAt.toISOString() : null,
                    durationMinutes: variant.durationMinutes ?? null,
                    status: variant.status,
                })),
                course: {
                    id: updatedExam.course.id,
                    code: updatedExam.course.code,
                    name: updatedExam.course.name,
                    teacherName: courseTeacherName ?? null,
                    institutionId: updatedExam.course.institutionId
                },
                courseId: updatedExam.course.id,
                changes: updatedExam.changes.map((change) => ({
                    ...change,
                    createdAt: change.createdAt.toISOString(),
                })),
                draftVariantsCount: draftVariants.length,
                draftVariantsBySection: draftVariants,
            })
        } catch (prismaError: unknown) {
            console.error("[API] Prisma Update Error:", prismaError)
            // Re-throw to be caught by outer catch block
            throw prismaError
        }
    } catch (error: unknown) {
        console.error("[API] Update Exam Error:", error)
        console.error("[API] Update Exam Error Details:", {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            code: (error as any)?.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (error as any)?.message,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            meta: (error as any)?.meta,
            updateData
        })
        // Check if it's a Prisma error about unknown field
        const errorCode = (error as { code?: string; message?: string })?.code
        const errorMessage = (error as { message?: string })?.message
        if (
            errorCode === 'P2009' ||
            errorCode === 'P2011' ||
            errorMessage?.includes('Unknown argument') ||
            errorMessage?.includes('Unknown field') ||
            errorMessage?.includes('does not exist')
        ) {
            const fieldName = Object.keys(updateData)[0] || 'a field'
            return NextResponse.json({ 
                error: `Database schema mismatch: The ${fieldName} field may not exist. Please run database migrations.` 
            }, { status: 500 })
        }
        return NextResponse.json({ 
            error: errorMessage || "Internal Server Error" 
        }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<ExamParams> }) {
    try {
        const resolvedParams = await params
        const paramExamId = resolvedParams?.examId
        const urlExamId = (() => {
            try {
                const path = new URL(req.url).pathname
                const parts = path.split('/').filter(Boolean)
                return parts[parts.length - 1]
            } catch {
                return undefined
            }
        })()
        const examId = paramExamId && paramExamId !== 'undefined' && paramExamId !== 'null' ? paramExamId : urlExamId
        if (!examId) {
            return NextResponse.json({ error: "Invalid exam id" }, { status: 400 })
        }
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions)

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

        const existingExam = await prisma.exam.findUnique({
            where: { id: examId },
            include: { course: true }
        })

        if (!existingExam || existingExam.archivedAt || existingExam.course.archivedAt || existingExam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        const { canEdit } = await getExamPermissions(examId, {
            id: session.user.id,
            institutionId: session.user.institutionId,
            role: session.user.role,
        })
        if (!canEdit) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const examIdsToArchive = [examId]
        if (!existingExam.parentExamId) {
            const variants = await prisma.exam.findMany({
                where: { parentExamId: examId },
                select: { id: true },
            })
            examIdsToArchive.push(...variants.map((variant) => variant.id))
        }

        await prisma.exam.updateMany({
            where: { id: { in: examIdsToArchive } },
            data: { archivedAt: new Date() }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[API] Delete Exam Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
