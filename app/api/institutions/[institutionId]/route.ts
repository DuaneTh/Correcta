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

const canAccessInstitution = (
    session: { user?: { institutionId?: string } } | null,
    institutionId: string
): boolean => {
    if (!session?.user) {
        return false
    }
    if (isPlatformAdmin(session)) {
        return true
    }

    return isSchoolAdmin(session) && session.user.institutionId === institutionId
}

export async function GET(req: Request, { params }: { params: Promise<{ institutionId: string }> }) {
    const session = await getAuthSession(req as unknown as NextRequest)

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdmin(session)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const activeSession = session as { user: { institutionId?: string } }

    const { institutionId } = await params
    if (!canAccessInstitution(activeSession, institutionId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
        include: { domains: { select: { domain: true } } }
    })

    if (!institution) {
        return NextResponse.json({ institution: null }, { status: 404 })
    }
    const { publicConfig, hasClientSecret } = sanitizeSsoConfig(institution.ssoConfig)
    return NextResponse.json({
        institution: {
            ...institution,
            ssoConfig: publicConfig,
            hasClientSecret
        }
    })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ institutionId: string }> }) {
    const session = await getAuthSession()

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdmin(session)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const activeSession = session as { user: { institutionId?: string } }

    const { institutionId } = await params
    if (!canAccessInstitution(activeSession, institutionId)) {
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

    const rateKey = hashRateLimitKey(`${session.user.id}:${institutionId}:${getClientIdentifier(req)}`)
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

    const existing = await prisma.institution.findUnique({
        where: { id: institutionId },
        select: { ssoConfig: true }
    })
    const existingConfig = existing?.ssoConfig as Record<string, unknown> | null
    const existingSecret =
        existingConfig && typeof existingConfig.clientSecret === 'string' && existingConfig.clientSecret
            ? existingConfig.clientSecret
            : undefined

    const body = await req.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : undefined
    const ssoConfig = resolveIncomingSsoConfig(body?.ssoConfig, existingSecret)
    const domains: string[] | undefined = Array.isArray(body?.domains)
        ? body.domains.map((domain: string) => normalizeDomain(domain)).filter(Boolean)
        : undefined
    if (domains && domains.some((domain) => !isValidDomain(domain))) {
        return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 })
    }

    try {
        if (domains && domains.length > 0) {
            const conflicting = await prisma.institutionDomain.findMany({
                where: {
                    domain: { in: domains },
                    institutionId: { not: institutionId },
                },
                select: { domain: true },
            })
            if (conflicting.length > 0) {
                return NextResponse.json(
                    {
                        error: `Domain(s) already assigned: ${conflicting
                            .map((entry) => entry.domain)
                            .join(', ')}`,
                    },
                    { status: 409 }
                )
            }
        }

        const updated = await prisma.$transaction(async (tx) => {
            const updatedInstitution = await tx.institution.update({
                where: { id: institutionId },
                data: {
                    ...(name ? { name } : {}),
                    ...(ssoConfig !== undefined ? { ssoConfig: toPrismaJson(ssoConfig) } : {}),
                    ...(domains ? { domain: domains[0] ?? null } : {}),
                }
            })

            if (domains) {
                const existingDomains = await tx.institutionDomain.findMany({
                    where: { institutionId },
                    select: { domain: true }
                })

                const existingSet = new Set(existingDomains.map((entry) => entry.domain))
                const nextSet = new Set(domains)

                const toRemove = Array.from(existingSet).filter((domain) => !nextSet.has(domain))
                const toAdd = Array.from(nextSet).filter((domain) => !existingSet.has(domain))

                if (toRemove.length > 0) {
                    await tx.institutionDomain.deleteMany({
                        where: {
                            institutionId,
                            domain: { in: toRemove }
                        }
                    })
                }

                if (toAdd.length > 0) {
                    await tx.institutionDomain.createMany({
                        data: toAdd.map((domain) => ({
                            domain,
                            institutionId,
                        })),
                        skipDuplicates: true,
                    })
                }
            }

            return updatedInstitution
        })

        const withDomains = await prisma.institution.findUnique({
            where: { id: updated.id },
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
        console.error('[Institutions] Update failed', error)
        return NextResponse.json({ error: 'Failed to update institution' }, { status: 500 })
    }
}
