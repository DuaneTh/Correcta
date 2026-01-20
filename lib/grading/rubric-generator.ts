import { zodResponseFormat } from 'openai/helpers/zod'
import { openai, GRADING_MODEL, isOpenAIConfigured } from './openai-client'
import { RubricSchema, type Rubric } from './schemas'
import { RUBRIC_GENERATION_PROMPT, buildRubricUserPrompt } from './prompts'

export type GenerateRubricParams = {
    questionContent: string
    correctionGuidelines: string | null
    maxPoints: number
}

/**
 * Generates a grading rubric from question content using GPT-4
 *
 * @param params - Question content, optional correction guidelines, and max points
 * @returns Parsed rubric with criteria and total points
 * @throws Error if OpenAI is not configured or API call fails
 */
export async function generateRubric(params: GenerateRubricParams): Promise<Rubric> {
    if (!isOpenAIConfigured()) {
        throw new Error('OpenAI API key is not configured')
    }

    const userPrompt = buildRubricUserPrompt({
        questionContent: params.questionContent,
        correctionGuidelines: params.correctionGuidelines,
        maxPoints: params.maxPoints
    })

    const completion = await openai.chat.completions.parse({
        model: GRADING_MODEL,
        messages: [
            { role: 'system', content: RUBRIC_GENERATION_PROMPT },
            { role: 'user', content: userPrompt }
        ],
        response_format: zodResponseFormat(RubricSchema, 'rubric'),
        temperature: 0.3, // Some creativity for rubric generation
        max_tokens: 1000
    })

    const parsed = completion.choices[0]?.message?.parsed
    if (!parsed) {
        throw new Error('Failed to parse rubric response from OpenAI')
    }

    // Validate that total points match expected max
    if (parsed.totalPoints !== params.maxPoints) {
        // Normalize criteria points proportionally if needed
        const ratio = params.maxPoints / parsed.totalPoints
        const normalizedCriteria = parsed.criteria.map(criterion => ({
            ...criterion,
            points: Math.round(criterion.points * ratio * 10) / 10
        }))

        return {
            criteria: normalizedCriteria,
            totalPoints: params.maxPoints
        }
    }

    return parsed
}
