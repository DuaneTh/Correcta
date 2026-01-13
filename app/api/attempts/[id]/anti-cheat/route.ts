import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { computeAntiCheatScore, analyzeCopyPasteEvents } from "@/lib/antiCheat"
import { canAccessAttemptAction } from "@/lib/attemptPermissions"
import { getAttemptAuthContext, getTeacherAccessForAttempt } from "@/lib/attempt-access"

// GET /api/attempts/[id]/anti-cheat - Get anti-cheat summary for a single attempt
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const attemptAuth = await getAttemptAuthContext(id)
        if (!attemptAuth) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
        }

        const teacherCanAccess = await getTeacherAccessForAttempt(attemptAuth.examId, {
            id: session.user.id,
            role: session.user.role,
            institutionId: session.user.institutionId
        })

        const isAllowed = canAccessAttemptAction('viewAntiCheat', {
            sessionUser: {
                id: session.user.id,
                role: session.user.role,
                institutionId: session.user.institutionId
            },
            attemptStudentId: attemptAuth.studentId,
            attemptInstitutionId: attemptAuth.institutionId,
            teacherCanAccess
        })

        if (!isAllowed) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
        }

        // Fetch attempt with proctor events and exam/course for auth check
        const attempt = await prisma.attempt.findUnique({
            where: { id },
            include: {
                proctorEvents: {
                    select: {
                        type: true,
                        timestamp: true,
                        metadata: true
                    },
                    orderBy: {
                        timestamp: 'asc'
                    }
                },
                exam: {
                    include: {
                        course: {
                            select: { institutionId: true, archivedAt: true }
                        }
                    }
                }
            }
        })

        if (!attempt || attempt.exam.archivedAt || attempt.exam.course.archivedAt) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
        }

        // Count events by type
        const eventCounts: Record<string, number> = {
            FOCUS_LOST: 0,
            FOCUS_GAINED: 0,
            TAB_SWITCH: 0,
            FULLSCREEN_EXIT: 0,
            COPY: 0,
            PASTE: 0
        }

        attempt.proctorEvents.forEach(event => {
            if (eventCounts.hasOwnProperty(event.type)) {
                eventCounts[event.type]++
            } else {
                eventCounts[event.type] = 1
            }
        })

        // Analyze COPY→PASTE pairs using shared helper
        const copyPasteAnalysis = analyzeCopyPasteEvents(attempt.proctorEvents)

        // Calculate antiCheatScore using shared helper
        const antiCheatScore = computeAntiCheatScore({
            eventCounts,
            copyPasteAnalysis
        })

        return NextResponse.json({
            antiCheatScore,
            eventCounts,
            totalEvents: attempt.proctorEvents.length,
            copyPasteAnalysis
        })

    } catch (error) {
        console.error("[API] Get Anti-Cheat Summary Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
