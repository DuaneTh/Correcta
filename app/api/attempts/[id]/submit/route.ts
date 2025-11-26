import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isStudent } from "@/lib/api-auth"

// POST /api/attempts/[id]/submit - Submit exam attempt
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user || !isStudent(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const attempt = await prisma.attempt.findUnique({
            where: { id },
            include: {
                exam: true
            }
        })

        if (!attempt) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
        }

        if (attempt.studentId !== session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        if (attempt.status !== 'IN_PROGRESS') {
            return NextResponse.json({ error: "Attempt already submitted" }, { status: 400 })
        }

        // Check time window with 60-second grace period for submit
        // This allows auto-submit to succeed even if there's a small network delay
        const now = new Date()
        const gracePeriodSeconds = 60

        if (now < attempt.exam.startAt) {
            return NextResponse.json({ error: "Exam has not started yet" }, { status: 400 })
        }

        if (attempt.exam.endAt) {
            const endAtWithGrace = new Date(attempt.exam.endAt.getTime() + gracePeriodSeconds * 1000)
            if (now > endAtWithGrace) {
                return NextResponse.json({ error: "Exam has ended, submission not allowed" }, { status: 400 })
            }
        }

        // Update attempt status
        const updatedAttempt = await prisma.attempt.update({
            where: { id },
            data: {
                status: 'SUBMITTED',
                submittedAt: new Date()
            }
        })

        // TODO: Trigger grading task creation (async processing)

        return NextResponse.json({ success: true, attempt: updatedAttempt })

    } catch (error) {
        console.error("[API] Submit Attempt Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
