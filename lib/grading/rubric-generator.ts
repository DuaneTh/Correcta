import { zodResponseFormat } from 'openai/helpers/zod'
import { getOpenAIClient, GRADING_MODEL } from './openai-client'
import { RubricSchema, type Rubric } from './schemas'
import { buildRubricUserPrompt } from './prompts'
import { logAIInteraction, getPrompt } from './ai-logger'

export type GenerateRubricParams = {
    questionContent: string
    correctionGuidelines: string | null
    maxPoints: number
    // Optional metadata for logging
    questionId?: string
    userId?: string
}

/**
 * Generates a grading rubric from question content using GPT-4
 *
 * @param params - Question content, optional correction guidelines, and max points
 * @returns Parsed rubric with criteria and total points
 * @throws Error if OpenAI is not configured or API call fails
 */
export async function generateRubric(params: GenerateRubricParams): Promise<Rubric> {
    const startTime = Date.now()
    const openai = await getOpenAIClient()

    // Get system prompt (custom or default)
    const systemPrompt = await getPrompt('RUBRIC_SYSTEM')

    const userPrompt = buildRubricUserPrompt({
        questionContent: params.questionContent,
        correctionGuidelines: params.correctionGuidelines,
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
            response_format: zodResponseFormat(RubricSchema, 'rubric'),
            temperature: 0.3, // Some creativity for rubric generation
            max_tokens: 1000
        })

        rawResponse = JSON.stringify(completion.choices[0]?.message)
        tokensInput = completion.usage?.prompt_tokens
        tokensOutput = completion.usage?.completion_tokens

        const parsed = completion.choices[0]?.message?.parsed
        if (!parsed) {
            throw new Error('Failed to parse rubric response from OpenAI')
        }

        let result = parsed

        // Validate that total points match expected max
        if (parsed.totalPoints !== params.maxPoints) {
            // Normalize criteria points proportionally if needed
            const ratio = params.maxPoints / parsed.totalPoints
            const normalizedCriteria = parsed.criteria.map(criterion => ({
                ...criterion,
                points: Math.round(criterion.points * ratio * 10) / 10
            }))

            result = {
                criteria: normalizedCriteria,
                totalPoints: params.maxPoints
            }
        }

        // Log successful interaction
        const durationMs = Date.now() - startTime
        await logAIInteraction({
            questionId: params.questionId,
            operation: 'RUBRIC_GENERATION',
            model: GRADING_MODEL,
            systemPrompt,
            userPrompt,
            rawResponse,
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
            questionId: params.questionId,
            operation: 'RUBRIC_GENERATION',
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
