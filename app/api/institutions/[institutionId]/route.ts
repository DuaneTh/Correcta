import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthSession, isAdmin, isPlatformAdmin, isSchoolAdmin } from '@/lib/api-auth'

const normalizeDomain = (value: string): string =>
    value.trim().toLowerCase().replace(/^@+/, '')

const canAccessInstitution = (session: any, institutionId: string): boolean => {
    if (isPlatformAdmin(session)) {
        return true
    }

    return isSchoolAdmin(session) && session.user.institutionId === institutionId
}

export async function GET(req: Request, { params }: { params: Promise<{ institutionId: string }> }) {
    const session = await getAuthSession()

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdmin(session)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { institutionId } = await params
    if (!canAccessInstitution(session, institutionId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
        include: { domains: { select: { domain: true } } }
    })

    return NextResponse.json({ institution })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ institutionId: string }> }) {
    const session = await getAuthSession()

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdmin(session)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { institutionId } = await params
    if (!canAccessInstitution(session, institutionId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : undefined
    const ssoConfig = body?.ssoConfig
    const domains = Array.isArray(body?.domains)
        ? body.domains.map((domain: string) => normalizeDomain(domain)).filter(Boolean)
        : undefined

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
                    ...(ssoConfig !== undefined ? { ssoConfig } : {}),
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

                const toRemove = Array.from(existingSet).filter((domain: unknown) => !nextSet.has(domain))
                const toAdd = Array.from(nextSet).filter((domain: unknown) => !existingSet.has(domain as string))

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
                        data: toAdd.map((domain: unknown) => ({
                            domain: domain as string,
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

        return NextResponse.json({ institution: withDomains })
    } catch (error) {
        console.error('[Institutions] Update failed', error)
        return NextResponse.json({ error: 'Failed to update institution' }, { status: 500 })
    }
}
