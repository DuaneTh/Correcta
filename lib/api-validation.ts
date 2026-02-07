import { NextResponse } from 'next/server'
import { z } from 'zod'

// ── Standard API error responses ──────────────────────────────────

type ApiErrorOptions = { headers?: HeadersInit }

export function apiError(message: string, status: number, opts?: ApiErrorOptions) {
    return NextResponse.json({ error: message }, { status, headers: opts?.headers })
}

export const unauthorized = (msg = 'Unauthorized') => apiError(msg, 401)
export const forbidden = (msg = 'Forbidden') => apiError(msg, 403)
export const notFound = (msg = 'Not found') => apiError(msg, 404)
export const badRequest = (msg = 'Bad request') => apiError(msg, 400)
export const internal = (msg = 'Internal server error') => apiError(msg, 500)

/**
 * Safely parse a request body against a Zod schema.
 * Returns either the parsed data or a 400 NextResponse.
 */
export async function parseBody<T extends z.ZodTypeAny>(
    req: Request,
    schema: T
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
    let raw: unknown
    try {
        raw = await req.json()
    } catch {
        return { error: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
    }

    const result = schema.safeParse(raw)
    if (!result.success) {
        const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
        return { error: NextResponse.json({ error: `Validation: ${messages}` }, { status: 400 }) }
    }

    return { data: result.data }
}
