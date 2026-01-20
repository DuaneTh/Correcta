import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { getAllowedOrigins, getCsrfCookieName, verifyCsrf } from "@/lib/csrf"
import { generateRubric } from "@/lib/grading/rubric-generator"
import { segmentsToLatexString, parseContent } from "@/lib/content"
import { RubricSchema } from "@/lib/grading/schemas"
import type { ContentSegment } from "@/types/exams"

/**
 * GET /api/questions/[questionId]/rubric
 * Fetch existing rubric for a question
 * Auth: Teacher only
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ questionId: string }> }
) {
    try {
        const { questionId } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Fetch question with institution check
        const question = await prisma.question.findUnique({
            where: { id: questionId },
            include: {
                section: {
                    include: {
                        exam: {
                            include: { course: true }
                        }
                    }
                }
            }
        })

        if (!question || question.section.exam.archivedAt) {
            return NextResponse.json({ error: "Question not found" }, { status: 404 })
        }

        if (question.section.exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        return NextResponse.json({
            rubric: question.generatedRubric
        })

    } catch (error) {
        console.error("[API] Get Rubric Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

/**
 * POST /api/questions/[questionId]/rubric
 * Generate rubric for a question using AI
 * Auth: Teacher only, CSRF required
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ questionId: string }> }
) {
    try {
        const { questionId } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const csrfResult = verifyCsrf({
            req,
            cookieToken: req.cookies.get(getCsrfCookieName())?.value,
            headerToken: req.headers.get('x-csrf-token'),
            allowedOrigins: getAllowedOrigins()
        })
        if (!csrfResult.ok) {
            return NextResponse.json({ error: "CSRF" }, { status: 403 })
        }

        // Fetch question with segments and rubric info
        const question = await prisma.question.findUnique({
            where: { id: questionId },
            include: {
                segments: {
                    include: {
                        rubric: true
                    },
                    orderBy: { order: 'asc' }
                },
                section: {
                    include: {
                        exam: {
                            include: { course: true }
                        }
                    }
                }
            }
        })

        if (!question || question.section.exam.archivedAt) {
            return NextResponse.json({ error: "Question not found" }, { status: 404 })
        }

        if (question.section.exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // Convert question content to string
        const contentSegments = parseContent(question.content) as ContentSegment[]
        const questionContent = segmentsToLatexString(contentSegments)

        // Calculate max points from segments
        const maxPoints = question.segments.reduce(
            (sum, segment) => sum + (segment.maxPoints ?? 0),
            0
        )

        if (maxPoints <= 0) {
            return NextResponse.json({
                error: "Question has no points defined (add points to segments first)"
            }, { status: 400 })
        }

        // Get correction guidelines from segment rubrics
        const correctionGuidelines = question.segments
            .filter(s => s.rubric?.criteria)
            .map(s => s.rubric!.criteria)
            .filter(Boolean)
            .join('\n\n') || null

        // Generate rubric using AI
        const rubric = await generateRubric({
            questionContent,
            correctionGuidelines,
            maxPoints
        })

        // Store generated rubric in question
        const updated = await prisma.question.update({
            where: { id: questionId },
            data: {
                generatedRubric: rubric
            }
        })

        return NextResponse.json({
            success: true,
            rubric: updated.generatedRubric
        })

    } catch (error) {
        console.error("[API] Generate Rubric Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

/**
 * PUT /api/questions/[questionId]/rubric
 * Update/edit rubric manually
 * Auth: Teacher only, CSRF required
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ questionId: string }> }
) {
    try {
        const { questionId } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const csrfResult = verifyCsrf({
            req,
            cookieToken: req.cookies.get(getCsrfCookieName())?.value,
            headerToken: req.headers.get('x-csrf-token'),
            allowedOrigins: getAllowedOrigins()
        })
        if (!csrfResult.ok) {
            return NextResponse.json({ error: "CSRF" }, { status: 403 })
        }

        // Fetch question with institution check
        const question = await prisma.question.findUnique({
            where: { id: questionId },
            include: {
                section: {
                    include: {
                        exam: {
                            include: { course: true }
                        }
                    }
                }
            }
        })

        if (!question || question.section.exam.archivedAt) {
            return NextResponse.json({ error: "Question not found" }, { status: 404 })
        }

        if (question.section.exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        const body = await req.json()
        const { rubric } = body

        if (!rubric) {
            return NextResponse.json({ error: "Missing rubric in request body" }, { status: 400 })
        }

        // Validate rubric format
        const parseResult = RubricSchema.safeParse(rubric)
        if (!parseResult.success) {
            return NextResponse.json({
                error: "Invalid rubric format",
                details: parseResult.error.issues
            }, { status: 400 })
        }

        // Update rubric
        const updated = await prisma.question.update({
            where: { id: questionId },
            data: {
                generatedRubric: parseResult.data
            }
        })

        return NextResponse.json({
            success: true,
            rubric: updated.generatedRubric
        })

    } catch (error) {
        console.error("[API] Update Rubric Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
