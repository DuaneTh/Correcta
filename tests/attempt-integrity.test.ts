import test from 'node:test'
import assert from 'node:assert/strict'
import { ensureAttemptNonce, ensureIdempotency, verifyAttemptNonce } from '../lib/attemptIntegrity'

const withTestEnv = async (fn: () => void | Promise<void>) => {
    const env = process.env as Record<string, string | undefined>
    const originalNodeEnv = env.NODE_ENV
    const originalRedisUrl = env.REDIS_URL
    env.NODE_ENV = 'test'
    delete env.REDIS_URL
    await fn()
    if (originalNodeEnv === undefined) {
        delete env.NODE_ENV
    } else {
        env.NODE_ENV = originalNodeEnv
    }
    if (originalRedisUrl === undefined) {
        delete env.REDIS_URL
    } else {
        env.REDIS_URL = originalRedisUrl
    }
}

test('verifyAttemptNonce accepts correct nonce and rejects mismatch', async () => {
    await withTestEnv(async () => {
        const attemptId = 'attempt-1'
        const nonce = await ensureAttemptNonce(attemptId)
        const ok = await verifyAttemptNonce(attemptId, nonce)
        const bad = await verifyAttemptNonce(attemptId, `${nonce}x`)
        assert.equal(ok.ok, true)
        assert.equal(bad.ok, false)
    })
})

test('ensureIdempotency returns replay on duplicate request', async () => {
    await withTestEnv(async () => {
        const first = await ensureIdempotency('attempt-1', 'request-1', 'autosave')
        const second = await ensureIdempotency('attempt-1', 'request-1', 'autosave')
        assert.equal(first.first, true)
        assert.equal(second.first, false)
    })
})
