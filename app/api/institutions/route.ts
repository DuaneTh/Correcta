import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAuthSession, isAdmin, isPlatformAdmin, isSchoolAdmin } from '@/lib/api-auth'
import { getAllowedOrigins, getCsrfCookieToken, verifyCsrf } from '@/lib/csrf'
import { buildRateLimitResponse, getClientIdentifier, hashRateLimitKey, rateLimit } from '@/lib/rateLimit'

const normalizeDomain = (value: string): string =>
    value.trim().toLowerCase().replace(/^@+/, '')

const toPrismaJson = (
    value: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
    if (value === undefined) return undefined
    if (value === null) return Prisma.DbNull
    return value as Prisma.InputJsonValue
}

const isValidDomain = (value: string): boolean => {
    if (!value) return false
    if (/\s/.test(value)) return false
    return value.includes('.')
}

const sanitizeSsoConfig = (ssoConfig: unknown): { publicConfig: Record<string, unknown> | null; hasClientSecret: boolean } => {
    if (!ssoConfig || typeof ssoConfig !== 'object') {
        return { publicConfig: null, hasClientSecret: false }
    }
    const config = ssoConfig as Record<string, unknown>
    const { clientSecret, ...rest } = config
    const hasClientSecret = typeof clientSecret === 'string' && clientSecret.length > 0
    return { publicConfig: rest, hasClientSecret }
}

const resolveIncomingSsoConfig = (
    incoming: unknown,
    existingSecret?: string
): Record<string, unknown> | null | undefined => {
    if (incoming === undefined) return undefined
    if (incoming === null) return null
    if (typeof incoming !== 'object') return undefined
    const config = { ...(incoming as Record<string, unknown>) }
    const incomingSecret =
        typeof config.clientSecret === 'string' && config.clientSecret.trim() !== ''
            ? config.clientSecret.trim()
            : undefined
    if (!incomingSecret) {
        delete config.clientSecret
        if (existingSecret) {
            config.clientSecret = existingSecret
        }
    }
    return config
}

export async function GET(req: Request) {
    const session = await getAuthSession(req as unknown as NextRequest)

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdmin(session)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (isSchoolAdmin(session)) {
        const institution = await prisma.institution.findUnique({
            where: { id: session.user.institutionId },
            include: {
                domains: { select: { domain: true } }
            }
        })

        if (!institution) {
            return NextResponse.json({ institutions: [] })
        }
        const { publicConfig, hasClientSecret } = sanitizeSsoConfig(institution.ssoConfig)
        return NextResponse.json({
            institutions: [{
                ...institution,
                ssoConfig: publicConfig,
                hasClientSecret
            }]
        })
    }

    const institutions = await prisma.institution.findMany({
        include: {
            domains: { select: { domain: true } }
        },
        orderBy: { name: 'asc' }
    })

    return NextResponse.json({
        institutions: institutions.map((institution) => {
            const { publicConfig, hasClientSecret } = sanitizeSsoConfig(institution.ssoConfig)
            return {
                ...institution,
                ssoConfig: publicConfig,
                hasClientSecret
            }
        })
    })
}

export async function POST(req: Request) {
    const session = await getAuthSession()

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isPlatformAdmin(session)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const csrfResult = verifyCsrf({
        req,
        cookieToken: getCsrfCookieToken(req),
        headerToken: req.headers.get('x-csrf-token'),
        allowedOrigins: getAllowedOrigins()
    })
    if (!csrfResult.ok) {
        return NextResponse.json({ error: 'CSRF' }, { status: 403 })
    }

    const rateKey = hashRateLimitKey(`${session.user.id}:${getClientIdentifier(req)}`)
    const rateResult = await rateLimit(rateKey, {
        windowSeconds: 60,
        max: 10,
        prefix: 'admin_institutions'
    })
    if (!rateResult.ok) {
        const response = buildRateLimitResponse(rateResult, {
            windowSeconds: 60,
            max: 10,
            prefix: 'admin_institutions'
        })
        return NextResponse.json(response.body, { status: response.status, headers: response.headers })
    }

    const body = await req.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const domains: string[] = Array.isArray(body?.domains)
        ? body.domains.map((domain: string) => normalizeDomain(domain)).filter(Boolean)
        : []
    const ssoConfig = resolveIncomingSsoConfig(body?.ssoConfig)

    if (!name) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (domains.some((domain) => !isValidDomain(domain))) {
        return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 })
    }

    try {
        const institution = await prisma.$transaction(async (tx) => {
            const created = await tx.institution.create({
                data: {
                    name,
                    ssoConfig: toPrismaJson(ssoConfig),
                    domain: domains[0] ?? null,
                }
            })

            if (domains.length > 0) {
                await tx.institutionDomain.createMany({
                    data: domains.map((domain: string) => ({
                        domain,
                        institutionId: created.id,
                    })),
                    skipDuplicates: true,
                })
            }

            return created
        })

        const withDomains = await prisma.institution.findUnique({
            where: { id: institution.id },
            include: { domains: { select: { domain: true } } }
        })

        if (!withDomains) {
            return NextResponse.json({ error: 'Failed to load institution' }, { status: 500 })
        }
        const { publicConfig, hasClientSecret } = sanitizeSsoConfig(withDomains.ssoConfig)
        return NextResponse.json({
            institution: {
                ...withDomains,
                ssoConfig: publicConfig,
                hasClientSecret
            }
        })
    } catch (error) {
        console.error('[Institutions] Create failed', error)
        return NextResponse.json({ error: 'Failed to create institution' }, { status: 500 })
    }
}
