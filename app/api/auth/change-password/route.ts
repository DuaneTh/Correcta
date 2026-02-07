import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getAuthSession } from '@/lib/api-auth'
import { getAllowedOrigins, getCsrfCookieName, verifyCsrf } from '@/lib/csrf'
import { rateLimit, getClientIdentifier, getRateLimitHeaders, getRetryAfterSeconds } from '@/lib/rateLimit'
import { parseBody } from '@/lib/api-validation'
import { changePasswordSchema } from '@/lib/schemas/auth'
import { logAudit, getClientIp } from '@/lib/audit'

const RL_OPTS = { windowSeconds: 60, max: 5, prefix: 'change_password' } as const

// POST /api/auth/change-password
export async function POST(req: NextRequest) {
    try {
        // 1. Rate limit: 5 attempts per 60s
        const rl = await rateLimit(getClientIdentifier(req), RL_OPTS)
        if (!rl.ok) {
            const headers = getRateLimitHeaders(rl, RL_OPTS)
            headers['Retry-After'] = String(getRetryAfterSeconds(rl))
            return NextResponse.json(
                { error: 'Too many requests' },
                { status: 429, headers }
            )
        }

        // 2. Auth
        const session = await getAuthSession(req)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 3. CSRF
        const csrfResult = verifyCsrf({
            req,
            cookieToken: req.cookies.get(getCsrfCookieName())?.value,
            headerToken: req.headers.get('x-csrf-token'),
            allowedOrigins: getAllowedOrigins()
        })
        if (!csrfResult.ok) {
            return NextResponse.json({ error: 'CSRF' }, { status: 403 })
        }

        // 4. Parse & validate body
        const parsed = await parseBody(req, changePasswordSchema)
        if ('error' in parsed) return parsed.error
        const { currentPassword, newPassword } = parsed.data

        // 5. Fetch user with current hash
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, passwordHash: true }
        })

        if (!user || !user.passwordHash) {
            // SSO-only user or not found
            return NextResponse.json({ error: 'Password change not available' }, { status: 400 })
        }

        // 6. Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid current password' }, { status: 403 })
        }

        // 7. Hash and update
        const newHash = await bcrypt.hash(newPassword, 10)
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: newHash }
        })

        logAudit({
            action: 'PASSWORD_CHANGE',
            actorId: session.user.id,
            institutionId: session.user.institutionId,
            targetType: 'USER',
            targetId: user.id,
            ipAddress: getClientIp(req),
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Change Password Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
