const SENSITIVE_KEYS = new Set([
    'email',
    'name',
    'token',
    'access_token',
    'id_token',
    'refresh_token',
    'profile',
    'claims',
    'cookie',
    'password',
    'secret'
])

export function redactEmail(email: string): string {
    const atIndex = email.indexOf('@')
    if (atIndex <= 0) {
        return '***'
    }

    const local = email.slice(0, atIndex)
    const domain = email.slice(atIndex + 1)
    const firstChar = local[0] ?? ''

    return `${firstChar}***@${domain}`
}

export function safeJson(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => safeJson(item))
    }

    if (value && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
        return entries.reduce<Record<string, unknown>>((acc, [key, val]) => {
            if (SENSITIVE_KEYS.has(key)) {
                acc[key] = '[REDACTED]'
                return acc
            }

            acc[key] = safeJson(val)
            return acc
        }, {})
    }

    return value
}
