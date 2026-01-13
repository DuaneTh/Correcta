import { NextResponse } from 'next/server'
import { buildRateLimitResponse, getClientIdentifier, rateLimit } from '@/lib/rateLimit'
import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf'

export async function GET(req: Request) {
    const rateLimitOptions = { windowSeconds: 60, max: 60, prefix: 'csrf_bootstrap' }
    try {
        const limit = await rateLimit(getClientIdentifier(req), rateLimitOptions)
        if (!limit.ok) {
            const limited = buildRateLimitResponse(limit, rateLimitOptions)
            return NextResponse.json(limited.body, { status: limited.status, headers: limited.headers })
        }
    } catch {
        return NextResponse.json({ error: 'RATE_LIMIT_UNAVAILABLE' }, { status: 503 })
    }

    const token = generateCsrfToken()
    const response = NextResponse.json({ csrfToken: token })
    setCsrfCookie(response.cookies, token)
    return response
}
