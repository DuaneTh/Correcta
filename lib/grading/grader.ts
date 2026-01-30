import { zodResponseFormat } from 'openai/helpers/zod'
import { getOpenAIClient, GRADING_MODEL } from './openai-client'
import { GradingResponseSchema, type GradingResponse } from './schemas'
import { buildGradingUserPrompt } from './prompts'
import { logAIInteraction, getPrompt } from './ai-logger'

export type GradeAnswerParams = {
    question: string
    rubric: string
    studentAnswer: string
    maxPoints: number
    // Optional metadata for logging
    attemptId?: string
    answerId?: string
    questionId?: string
    userId?: string
}

/**
 * Grades a student answer using GPT-4 with structured output
 *
 * @param params - Question content, rubric (JSON string), student answer, and max points
 * @returns Grading response with score, feedback, and AI rationale
 * @throws Error if OpenAI is not configured or API call fails
 */
export async function gradeAnswer(params: GradeAnswerParams): Promise<GradingResponse> {
    const startTime = Date.now()
    const openai = await getOpenAIClient()

    // Get system prompt (custom or default)
    const systemPrompt = await getPrompt('GRADING_SYSTEM')

    const userPrompt = buildGradingUserPrompt({
        question: params.question,
        rubric: params.rubric,
        studentAnswer: params.studentAnswer,
        maxPoints: params.maxPoints
    })

    let rawResponse: string | undefined
    let tokensInput: number | undefined
    let tokensOutput: number | undefined

    try {
        const completion = await openai.chat.completions.parse({
            model: GRADING_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: zodResponseFormat(GradingResponseSchema, 'grading'),
            temperature: 0, // Deterministic grading
            max_tokens: 1000
        })

        rawResponse = JSON.stringify(completion.choices[0]?.message)
        tokensInput = completion.usage?.prompt_tokens
        tokensOutput = completion.usage?.completion_tokens

        const parsed = completion.choices[0]?.message?.parsed
        if (!parsed) {
            throw new Error('Failed to parse grading response from OpenAI')
        }

        // Clamp score to valid range [0, maxPoints]
        const clampedScore = Math.min(params.maxPoints, Math.max(0, parsed.score))

        const result: GradingResponse = {
            ...parsed,
            score: clampedScore
        }

        // Log successful interaction
        const durationMs = Date.now() - startTime
        await logAIInteraction({
            attemptId: params.attemptId,
            answerId: params.answerId,
            questionId: params.questionId,
            operation: 'GRADING',
            model: GRADING_MODEL,
            systemPrompt,
            userPrompt,
            rawResponse,
            score: result.score,
            feedback: result.feedback,
            aiRationale: result.aiRationale,
            tokensInput,
            tokensOutput,
            durationMs,
            success: true,
            createdBy: params.userId
        })

        return result
    } catch (error) {
        // Log failed interaction
        const durationMs = Date.now() - startTime
        await logAIInteraction({
            attemptId: params.attemptId,
            answerId: params.answerId,
            questionId: params.questionId,
            operation: 'GRADING',
            model: GRADING_MODEL,
            systemPrompt,
            userPrompt,
            rawResponse,
            tokensInput,
            tokensOutput,
            durationMs,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            createdBy: params.userId
        })

        throw error
    }
}
