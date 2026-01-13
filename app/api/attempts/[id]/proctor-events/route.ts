import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isStudent } from "@/lib/api-auth"
import { ProctorEventType } from "@prisma/client"
import { canAccessAttemptAction } from "@/lib/attemptPermissions"
import { getAttemptAuthContext } from "@/lib/attempt-access"
import { buildRateLimitResponse, rateLimit } from "@/lib/rateLimit"
import { getAllowedOrigins, getCsrfCookieName, verifyCsrf } from "@/lib/csrf"
import { ensureIdempotency, verifyAttemptNonce } from "@/lib/attemptIntegrity"

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

        const csrfResult = verifyCsrf({
            req,
            cookieToken: req.cookies.get(getCsrfCookieName())?.value,
            headerToken: req.headers.get('x-csrf-token'),
            allowedOrigins: getAllowedOrigins()
        })
        if (!csrfResult.ok) {
            return NextResponse.json({ error: "CSRF" }, { status: 403 })
        }

        const rateLimitOptions = { windowSeconds: 60, max: 120, prefix: 'attempt_proctor' }
        try {
            const limit = await rateLimit(`${session.user.id}:${id}`, rateLimitOptions)
            if (!limit.ok) {
                const limited = buildRateLimitResponse(limit, rateLimitOptions)
                return NextResponse.json(limited.body, { status: limited.status, headers: limited.headers })
            }
        } catch {
            return NextResponse.json({ error: "RATE_LIMIT_UNAVAILABLE" }, { status: 503 })
        }

        const attemptAuth = await getAttemptAuthContext(id)
        if (!attemptAuth) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
        }

        const isAllowed = canAccessAttemptAction('writeProctorEvents', {
            sessionUser: {
                id: session.user.id,
                role: session.user.role,
                institutionId: session.user.institutionId
            },
            attemptStudentId: attemptAuth.studentId,
            attemptInstitutionId: attemptAuth.institutionId,
            teacherCanAccess: false
        })

        if (!isAllowed) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
        }

        const requestId = req.headers.get('x-request-id')
        if (!requestId || requestId.length < 8 || requestId.length > 128) {
            return NextResponse.json({ error: "INTEGRITY" }, { status: 403 })
        }

        const nonceResult = await verifyAttemptNonce(id, req.headers.get('x-attempt-nonce'))
        if (!nonceResult.ok) {
            return NextResponse.json({ error: "INTEGRITY" }, { status: 403 })
        }
        const idempotency = await ensureIdempotency(id, requestId, 'proctor')
        if (!idempotency.first) {
            return NextResponse.json({ success: true, replay: true })
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
