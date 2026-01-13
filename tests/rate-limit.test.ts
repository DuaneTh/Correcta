import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRateLimitResponse, rateLimit } from '../lib/rateLimit'

test('rateLimit in-memory enforces limit', async () => {
    const env = process.env as Record<string, string | undefined>
    const originalRedisUrl = env.REDIS_URL
    const originalRateRedisUrl = env.RATE_LIMIT_REDIS_URL
    const originalNodeEnv = env.NODE_ENV

    env.NODE_ENV = 'test'
    delete env.REDIS_URL
    delete env.RATE_LIMIT_REDIS_URL

    const opts = { windowSeconds: 60, max: 2, prefix: 'test' }
    const first = await rateLimit('key', opts)
    const second = await rateLimit('key', opts)
    const third = await rateLimit('key', opts)

    assert.equal(first.ok, true)
    assert.equal(second.ok, true)
    assert.equal(third.ok, false)
    assert.equal(third.remaining, 0)
    assert.ok(third.reset >= first.reset)

    if (originalRedisUrl === undefined) {
        delete env.REDIS_URL
    } else {
        env.REDIS_URL = originalRedisUrl
    }
    if (originalRateRedisUrl === undefined) {
        delete env.RATE_LIMIT_REDIS_URL
    } else {
        env.RATE_LIMIT_REDIS_URL = originalRateRedisUrl
    }
    if (originalNodeEnv === undefined) {
        delete env.NODE_ENV
    } else {
        env.NODE_ENV = originalNodeEnv
    }
})

test('buildRateLimitResponse returns 429 with headers', () => {
    const opts = { windowSeconds: 60, max: 10, prefix: 'test' }
    const result = { ok: false, remaining: 0, reset: Math.floor(Date.now() / 1000) + 60 }
    const response = buildRateLimitResponse(result, opts)

    assert.equal(response.status, 429)
    assert.equal(response.body.error, 'RATE_LIMITED')
    assert.equal(response.headers['X-RateLimit-Limit'], '10')
    assert.equal(response.headers['X-RateLimit-Remaining'], '0')
    assert.ok(Number(response.headers['Retry-After']) >= 0)
})
