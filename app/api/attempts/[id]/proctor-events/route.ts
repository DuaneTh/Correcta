import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isStudent } from "@/lib/api-auth"
import { ProctorEventType } from "@prisma/client"

// POST /api/attempts/[id]/proctor-events - Log anti-cheat event
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
            where: { id }
        })

        if (!attempt) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
        }

        if (attempt.studentId !== session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        const body = await req.json()
        const { type, metadata } = body

        if (!type) {
            return NextResponse.json({ error: "Missing event type" }, { status: 400 })
        }

        // Validate event type
        if (!Object.values(ProctorEventType).includes(type)) {
            return NextResponse.json({ error: "Invalid event type" }, { status: 400 })
        }

        // Create proctor event
        const event = await prisma.proctorEvent.create({
            data: {
                attemptId: id,
                type: type as ProctorEventType,
                metadata: metadata || {},
                timestamp: new Date()
            }
        })

        return NextResponse.json({ success: true, event })

    } catch (error) {
        console.error("[API] Log Proctor Event Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
