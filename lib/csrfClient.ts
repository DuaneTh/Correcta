let cachedToken: string | null = null
let inflight: Promise<string> | null = null

export async function getCsrfToken(): Promise<string> {
    if (cachedToken) {
        return cachedToken
    }

    if (inflight) {
        return inflight
    }

    inflight = fetch('/api/csrf', { method: 'GET' })
        .then(async (res) => {
            if (!res.ok) {
                throw new Error('Failed to fetch CSRF token')
            }
            const data = await res.json()
            cachedToken = data.csrfToken as string
            return cachedToken
        })
        .finally(() => {
            inflight = null
        })

    return inflight
}
