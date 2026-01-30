import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isPlatformAdmin } from '@/lib/api-auth'
import { isOpenAIConfigured, getOpenAIClient, GRADING_MODEL } from '@/lib/grading/openai-client'
import { gradeAnswer } from '@/lib/grading/grader'

/**
 * GET /api/admin/platform/test-openai
 * Test OpenAI configuration and grading functionality
 * Only accessible by platform admins
 */
export async function GET(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isPlatformAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results: Record<string, any> = {
        timestamp: new Date().toISOString(),
        tests: {}
    }

    // Test 1: Check if OpenAI is configured
    try {
        const configured = await isOpenAIConfigured()
        results.tests.configuration = {
            success: configured,
            message: configured ? 'OpenAI API key is configured' : 'OpenAI API key is NOT configured'
        }

        if (!configured) {
            return NextResponse.json({
                ...results,
                success: false,
                error: 'OpenAI is not configured. Please set the API key in platform settings.'
            })
        }
    } catch (error: any) {
        results.tests.configuration = {
            success: false,
            error: error.message
        }
        return NextResponse.json({ ...results, success: false })
    }

    // Test 2: Simple API call
    try {
        const client = await getOpenAIClient()
        const startTime = Date.now()

        const response = await client.chat.completions.create({
            model: GRADING_MODEL,
            messages: [
                { role: 'user', content: 'Reponds simplement "OK" si tu recois ce message.' }
            ],
            max_tokens: 10
        })

        const duration = Date.now() - startTime
        results.tests.simpleCall = {
            success: true,
            duration: `${duration}ms`,
            model: GRADING_MODEL,
            response: response.choices[0]?.message?.content,
            tokensUsed: response.usage?.total_tokens
        }
    } catch (error: any) {
        results.tests.simpleCall = {
            success: false,
            error: error.message,
            status: error.status,
            hint: error.status === 401 ? 'Invalid API key' :
                  error.status === 429 ? 'Rate limit exceeded' :
                  error.status === 500 ? 'OpenAI server error' : null
        }
        return NextResponse.json({ ...results, success: false })
    }

    // Test 3: Grading function with structured output
    try {
        const testQuestion = 'Calculez la derivee de f(x) = x^2 + 3x - 5'
        const testRubric = JSON.stringify({
            criteria: [
                { name: 'Methode', points: 2, description: 'Application correcte des regles de derivation' },
                { name: 'Resultat', points: 2, description: 'Resultat final correct: f\'(x) = 2x + 3' }
            ],
            totalPoints: 4
        })
        const testAnswer = 'f\'(x) = 2x + 3'

        const startTime = Date.now()

        const gradingResult = await gradeAnswer({
            question: testQuestion,
            rubric: testRubric,
            studentAnswer: testAnswer,
            maxPoints: 4
        })

        const duration = Date.now() - startTime
        results.tests.grading = {
            success: true,
            duration: `${duration}ms`,
            input: {
                question: testQuestion,
                studentAnswer: testAnswer,
                maxPoints: 4
            },
            output: {
                score: gradingResult.score,
                feedback: gradingResult.feedback,
                aiRationale: gradingResult.aiRationale
            }
        }
    } catch (error: any) {
        results.tests.grading = {
            success: false,
            error: error.message
        }
        return NextResponse.json({ ...results, success: false })
    }

    return NextResponse.json({
        ...results,
        success: true,
        message: 'All tests passed! AI grading is working correctly.'
    })
}
