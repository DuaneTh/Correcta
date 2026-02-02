import { prisma } from '@/lib/prisma'
import { GRADING_SYSTEM_PROMPT, RUBRIC_GENERATION_PROMPT } from './prompts'

export type AIOperation = 'GRADING' | 'RUBRIC_GENERATION' | 'PDF_IMPORT' | 'TEST'

export type AILogEntry = {
    attemptId?: string
    answerId?: string
    questionId?: string
    operation: AIOperation
    model: string
    systemPrompt: string
    userPrompt: string
    rawResponse?: string
    score?: number
    feedback?: string
    aiRationale?: string
    tokensInput?: number
    tokensOutput?: number
    durationMs?: number
    success: boolean
    error?: string
    createdBy?: string
}

/**
 * Log an AI interaction to the database
 */
export async function logAIInteraction(entry: AILogEntry): Promise<void> {
    try {
        await prisma.aIGradingLog.create({
            data: {
                attemptId: entry.attemptId,
                answerId: entry.answerId,
                questionId: entry.questionId,
                operation: entry.operation,
                model: entry.model,
                systemPrompt: entry.systemPrompt,
                userPrompt: entry.userPrompt,
                rawResponse: entry.rawResponse,
                score: entry.score,
                feedback: entry.feedback,
                aiRationale: entry.aiRationale,
                tokensInput: entry.tokensInput,
                tokensOutput: entry.tokensOutput,
                durationMs: entry.durationMs,
                success: entry.success,
                error: entry.error,
                createdBy: entry.createdBy
            }
        })
    } catch (error) {
        // Don't fail the grading if logging fails
        console.error('[AI Logger] Failed to log AI interaction:', error)
    }
}

/**
 * Get a prompt from database or return default
 */
export async function getPrompt(key: string): Promise<string> {
    try {
        const customPrompt = await prisma.aIPromptConfig.findUnique({
            where: { key, isActive: true }
        })

        if (customPrompt) {
            return customPrompt.content
        }
    } catch (error) {
        console.warn('[AI Logger] Failed to fetch custom prompt, using default:', error)
    }

    // Return defaults
    switch (key) {
        case 'GRADING_SYSTEM':
            return GRADING_SYSTEM_PROMPT
        case 'RUBRIC_SYSTEM':
            return RUBRIC_GENERATION_PROMPT
        default:
            throw new Error(`Unknown prompt key: ${key}`)
    }
}
