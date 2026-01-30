import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

/**
 * OpenAI Client for AI Grading
 *
 * API key resolution order:
 * 1. Database (SystemSetting with key 'OPENAI_API_KEY')
 * 2. Environment variable (OPENAI_API_KEY)
 *
 * Uses gpt-4o model for grading operations.
 */

let cachedApiKey: string | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 60 * 1000 // 1 minute cache

/**
 * Get the OpenAI API key from database or environment
 * Caches the result for 1 minute to avoid repeated DB queries
 */
async function getOpenAIApiKey(): Promise<string | null> {
    const now = Date.now()

    // Return cached value if still valid
    if (cachedApiKey && now - cacheTimestamp < CACHE_TTL_MS) {
        return cachedApiKey
    }

    // Try to get from database first
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: 'OPENAI_API_KEY' }
        })

        if (setting && setting.encrypted) {
            const decrypted = decrypt(setting.value)
            if (decrypted && decrypted.startsWith('sk-')) {
                cachedApiKey = decrypted
                cacheTimestamp = now
                return cachedApiKey
            }
        }
    } catch (error) {
        console.warn('[OpenAI] Failed to fetch API key from database:', error)
    }

    // Fallback to environment variable
    const envKey = process.env.OPENAI_API_KEY
    if (envKey) {
        cachedApiKey = envKey
        cacheTimestamp = now
        return cachedApiKey
    }

    return null
}

/**
 * Clear the API key cache (call after updating the key in settings)
 */
export function clearApiKeyCache(): void {
    cachedApiKey = null
    cacheTimestamp = 0
}

/**
 * Check if OpenAI is properly configured
 */
export async function isOpenAIConfigured(): Promise<boolean> {
    const apiKey = await getOpenAIApiKey()
    return Boolean(apiKey)
}

/**
 * Check if OpenAI is configured (synchronous, uses cache or env only)
 * Use this for quick checks where async is not possible
 */
export function isOpenAIConfiguredSync(): boolean {
    if (cachedApiKey) return true
    return Boolean(process.env.OPENAI_API_KEY)
}

/**
 * Create an OpenAI client instance with the configured API key
 * Returns null if no API key is configured
 */
export async function createOpenAIClient(): Promise<OpenAI | null> {
    const apiKey = await getOpenAIApiKey()

    if (!apiKey) {
        console.warn('[OpenAI] No API key configured')
        return null
    }

    return new OpenAI({ apiKey })
}

/**
 * Get the OpenAI client, throwing if not configured
 * Use this when OpenAI is required for the operation
 */
export async function getOpenAIClient(): Promise<OpenAI> {
    const client = await createOpenAIClient()

    if (!client) {
        throw new Error('OpenAI is not configured. Please set the API key in platform settings.')
    }

    return client
}

/**
 * Default model used for grading operations
 */
export const GRADING_MODEL = 'gpt-4o' as const
