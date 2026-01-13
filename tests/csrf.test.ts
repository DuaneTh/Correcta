import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyCsrf } from '../lib/csrf'

const env = process.env as Record<string, string | undefined>

const withCsrfEnabled = async (fn: () => void | Promise<void>) => {
    const originalEnabled = env.CSRF_ENABLED
    const originalNodeEnv = env.NODE_ENV
    env.CSRF_ENABLED = 'true'
    env.NODE_ENV = 'test'
    await fn()
    if (originalEnabled === undefined) {
        delete env.CSRF_ENABLED
    } else {
        env.CSRF_ENABLED = originalEnabled
    }
    if (originalNodeEnv === undefined) {
        delete env.NODE_ENV
    } else {
        env.NODE_ENV = originalNodeEnv
    }
}

const makeRequest = (method: string, headers: Record<string, string> = {}) =>
    new Request('https://example.com/api', { method, headers })

test('verifyCsrf allows safe methods without token', async () => {
    await withCsrfEnabled(() => {
        const req = makeRequest('GET')
        const result = verifyCsrf({ req })
        assert.equal(result.ok, true)
    })
})

test('verifyCsrf rejects missing token on POST', async () => {
    await withCsrfEnabled(() => {
        const req = makeRequest('POST')
        const result = verifyCsrf({ req })
        assert.equal(result.ok, false)
        assert.equal(result.reason, 'missing_token')
    })
})

test('verifyCsrf rejects mismatched token', async () => {
    await withCsrfEnabled(() => {
        const req = makeRequest('POST')
        const result = verifyCsrf({
            req,
            cookieToken: 'token-a',
            headerToken: 'token-b'
        })
        assert.equal(result.ok, false)
        assert.equal(result.reason, 'mismatch')
    })
})

test('verifyCsrf accepts matching token', async () => {
    await withCsrfEnabled(() => {
        const req = makeRequest('POST')
        const result = verifyCsrf({
            req,
            cookieToken: 'token-a',
            headerToken: 'token-a'
        })
        assert.equal(result.ok, true)
    })
})

test('verifyCsrf rejects unexpected origin', async () => {
    await withCsrfEnabled(() => {
        const req = makeRequest('POST', { origin: 'https://evil.example' })
        const result = verifyCsrf({
            req,
            cookieToken: 'token-a',
            headerToken: 'token-a',
            allowedOrigins: ['https://example.com']
        })
        assert.equal(result.ok, false)
        assert.equal(result.reason, 'origin')
    })
})
