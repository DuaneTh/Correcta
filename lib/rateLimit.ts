import { createHash } from 'node:crypto'
import Redis from 'ioredis'

export type RateLimitOptions = {
    windowSeconds: number
    max: number
    prefix: string
}

export type RateLimitResult = {
    ok: boolean
    remaining: number
    reset: number
}

type MemoryBucket = {
    count: number
    reset: number
}

const memoryStore = new Map<string, MemoryBucket>()
let redisClient: Redis | null = null

const getRedisUrl = (): string | undefined =>
    process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL

const isRateLimitEnabled = (): boolean =>
    process.env.RATE_LIMIT_ENABLED !== 'false'

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

const redisScript = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`

export function hashRateLimitKey(value: string): string {
    return createHash('sha256').update(value).digest('hex')
}

export async function rateLimit(
    key: string,
    opts: RateLimitOptions
): Promise<RateLimitResult> {
    const now = Math.floor(Date.now() / 1000)
    const fullKey = `${opts.prefix}:${key}`

    if (!isRateLimitEnabled()) {
        return { ok: true, remaining: opts.max, reset: now + opts.windowSeconds }
    }

    const redis = getRedisClient()
    if (redis) {
        const result = await redis.eval(redisScript, 1, fullKey, opts.windowSeconds)
        const [currentRaw, ttlRaw] = result as [number, number]
        const current = Number(currentRaw)
        const ttl = Number(ttlRaw)
        const reset = now + (ttl > 0 ? ttl : opts.windowSeconds)
        const remaining = Math.max(0, opts.max - current)
        return { ok: current <= opts.max, remaining, reset }
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('Rate limiting requires Redis in production')
    }

    const existing = memoryStore.get(fullKey)
    if (!existing || now >= existing.reset) {
        const reset = now + opts.windowSeconds
        memoryStore.set(fullKey, { count: 1, reset })
        return { ok: true, remaining: opts.max - 1, reset }
    }

    existing.count += 1
    const remaining = Math.max(0, opts.max - existing.count)
    return { ok: existing.count <= opts.max, remaining, reset: existing.reset }
}

export function getRateLimitHeaders(
    result: RateLimitResult,
    opts: RateLimitOptions
): Record<string, string> {
    return {
        'X-RateLimit-Limit': String(opts.max),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.reset)
    }
}

export function getRetryAfterSeconds(result: RateLimitResult): number {
    const now = Math.floor(Date.now() / 1000)
    return Math.max(0, result.reset - now)
}

export function buildRateLimitResponse(
    result: RateLimitResult,
    opts: RateLimitOptions
): { status: number; body: { error: string }; headers: Record<string, string> } {
    const headers = getRateLimitHeaders(result, opts)
    headers['Retry-After'] = String(getRetryAfterSeconds(result))
    return {
        status: 429,
        body: { error: 'RATE_LIMITED' },
        headers
    }
}

export function getClientIdentifier(req: Request): string {
    const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const realIp = req.headers.get('x-real-ip')
    return forwarded || realIp || 'unknown'
}
