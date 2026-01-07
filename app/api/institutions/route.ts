import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthSession, isAdmin, isPlatformAdmin, isSchoolAdmin } from '@/lib/api-auth'

const normalizeDomain = (value: string): string =>
    value.trim().toLowerCase().replace(/^@+/, '')

export async function GET(req: Request) {
    const session = await getAuthSession()

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

        return NextResponse.json({ institutions: institution ? [institution] : [] })
    }

    const institutions = await prisma.institution.findMany({
        include: {
            domains: { select: { domain: true } }
        },
        orderBy: { name: 'asc' }
    })

    return NextResponse.json({ institutions })
}

export async function POST(req: Request) {
    const session = await getAuthSession()

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isPlatformAdmin(session)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const domains = Array.isArray(body?.domains)
        ? body.domains.map((domain: string) => normalizeDomain(domain)).filter(Boolean)
        : []
    const ssoConfig = body?.ssoConfig ?? null

    if (!name) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    try {
        const institution = await prisma.$transaction(async (tx) => {
            const created = await tx.institution.create({
                data: {
                    name,
                    ssoConfig,
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

        return NextResponse.json({ institution: withDomains })
    } catch (error) {
        console.error('[Institutions] Create failed', error)
        return NextResponse.json({ error: 'Failed to create institution' }, { status: 500 })
    }
}
