import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthSession, isPlatformAdmin } from '@/lib/api-auth'
import { verifyCsrf, getCsrfCookieToken, getAllowedOrigins } from '@/lib/csrf'
import { GRADING_SYSTEM_PROMPT, RUBRIC_GENERATION_PROMPT } from '@/lib/grading/prompts'

// Default prompts that can be customized
const DEFAULT_PROMPTS = [
    {
        key: 'GRADING_SYSTEM',
        name: 'Prompt systeme - Correction',
        description: 'Instructions systeme pour la correction des reponses etudiantes',
        content: GRADING_SYSTEM_PROMPT
    },
    {
        key: 'RUBRIC_SYSTEM',
        name: 'Prompt systeme - Generation de rubrique',
        description: 'Instructions systeme pour la generation automatique de rubriques de notation',
        content: RUBRIC_GENERATION_PROMPT
    }
]

/**
 * GET /api/admin/platform/ai-prompts
 * Get all AI prompts configuration
 */
export async function GET(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isPlatformAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Get custom prompts from database
        const customPrompts = await prisma.aIPromptConfig.findMany({
            orderBy: { key: 'asc' }
        })

        // Merge with defaults (custom overrides default)
        const prompts = DEFAULT_PROMPTS.map(defaultPrompt => {
            const custom = customPrompts.find(p => p.key === defaultPrompt.key)
            if (custom) {
                return {
                    ...custom,
                    defaultContent: defaultPrompt.content,
                    isCustomized: custom.content !== defaultPrompt.content
                }
            }
            return {
                id: null,
                key: defaultPrompt.key,
                name: defaultPrompt.name,
                description: defaultPrompt.description,
                content: defaultPrompt.content,
                defaultContent: defaultPrompt.content,
                isActive: true,
                isCustomized: false,
                version: 1,
                createdAt: null,
                updatedAt: null,
                updatedBy: null
            }
        })

        return NextResponse.json({ prompts })
    } catch (error: any) {
        console.error('[AI Prompts API] GET Error:', error)
        return NextResponse.json({
            error: 'Internal server error',
            details: error?.message || 'Unknown error',
            code: error?.code
        }, { status: 500 })
    }
}

/**
 * PUT /api/admin/platform/ai-prompts
 * Update an AI prompt
 */
export async function PUT(req: NextRequest) {
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

    try {
        const body = await req.json()
        const { key, content, name, description } = body

        if (!key || typeof key !== 'string') {
            return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
        }

        if (!content || typeof content !== 'string') {
            return NextResponse.json({ error: 'Invalid content' }, { status: 400 })
        }

        // Find default prompt to get name/description if not provided
        const defaultPrompt = DEFAULT_PROMPTS.find(p => p.key === key)
        if (!defaultPrompt) {
            return NextResponse.json({ error: 'Unknown prompt key' }, { status: 400 })
        }

        // Upsert the prompt
        const prompt = await prisma.aIPromptConfig.upsert({
            where: { key },
            create: {
                key,
                name: name || defaultPrompt.name,
                description: description || defaultPrompt.description,
                content,
                updatedBy: session.user.id
            },
            update: {
                content,
                name: name || undefined,
                description: description || undefined,
                version: { increment: 1 },
                updatedBy: session.user.id
            }
        })

        return NextResponse.json({ success: true, prompt })
    } catch (error) {
        console.error('[AI Prompts API] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * DELETE /api/admin/platform/ai-prompts
 * Reset a prompt to default
 */
export async function DELETE(req: NextRequest) {
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

    try {
        const { searchParams } = new URL(req.url)
        const key = searchParams.get('key')

        if (!key) {
            return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 })
        }

        await prisma.aIPromptConfig.deleteMany({
            where: { key }
        })

        return NextResponse.json({ success: true, message: 'Prompt reset to default' })
    } catch (error) {
        console.error('[AI Prompts API] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
