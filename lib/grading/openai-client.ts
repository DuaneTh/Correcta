import OpenAI from 'openai'

/**
 * OpenAI Client Singleton
 *
 * Provides a single instance of the OpenAI client configured
 * with the API key from environment variables.
 *
 * Uses gpt-4o model for grading operations.
 */

const apiKey = process.env.OPENAI_API_KEY

if (!apiKey) {
    console.warn('[OpenAI] OPENAI_API_KEY environment variable is not set')
}

/**
 * Singleton OpenAI client instance
 * Will throw on API calls if OPENAI_API_KEY is not set
 */
export const openai = new OpenAI({
    apiKey: apiKey || 'missing-api-key', // Provide fallback to prevent client crash on import
})

/**
 * Check if OpenAI is properly configured
 */
export function isOpenAIConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY)
}

/**
 * Default model used for grading operations
 */
export const GRADING_MODEL = 'gpt-4o' as const
