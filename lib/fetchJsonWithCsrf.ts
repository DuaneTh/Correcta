import { getCsrfToken } from '@/lib/csrfClient'

type FetchJsonOptions = {
    method?: string
    body?: unknown
    headers?: Record<string, string>
    signal?: AbortSignal
}

export async function fetchJsonWithCsrf<T>(
    url: string,
    options: FetchJsonOptions = {}
): Promise<T> {
    const csrfToken = await getCsrfToken()
    const method = options.method ?? (options.body ? 'POST' : 'GET')
    const headers: Record<string, string> = {
        ...(options.headers ?? {}),
        'x-csrf-token': csrfToken
    }

    let body: string | undefined
    if (options.body !== undefined) {
        if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json'
        }
        body = JSON.stringify(options.body)
    }

    const res = await fetch(url, {
        method,
        headers,
        body,
        signal: options.signal
    })

    const contentType = res.headers.get('content-type') || ''
    const isJson = contentType.includes('application/json')
    const data = isJson ? await res.json() : await res.text().catch(() => '')

    if (!res.ok) {
        const message =
            typeof data === 'string'
                ? data
                : data && typeof data === 'object' && 'error' in data
                    ? String((data as { error?: unknown }).error ?? '')
                    : ''
        const suffix = message ? `: ${message}` : ''
        throw new Error(`Request failed (${res.status})${suffix}`)
    }

    return data as T
}
