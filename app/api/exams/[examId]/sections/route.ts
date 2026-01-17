import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { getAllowedOrigins, getCsrfCookieToken, verifyCsrf } from "@/lib/csrf"
import { prisma } from "@/lib/prisma"
import { getExamPermissions } from "@/lib/exam-permissions"
import { safeJson } from "@/lib/logging"
import { Prisma } from "@prisma/client"

type ExamParams = { examId?: string }

const resolveExamId = (req: Request, params: ExamParams) => {
    const paramExamId = params?.examId
    const urlExamId = (() => {
        try {
            const path = new URL(req.url).pathname
            const parts = path.split('/').filter(Boolean)
            // .../exams/:examId/sections
            return parts[parts.length - 2]
        } catch {
            return undefined
        }
    })()
    const examId = paramExamId && paramExamId !== 'undefined' && paramExamId !== 'null' ? paramExamId : urlExamId
    return examId
}

export async function GET(req: Request, { params }: { params: Promise<ExamParams> }) {
    try {
        const resolvedParams = await params
        const examId = resolveExamId(req, resolvedParams)
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

        // Verify exam belongs to user's institution
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: { course: true }
        })

        if (!exam || exam.archivedAt || exam.course.archivedAt) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (exam.course.institutionId !== session.user.institutionId) {
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

        const sections = await prisma.examSection.findMany({
            where: { examId },
            orderBy: { order: 'asc' }
        })

        return NextResponse.json(sections)
    } catch (error) {
        console.error("[API] Get Sections Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function POST(req: Request, { params }: { params: Promise<ExamParams> }) {
    try {
        const resolvedParams = await params
        const examId = resolveExamId(req, resolvedParams)
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

        // Verify exam belongs to user's institution
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: { course: true }
        })

        if (!exam || exam.archivedAt || exam.course.archivedAt) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // Allow edits during live exams; changes will be tracked separately.

        let body: unknown
        try {
            body = await req.json()
        } catch (parseError) {
            console.error("[API] Create Section - Failed to parse request body:", parseError)
            return NextResponse.json({ 
                error: "Invalid request body" 
            }, { status: 400 })
        }
        
        const { title, order, customLabel, afterQuestionId, afterSectionId, isDefault } = (body ?? {}) as {
            title?: string
            order?: number
            customLabel?: string | null
            afterQuestionId?: string | null
            afterSectionId?: string | null
            isDefault?: boolean
        }

        console.log("[API] Create Section", safeJson({
            examId,
            userId: session.user.id,
            hasAfterSectionId: Boolean(afterSectionId),
            hasAfterQuestionId: Boolean(afterQuestionId)
        }))

        if (title === undefined || title === null) {
            return NextResponse.json({ error: "Missing title" }, { status: 400 })
        }

        const sectionDataBase = {
            examId,
            title,
            customLabel: customLabel && customLabel.trim() !== '' ? customLabel : undefined,
            isDefault: Boolean(isDefault),
        }

        if (afterSectionId && !afterQuestionId) {
            const created = await prisma.$transaction(async (tx) => {
                const refSection = await tx.examSection.findUnique({
                    where: { id: afterSectionId },
                })

                if (!refSection || refSection.examId !== examId) {
                    throw new Error("Invalid reference section")
                }

                const refOrder = refSection.order
                const sectionsToShift = await tx.examSection.findMany({
                    where: { examId, order: { gte: refOrder + 1 } },
                    orderBy: { order: 'desc' },
                    select: { id: true, order: true },
                })

                for (const s of sectionsToShift) {
                    await tx.examSection.update({
                        where: { id: s.id },
                        data: { order: s.order + 1 },
                    })
                }

                const mainSection = await tx.examSection.create({
                    data: {
                        ...sectionDataBase,
                        order: refOrder + 1,
                    },
                })

                return { section: mainSection }
            })

            console.log("[API] Create Section - Success (afterSectionId)")
            return NextResponse.json(created)
        }

        if (!afterQuestionId) {
            const sectionData: {
                examId: string
                title: string
                order: number
                customLabel?: string
            } = {
                ...sectionDataBase,
                order: order ?? 0,
            }

            const section = await prisma.examSection.create({
                data: sectionData
            })

            console.log("[API] Create Section - Success (no afterQuestionId)")
            return NextResponse.json(section)
        }

        // Insert section relative to an existing question
        const created = await prisma.$transaction(async (tx) => {
            const referenceQuestion = await tx.question.findUnique({
                where: { id: afterQuestionId },
                include: {
                    section: true,
                },
            })

            if (!referenceQuestion || referenceQuestion.section.examId !== examId) {
                throw new Error("Invalid reference question")
            }

            const refSection = referenceQuestion.section
            const refOrder = refSection.order
            const isDefaultStandalone = refSection.isDefault && !refSection.customLabel && !refSection.title

            // Determine if we need to split a default standalone section
            let splitDefault = false
            let tailQuestions: { id: string; order: number }[] = []

            if (isDefaultStandalone) {
                const questionsInSection = await tx.question.findMany({
                    where: { sectionId: refSection.id },
                    orderBy: { order: 'asc' },
                    select: { id: true, order: true },
                })
                const idx = questionsInSection.findIndex((q) => q.id === afterQuestionId)
                if (idx !== -1 && idx < questionsInSection.length - 1) {
                    splitDefault = true
                    tailQuestions = questionsInSection.slice(idx + 1)
                }
            }

            const shiftAmount = splitDefault ? 2 : 1

            // Shift subsequent sections to make room
            const sectionsToShift = await tx.examSection.findMany({
                where: { examId, order: { gte: refOrder + 1 } },
                orderBy: { order: 'desc' },
                select: { id: true, order: true },
            })

            for (const s of sectionsToShift) {
                await tx.examSection.update({
                    where: { id: s.id },
                    data: { order: s.order + shiftAmount },
                })
            }

            const mainSection = await tx.examSection.create({
                data: {
                    ...sectionDataBase,
                    order: refOrder + 1,
                },
            })

            let newTailDefault: typeof mainSection | null = null

            if (splitDefault && tailQuestions.length > 0) {
                newTailDefault = await tx.examSection.create({
                    data: {
                        examId,
                        title: '',
                        order: refOrder + 2,
                        isDefault: true,
                    },
                })

                for (const q of tailQuestions) {
                    await tx.question.update({
                        where: { id: q.id },
                        data: {
                            sectionId: newTailDefault.id,
                            order: q.order, // preserve relative order
                        },
                    })
                }
            }

            return { section: mainSection, splitDefault, newTailDefault }
        })

        console.log("[API] Create Section - Success (afterQuestionId)")
        return NextResponse.json(created)
    } catch (error: unknown) {
        const isKnownPrismaError = error instanceof Prisma.PrismaClientKnownRequestError
        const errorCode = isKnownPrismaError ? error.code : undefined
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error'

        console.error('[API] Create Section Error', {
            name: error instanceof Error ? error.name : 'UnknownError',
            code: errorCode,
            message: errorMessage,
        })

        let responseMessage = 'Internal Server Error'
        if (isKnownPrismaError) {
            if (errorCode === 'P2002') {
                responseMessage = 'A section with this configuration already exists'
            } else if (errorCode === 'P2003') {
                responseMessage = 'Invalid exam reference'
            } else if (errorCode) {
                responseMessage = `Database error: ${errorCode}`
            }
        } else if (errorMessage) {
            responseMessage = errorMessage
        }

        return NextResponse.json(
            { error: responseMessage },
            { status: 500 }
        )
    }
}
