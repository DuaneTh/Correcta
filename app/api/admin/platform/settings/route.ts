import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthSession, isPlatformAdmin } from '@/lib/api-auth'
import { encrypt, decrypt, maskApiKey } from '@/lib/encryption'
import { verifyCsrf, getCsrfCookieToken, getAllowedOrigins } from '@/lib/csrf'

// Setting keys that can be managed via API
const ALLOWED_SETTINGS = ['OPENAI_API_KEY'] as const
type SettingKey = (typeof ALLOWED_SETTINGS)[number]

function isAllowedSetting(key: string): key is SettingKey {
    return ALLOWED_SETTINGS.includes(key as SettingKey)
}

/**
 * GET /api/admin/platform/settings
 * Returns platform settings with sensitive values masked
 */
export async function GET(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isPlatformAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings = await prisma.systemSetting.findMany({
        where: {
            key: { in: [...ALLOWED_SETTINGS] }
        }
    })

    // Build response with masked values for sensitive settings
    const result: Record<string, { value: string; isSet: boolean; updatedAt: Date | null }> = {}

    for (const key of ALLOWED_SETTINGS) {
        const setting = settings.find(s => s.key === key)

        if (setting && setting.encrypted) {
            try {
                const decrypted = decrypt(setting.value)
                result[key] = {
                    value: maskApiKey(decrypted),
                    isSet: true,
                    updatedAt: setting.updatedAt
                }
            } catch {
                result[key] = {
                    value: '',
                    isSet: false,
                    updatedAt: null
                }
            }
        } else if (setting) {
            result[key] = {
                value: setting.value,
                isSet: true,
                updatedAt: setting.updatedAt
            }
        } else {
            // Check if set via environment variable
            const envValue = process.env[key]
            result[key] = {
                value: envValue ? maskApiKey(envValue) + ' (env)' : '',
                isSet: Boolean(envValue),
                updatedAt: null
            }
        }
    }

    return NextResponse.json({ settings: result })
}

/**
 * PUT /api/admin/platform/settings
 * Update a platform setting
 */
export async function PUT(req: NextRequest) {
    try {
        const session = await getAuthSession(req)

        if (!session || !session.user || !isPlatformAdmin(session)) {
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
        const { key, value } = body

        if (!key || typeof key !== 'string' || !isAllowedSetting(key)) {
            return NextResponse.json({ error: 'Invalid setting key' }, { status: 400 })
        }

        if (value !== undefined && typeof value !== 'string') {
            return NextResponse.json({ error: 'Invalid value' }, { status: 400 })
        }

        // Validate OpenAI API key format
        if (key === 'OPENAI_API_KEY' && value) {
            if (!value.startsWith('sk-') || value.length < 20) {
                return NextResponse.json(
                    { error: 'Invalid OpenAI API key format. Key should start with "sk-"' },
                    { status: 400 }
                )
            }
        }

        // Delete setting if value is empty
        if (!value || value.trim() === '') {
            await prisma.systemSetting.deleteMany({
                where: { key }
            })

            return NextResponse.json({ success: true, deleted: true })
        }

        // Encrypt sensitive values
        let encryptedValue: string
        try {
            encryptedValue = encrypt(value)
        } catch (encryptError) {
            console.error('[Settings API] Encryption failed:', encryptError)
            return NextResponse.json(
                { error: 'Encryption failed. Check server configuration (NEXTAUTH_SECRET).' },
                { status: 500 }
            )
        }

        await prisma.systemSetting.upsert({
            where: { key },
            create: {
                key,
                value: encryptedValue,
                encrypted: true,
                updatedBy: session.user.id
            },
            update: {
                value: encryptedValue,
                encrypted: true,
                updatedBy: session.user.id
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Settings API] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        )
    }
}
