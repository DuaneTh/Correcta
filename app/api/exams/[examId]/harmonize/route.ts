import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { getAllowedOrigins, getCsrfCookieToken, verifyCsrf } from "@/lib/csrf"

/**
 * POST /api/exams/[examId]/harmonize
 *
 * Apply grade harmonization to all graded attempts for an exam.
 * Stores original scores in harmonization history before applying changes.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { examId } = await params
        const session = await getAuthSession(req)

        // 1. Auth check: Teacher only
        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // 2. CSRF check
        const csrfResult = verifyCsrf({
            req,
            cookieToken: getCsrfCookieToken(req),
            headerToken: req.headers.get('x-csrf-token'),
            allowedOrigins: getAllowedOrigins()
        })
        if (!csrfResult.ok) {
            return NextResponse.json({ error: "CSRF" }, { status: 403 })
        }

        // 3. Verify teacher has access to exam
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                course: {
                    select: { institutionId: true }
                }
            }
        })

        if (!exam) {
            return NextResponse.json({ error: "Exam not found" }, { status: 404 })
        }

        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // 4. Parse request body
        const body = await req.json()
        const { method, params: methodParams, scores } = body as {
            method: string
            params: Record<string, number>
            scores: Array<{ attemptId: string; newScore: number }>
        }

        if (!method || !scores || !Array.isArray(scores)) {
            return NextResponse.json({
                error: "Missing required fields: method, scores"
            }, { status: 400 })
        }

        // 5. Get all graded attempts for this exam with their current scores
        const attempts = await prisma.attempt.findMany({
            where: {
                examId,
                status: 'GRADED'
            },
            include: {
                answers: {
                    include: {
                        grades: true
                    }
                }
            }
        })

        if (attempts.length === 0) {
            return NextResponse.json({
                error: "No graded attempts found"
            }, { status: 400 })
        }

        // 6. Create harmonization history record
        const harmonizationRecord = await prisma.harmonizationHistory.create({
            data: {
                examId,
                method,
                params: methodParams,
                appliedBy: session.user.id,
                appliedAt: new Date()
            }
        })

        // 7. Apply score changes
        let updatedCount = 0
        const errors: string[] = []

        for (const scoreUpdate of scores) {
            const attempt = attempts.find(a => a.id === scoreUpdate.attemptId)
            if (!attempt) {
                errors.push(`Attempt ${scoreUpdate.attemptId} not found`)
                continue
            }

            // Calculate current total score
            const currentTotalScore = attempt.answers.reduce((sum, answer) => {
                const grade = answer.grades[0]
                return sum + (grade?.score || 0)
            }, 0)

            // Calculate the adjustment ratio
            // We'll apply the same ratio to all grades in this attempt
            if (currentTotalScore === 0 && scoreUpdate.newScore > 0) {
                // Can't scale from 0, skip
                errors.push(`Attempt ${scoreUpdate.attemptId}: cannot scale from 0`)
                continue
            }

            const ratio = currentTotalScore > 0
                ? scoreUpdate.newScore / currentTotalScore
                : 1

            // Store original scores and update each grade
            for (const answer of attempt.answers) {
                const grade = answer.grades[0]
                if (!grade) continue

                const originalScore = grade.score
                const newScore = Math.round(originalScore * ratio * 100) / 100

                // Store original score in harmonization detail
                await prisma.harmonizationDetail.create({
                    data: {
                        harmonizationId: harmonizationRecord.id,
                        gradeId: grade.id,
                        originalScore,
                        newScore
                    }
                })

                // Update the grade
                await prisma.grade.update({
                    where: { id: grade.id },
                    data: {
                        score: newScore,
                        isHarmonized: true
                    }
                })
            }

            updatedCount++
        }

        // 8. Update harmonization record with results
        await prisma.harmonizationHistory.update({
            where: { id: harmonizationRecord.id },
            data: {
                attemptsAffected: updatedCount
            }
        })

        return NextResponse.json({
            success: true,
            harmonizationId: harmonizationRecord.id,
            updatedCount,
            errors: errors.length > 0 ? errors : undefined
        })

    } catch (error) {
        console.error("[API] Harmonization Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

/**
 * GET /api/exams/[examId]/harmonize
 *
 * Get harmonization history for an exam
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { examId } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                course: {
                    select: { institutionId: true }
                }
            }
        })

        if (!exam) {
            return NextResponse.json({ error: "Exam not found" }, { status: 404 })
        }

        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        const history = await prisma.harmonizationHistory.findMany({
            where: { examId },
            orderBy: { appliedAt: 'desc' },
            include: {
                appliedByUser: {
                    select: { name: true, email: true }
                }
            }
        })

        return NextResponse.json({ history })

    } catch (error) {
        console.error("[API] Get Harmonization History Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
