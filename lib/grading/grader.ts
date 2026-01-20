import { zodResponseFormat } from 'openai/helpers/zod'
import { openai, GRADING_MODEL, isOpenAIConfigured } from './openai-client'
import { GradingResponseSchema, type GradingResponse } from './schemas'
import { GRADING_SYSTEM_PROMPT, buildGradingUserPrompt } from './prompts'

export type GradeAnswerParams = {
    question: string
    rubric: string
    studentAnswer: string
    maxPoints: number
}

/**
 * Grades a student answer using GPT-4 with structured output
 *
 * @param params - Question content, rubric (JSON string), student answer, and max points
 * @returns Grading response with score, feedback, and AI rationale
 * @throws Error if OpenAI is not configured or API call fails
 */
export async function gradeAnswer(params: GradeAnswerParams): Promise<GradingResponse> {
    if (!isOpenAIConfigured()) {
        throw new Error('OpenAI API key is not configured')
    }

    const userPrompt = buildGradingUserPrompt({
        question: params.question,
        rubric: params.rubric,
        studentAnswer: params.studentAnswer,
        maxPoints: params.maxPoints
    })

    const completion = await openai.chat.completions.parse({
        model: GRADING_MODEL,
        messages: [
            { role: 'system', content: GRADING_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
        ],
        response_format: zodResponseFormat(GradingResponseSchema, 'grading'),
        temperature: 0, // Deterministic grading
        max_tokens: 1000
    })

    const parsed = completion.choices[0]?.message?.parsed
    if (!parsed) {
        throw new Error('Failed to parse grading response from OpenAI')
    }

    // Clamp score to valid range [0, maxPoints]
    const clampedScore = Math.min(params.maxPoints, Math.max(0, parsed.score))

    return {
        ...parsed,
        score: clampedScore
    }
}
