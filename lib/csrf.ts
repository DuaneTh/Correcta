import { randomBytes, timingSafeEqual } from 'node:crypto'

type CsrfCookieStore = {
    set: (name: string, value: string, options: {
        httpOnly?: boolean
        secure?: boolean
        sameSite?: 'lax' | 'strict' | 'none'
        path?: string
        maxAge?: number
    }) => void
}

export type CsrfVerifyParams = {
    req: Request
    cookieToken?: string | null
    headerToken?: string | null
    allowedOrigins?: string[]
}

const DEFAULT_COOKIE_NAME = 'correcta-csrf'

export const getCsrfCookieName = (): string =>
    process.env.CSRF_COOKIE_NAME || DEFAULT_COOKIE_NAME

export const getCsrfCookieToken = (req: Request): string | undefined => {
    const cookieName = getCsrfCookieName()
    const requestWithCookies = req as unknown as {
        cookies?: { get?: (name: string) => { value?: string } | undefined }
    }
    const cookieValue = requestWithCookies.cookies?.get?.(cookieName)?.value
    if (cookieValue) {
        return cookieValue
    }

    const cookieHeader = req.headers.get('cookie') || ''
    const match = cookieHeader.match(new RegExp(`${cookieName}=([^;]+)`))
    return match ? match[1] : undefined
}

export const isCsrfEnabled = (): boolean => {
    if (process.env.CSRF_ENABLED === 'false') {
        return false
    }
    return process.env.NODE_ENV === 'production' || process.env.CSRF_ENABLED === 'true'
}

export const getAllowedOrigins = (): string[] => {
    const raw = process.env.CSRF_ALLOWED_ORIGINS
    if (!raw) return []
    return raw.split(',').map((entry) => entry.trim()).filter(Boolean)
}

export const generateCsrfToken = (): string =>
    randomBytes(32).toString('base64url')

export const setCsrfCookie = (
    cookies: CsrfCookieStore,
    token: string,
    options?: { maxAge?: number }
): void => {
    cookies.set(getCsrfCookieName(), token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: options?.maxAge ?? 60 * 60
    })
}

const isSafeMethod = (method: string): boolean =>
    method === 'GET' || method === 'HEAD' || method === 'OPTIONS'

const getRequestOrigin = (req: Request): string | null => {
    const origin = req.headers.get('origin')
    if (origin) return origin
    const referer = req.headers.get('referer')
    if (!referer) return null
    try {
        return new URL(referer).origin
    } catch {
        return null
    }
}

const getSameOrigin = (req: Request): string | null => {
    const host = req.headers.get('host')
    if (!host) return null
    const proto = req.headers.get('x-forwarded-proto') || 'http'
    return `${proto}://${host}`
}

export const verifyCsrf = ({
    req,
    cookieToken,
    headerToken,
    allowedOrigins = []
}: CsrfVerifyParams): { ok: boolean; reason?: string } => {
    if (!isCsrfEnabled()) {
        return { ok: true }
    }

    const method = req.method.toUpperCase()
    if (isSafeMethod(method)) {
        return { ok: true }
    }

    if (!cookieToken || !headerToken) {
        return { ok: false, reason: 'missing_token' }
    }

    const cookieBuffer = Buffer.from(cookieToken)
    const headerBuffer = Buffer.from(headerToken)
    if (cookieBuffer.length !== headerBuffer.length) {
        return { ok: false, reason: 'mismatch' }
    }

    if (!timingSafeEqual(cookieBuffer, headerBuffer)) {
        return { ok: false, reason: 'mismatch' }
    }

    const requestOrigin = getRequestOrigin(req)
    if (requestOrigin) {
        const origins = allowedOrigins.length > 0 ? allowedOrigins : []
        if (origins.length === 0) {
            const sameOrigin = getSameOrigin(req)
            if (!sameOrigin || sameOrigin !== requestOrigin) {
                return { ok: false, reason: 'origin' }
            }
        } else if (!origins.includes(requestOrigin)) {
            return { ok: false, reason: 'origin' }
        }
    }

    return { ok: true }
}
