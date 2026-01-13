import { randomBytes, timingSafeEqual } from 'node:crypto'
import Redis from 'ioredis'

type IdempotencyResult = { first: boolean }
type NonceVerifyResult = { ok: boolean; reason?: string }

const NONCE_KEY_PREFIX = 'attempt:nonce'
const REQUEST_KEY_PREFIX = 'attempt:req'
const NONCE_TTL_SECONDS = Number(process.env.ATTEMPT_NONCE_TTL_SECONDS || 60 * 60 * 6)
const REQUEST_TTL_SECONDS = Number(process.env.ATTEMPT_REQUEST_TTL_SECONDS || 60 * 60)

const NONCE_REGEX = /^[a-zA-Z0-9_-]{16,128}$/

let redisClient: Redis | null = null
const memoryNonceExpiry = new Map<string, number>()
const memoryNonceValue = new Map<string, string>()
const memoryRequestExpiry = new Map<string, number>()

const getRedisUrl = (): string | undefined => process.env.REDIS_URL

const getRedisClient = (): Redis | null => {
    const redisUrl = getRedisUrl()
    if (!redisUrl) {
        return null
    }
    if (!redisClient) {
        redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: 1,
            enableReadyCheck: false
        })
    }
    return redisClient
}

const ensureRedisAvailable = (): Redis | null => {
    const redis = getRedisClient()
    if (!redis && process.env.NODE_ENV === 'production') {
        throw new Error('Attempt integrity requires Redis in production')
    }
    return redis
}

const generateNonce = (): string => randomBytes(16).toString('base64url')

const isNonceValid = (value: string): boolean =>
    NONCE_REGEX.test(value)

export async function ensureAttemptNonce(attemptId: string): Promise<string> {
    const redis = ensureRedisAvailable()
    const key = `${NONCE_KEY_PREFIX}:${attemptId}`

    if (redis) {
        const existing = await redis.get(key)
        if (existing) {
            return existing
        }
        const nonce = generateNonce()
        await redis.set(key, nonce, 'EX', NONCE_TTL_SECONDS)
        return nonce
    }

    const existing = memoryNonceExpiry.get(key)
    if (existing && existing > Date.now()) {
        const stored = memoryNonceValue.get(key)
        if (stored) {
            return stored
        }
    }
    const nonce = generateNonce()
    memoryNonceExpiry.set(key, Date.now() + NONCE_TTL_SECONDS * 1000)
    memoryNonceValue.set(key, nonce)
    return nonce
}

const getStoredNonce = async (attemptId: string): Promise<string | null> => {
    const redis = ensureRedisAvailable()
    const key = `${NONCE_KEY_PREFIX}:${attemptId}`

    if (redis) {
        return await redis.get(key)
    }

    const expiresAt = memoryNonceExpiry.get(key)
    const nonce = memoryNonceValue.get(key)
    if (!expiresAt || expiresAt <= Date.now() || !nonce) {
        return null
    }
    return nonce
}

const storeNonceIfMissing = async (attemptId: string, nonce: string): Promise<void> => {
    const redis = ensureRedisAvailable()
    const key = `${NONCE_KEY_PREFIX}:${attemptId}`

    if (redis) {
        await redis.set(key, nonce, 'EX', NONCE_TTL_SECONDS, 'NX')
        return
    }

    const expiresAt = Date.now() + NONCE_TTL_SECONDS * 1000
    const currentExpiry = memoryNonceExpiry.get(key)
    if (!currentExpiry || currentExpiry <= Date.now()) {
        memoryNonceExpiry.set(key, expiresAt)
        memoryNonceValue.set(key, nonce)
    }
}

export async function verifyAttemptNonce(
    attemptId: string,
    providedNonce: string | null | undefined
): Promise<NonceVerifyResult> {
    if (!providedNonce || !isNonceValid(providedNonce)) {
        return { ok: false, reason: 'missing' }
    }

    const stored = await getStoredNonce(attemptId)
    if (!stored) {
        await storeNonceIfMissing(attemptId, providedNonce)
        return { ok: true }
    }

    const storedBuffer = Buffer.from(stored)
    const providedBuffer = Buffer.from(providedNonce)
    if (storedBuffer.length !== providedBuffer.length) {
        return { ok: false, reason: 'mismatch' }
    }

    if (!timingSafeEqual(storedBuffer, providedBuffer)) {
        return { ok: false, reason: 'mismatch' }
    }

    return { ok: true }
}

const isRequestIdValid = (value: string): boolean =>
    value.length >= 8 && value.length <= 128

export async function ensureIdempotency(
    attemptId: string,
    requestId: string | null | undefined,
    scope: string
): Promise<IdempotencyResult> {
    if (!requestId || !isRequestIdValid(requestId)) {
        return { first: false }
    }

    const redis = ensureRedisAvailable()
    const key = `${REQUEST_KEY_PREFIX}:${scope}:${attemptId}:${requestId}`

    if (redis) {
        const result = await redis.set(key, '1', 'EX', REQUEST_TTL_SECONDS, 'NX')
        return { first: result === 'OK' }
    }

    const now = Date.now()
    const expiresAt = memoryRequestExpiry.get(key)
    if (expiresAt && expiresAt > now) {
        return { first: false }
    }
    memoryRequestExpiry.set(key, now + REQUEST_TTL_SECONDS * 1000)
    return { first: true }
}
