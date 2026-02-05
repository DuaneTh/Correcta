import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getAuthSession, isSchoolAdmin } from '@/lib/api-auth'
import { getAllowedOrigins, getCsrfCookieToken, verifyCsrf } from '@/lib/csrf'

const isValidRole = (role: string) => role === 'TEACHER' || role === 'STUDENT'

export async function GET(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isSchoolAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = req.nextUrl.searchParams.get('role') ?? undefined
    const includeArchived = req.nextUrl.searchParams.get('includeArchived') === 'true'

    if (role && !isValidRole(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const users = await prisma.user.findMany({
        where: {
            institutionId: session.user.institutionId,
            ...(role ? { role: role as 'TEACHER' | 'STUDENT' } : {}),
            ...(includeArchived ? {} : { archivedAt: null }),
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            archivedAt: true,
            enrollments: {
                where: includeArchived ? {} : { class: { archivedAt: null } },
                select: {
                    class: {
                        select: {
                            id: true,
                            name: true,
                            course: { select: { code: true, name: true } },
                        }
                    }
                }
            }
        },
        orderBy: { name: 'asc' }
    })

    return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isSchoolAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const body = await req.json()
    const role = typeof body?.role === 'string' ? body.role : ''

    if (!isValidRole(role)) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const institution = await prisma.institution.findUnique({
        where: { id: session.user.institutionId },
        select: { ssoConfig: true }
    })
    const ssoConfig = institution?.ssoConfig as { enabled?: boolean } | null
    const ssoEnabled = ssoConfig?.enabled !== false

    const password = typeof body?.password === 'string' ? body.password : ''
    if (!ssoEnabled && !password) {
        return NextResponse.json({ error: 'Password required' }, { status: 400 })
    }
    const passwordHash = password ? await bcrypt.hash(password, 10) : null

    if (Array.isArray(body?.users)) {
        const seen = new Set<string>()
        const errors: string[] = []
        const data = body.users
            .map((entry: { email?: string; name?: string }) => {
                const rawEmail = typeof entry?.email === 'string' ? entry.email.trim().toLowerCase() : ''
                const rawName = typeof entry?.name === 'string' ? entry.name.trim() : null
                if (!rawEmail || !rawEmail.includes('@')) {
                    errors.push(rawEmail ? `Invalid email: ${rawEmail}` : 'Missing email')
                    return null
                }
                if (seen.has(rawEmail)) {
                    return null
                }
                seen.add(rawEmail)
                return {
                    email: rawEmail,
                    name: rawName || null,
                    role,
                    institutionId: session.user.institutionId,
                    passwordHash,
                }
            })
            .filter(Boolean) as Array<{
                email: string
                name: string | null
                role: 'TEACHER' | 'STUDENT'
                institutionId: string
                passwordHash: string | null
            }>

        if (data.length === 0) {
            return NextResponse.json({ error: 'No valid users provided', errors }, { status: 400 })
        }

        try {
            const result = await prisma.user.createMany({
                data,
                skipDuplicates: true,
            })
            const createdCount = result.count
            const skippedCount = data.length - createdCount
            return NextResponse.json({ createdCount, skippedCount, errors })
        } catch (error) {
            console.error('[AdminUsers] Bulk create failed', error)
            return NextResponse.json({ error: 'Failed to create users' }, { status: 500 })
        }
    }

    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const name = typeof body?.name === 'string' ? body.name.trim() : null

    if (!email) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    try {
        const user = await prisma.user.create({
            data: {
                email,
                name,
                role,
                institutionId: session.user.institutionId,
                passwordHash,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                archivedAt: true,
            }
        })

        return NextResponse.json({ user }, { status: 201 })
    } catch (error) {
        console.error('[AdminUsers] Create failed', error)
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }
}

export async function PATCH(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isSchoolAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const body = await req.json()
    const userId = typeof body?.userId === 'string' ? body.userId : ''
    const name = typeof body?.name === 'string' ? body.name.trim() : undefined
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : undefined
    const archived = typeof body?.archived === 'boolean' ? body.archived : undefined

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, institutionId: true }
    })

    if (!targetUser || targetUser.institutionId !== session.user.institutionId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (!isValidRole(targetUser.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (archived !== undefined) updateData.archivedAt = archived ? new Date() : null

    const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            archivedAt: true,
        }
    })

    return NextResponse.json({ user })
}
