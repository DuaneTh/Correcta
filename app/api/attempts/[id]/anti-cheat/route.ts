import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { computeAntiCheatScore, analyzeCopyPasteEvents } from "@/lib/antiCheat"

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

        // Verify teacher belongs to same institution
        if (attempt.exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
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
