import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { safeJson } from "@/lib/logging"
import { signInstitutionId } from "@/lib/institutionCookie"
import { buildRateLimitResponse, getClientIdentifier, rateLimit } from "@/lib/rateLimit"

export async function POST(req: Request) {
    try {
        const rateLimitKey = getClientIdentifier(req)
        const rateLimitOptions = { windowSeconds: 60, max: 20, prefix: 'auth_lookup' }
        try {
            const limit = await rateLimit(rateLimitKey, rateLimitOptions)
            if (!limit.ok) {
                const limited = buildRateLimitResponse(limit, rateLimitOptions)
                return NextResponse.json(limited.body, { status: limited.status, headers: limited.headers })
            }
        } catch {
            return NextResponse.json({ error: "RATE_LIMIT_UNAVAILABLE" }, { status: 503 })
        }

        const { email } = await req.json()
        const authDebug = process.env.NODE_ENV !== 'production' && process.env.AUTH_DEBUG === 'true'

        if (!email || !email.includes('@')) {
            return NextResponse.json({ error: "Invalid email" }, { status: 400 })
        }

        const domain = email.split('@')[1].toLowerCase()

        // Force CREDENTIALS for demo.edu
        if (domain === 'demo.edu') {
            if (authDebug) {
                console.log('[API] auth_lookup', safeJson({ result: 'credentials', domain: 'demo.edu' }))
            }
            return NextResponse.json({ type: "CREDENTIALS" })
        }

        const institutionDomain = await prisma.institutionDomain.findUnique({
            where: { domain },
            include: { institution: true }
        })
        const institution = institutionDomain?.institution ?? await prisma.institution.findUnique({
            where: { domain }
        })

        if (institution && institution.ssoConfig) {
            const ssoConfig = institution.ssoConfig as { type?: string, enabled?: boolean }
            if (ssoConfig.enabled === false) {
                if (authDebug) {
                    console.log('[API] auth_lookup', safeJson({ result: 'credentials', institutionId: institution.id }))
                }
                return NextResponse.json({ type: "CREDENTIALS" })
            }
            if (authDebug) {
                console.log('[API] auth_lookup', safeJson({ result: 'sso', institutionId: institution.id }))
            }
            const response = NextResponse.json({
                type: "SSO",
                institutionId: institution.id,
                provider: ssoConfig.type === 'saml' ? 'boxyhq-saml' : 'oidc'
            })
            response.cookies.set('correcta-institution', signInstitutionId(institution.id), {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 5
            })
            return response
        }

        if (authDebug) {
            console.log('[API] auth_lookup', safeJson({ result: 'credentials' }))
        }
        return NextResponse.json({ type: "CREDENTIALS" })
    } catch (error) {
        console.error("Lookup error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
