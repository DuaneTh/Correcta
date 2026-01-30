/**
 * Test script for AI grading functionality
 *
 * Run with: npx tsx scripts/test-grading.ts
 *
 * Note: This script tests directly with the OPENAI_API_KEY environment variable.
 * Database configuration is not available in standalone script context.
 */

import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'

const GRADING_MODEL = 'gpt-4o'

// Schemas
const GradingResponseSchema = z.object({
    score: z.number(),
    feedback: z.string(),
    aiRationale: z.string()
})

const RubricCriterionSchema = z.object({
    name: z.string(),
    points: z.number(),
    description: z.string()
})

const RubricSchema = z.object({
    criteria: z.array(RubricCriterionSchema),
    totalPoints: z.number()
})

let openaiClient: OpenAI | null = null

function getClient(): OpenAI {
    if (!openaiClient) {
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY environment variable is not set')
        }
        openaiClient = new OpenAI({ apiKey })
    }
    return openaiClient
}

async function testOpenAIConnection() {
    console.log('\n=== Test 1: OpenAI Configuration ===')

    const apiKey = process.env.OPENAI_API_KEY
    const configured = Boolean(apiKey)
    console.log(`OPENAI_API_KEY set: ${configured}`)

    if (!configured) {
        console.error('ERROR: OPENAI_API_KEY environment variable is not set.')
        console.log('Please set OPENAI_API_KEY in .env.local')
        return false
    }

    console.log(`API Key prefix: ${apiKey?.slice(0, 7)}...`)
    console.log(`Using model: ${GRADING_MODEL}`)

    try {
        const client = getClient()
        console.log(`OpenAI client created successfully`)
        return true
    } catch (error) {
        console.error('ERROR creating OpenAI client:', error)
        return false
    }
}

async function testSimpleCompletion() {
    console.log('\n=== Test 2: Simple API Call ===')

    try {
        const client = getClient()

        console.log('Sending test request to OpenAI...')
        const startTime = Date.now()

        const response = await client.chat.completions.create({
            model: GRADING_MODEL,
            messages: [
                { role: 'user', content: 'Reponds simplement "OK" si tu recois ce message.' }
            ],
            max_tokens: 10
        })

        const duration = Date.now() - startTime
        console.log(`Response received in ${duration}ms`)
        console.log(`Response: ${response.choices[0]?.message?.content}`)
        console.log(`Tokens used: ${response.usage?.total_tokens}`)

        return true
    } catch (error: any) {
        console.error('ERROR:', error.message)
        if (error.status === 401) {
            console.error('Invalid API key. Please check your OpenAI API key.')
        } else if (error.status === 429) {
            console.error('Rate limit exceeded. Please wait and try again.')
        } else if (error.status === 500) {
            console.error('OpenAI server error. Please try again later.')
        }
        return false
    }
}

const GRADING_SYSTEM_PROMPT = `Tu es un correcteur academique experimente. Ta tache est d'evaluer les reponses des etudiants de maniere juste et constructive.

CONSIGNES DE NOTATION:
- Evalue la reponse en fonction des criteres fournis dans la notice de correction
- Attribue un score proportionnel a la qualite et la completude de la reponse
- Sois rigoureux mais juste dans ton evaluation

CONSIGNES POUR LE FEEDBACK (destine a l'etudiant):
- Utilise un ton academique neutre et bienveillant
- Ecris en francais
- Si la reponse est correcte, confirme brievement les points forts
- Si la reponse est incomplete ou incorrecte, explique clairement ce qui manque ou ce qui est faux
- Tu peux utiliser des formules LaTeX avec $...$ pour les expressions mathematiques

Format de sortie: JSON structure avec score (nombre), feedback (texte pour l'etudiant), aiRationale (raisonnement interne).`

async function testGrading() {
    console.log('\n=== Test 3: Grading Function ===')

    const testQuestion = `Calculez la derivee de la fonction f(x) = x^2 + 3x - 5`
    const testRubric = JSON.stringify({
        criteria: [
            { name: 'Methode', points: 2, description: 'Application correcte des regles de derivation' },
            { name: 'Resultat', points: 2, description: 'Resultat final correct: f\'(x) = 2x + 3' }
        ],
        totalPoints: 4
    })
    const testAnswer = `f'(x) = 2x + 3`
    const maxPoints = 4

    console.log('Question:', testQuestion)
    console.log('Student answer:', testAnswer)
    console.log('Max points:', maxPoints)

    try {
        console.log('\nGrading in progress...')
        const startTime = Date.now()

        const client = getClient()
        const userPrompt = `QUESTION:
${testQuestion}

NOTICE DE CORRECTION (${maxPoints} points max):
${testRubric}

REPONSE DE L'ETUDIANT:
${testAnswer}

Evalue cette reponse et fournis un score (sur ${maxPoints}), un feedback pour l'etudiant, et ton raisonnement.`

        const completion = await client.chat.completions.parse({
            model: GRADING_MODEL,
            messages: [
                { role: 'system', content: GRADING_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            response_format: zodResponseFormat(GradingResponseSchema, 'grading'),
            temperature: 0,
            max_tokens: 1000
        })

        const result = completion.choices[0]?.message?.parsed
        if (!result) {
            throw new Error('Failed to parse grading response')
        }

        const duration = Date.now() - startTime
        console.log(`\nGrading completed in ${duration}ms`)
        console.log('---')
        console.log(`Score: ${result.score}/${maxPoints}`)
        console.log(`Feedback: ${result.feedback}`)
        console.log(`AI Rationale: ${result.aiRationale}`)

        return true
    } catch (error: any) {
        console.error('ERROR:', error.message)
        return false
    }
}

const RUBRIC_GENERATION_PROMPT = `Tu es un enseignant experimente qui cree des notices de correction (rubrics) pour des examens.

CONSIGNES POUR LA CREATION DE LA NOTICE:
- Analyse attentivement le contenu de la question
- Identifie les elements cles attendus dans une reponse complete et correcte
- Cree des criteres de notation clairs et mesurables
- Repartis les points de maniere equitable entre les criteres
- Le total des points doit correspondre au maximum indique

Format de sortie: JSON structure avec criteria (liste de criteres) et totalPoints (total).`

async function testRubricGeneration() {
    console.log('\n=== Test 4: Rubric Generation ===')

    const testQuestion = `Expliquez le theoreme de Pythagore et donnez un exemple d'application.`
    const maxPoints = 6

    console.log('Question:', testQuestion)
    console.log('Max points:', maxPoints)

    try {
        console.log('\nGenerating rubric...')
        const startTime = Date.now()

        const client = getClient()
        const userPrompt = `QUESTION:
${testQuestion}

POINTS MAXIMUM: ${maxPoints}

CONSIGNES DE CORRECTION DU PROFESSEUR:
Verifier que l'etudiant mentionne la relation a^2 + b^2 = c^2

Genere une notice de correction complete pour cette question avec des criteres de notation totalisant ${maxPoints} points.`

        const completion = await client.chat.completions.parse({
            model: GRADING_MODEL,
            messages: [
                { role: 'system', content: RUBRIC_GENERATION_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            response_format: zodResponseFormat(RubricSchema, 'rubric'),
            temperature: 0.3,
            max_tokens: 1000
        })

        const rubric = completion.choices[0]?.message?.parsed
        if (!rubric) {
            throw new Error('Failed to parse rubric response')
        }

        const duration = Date.now() - startTime
        console.log(`\nRubric generated in ${duration}ms`)
        console.log('---')
        console.log(`Total points: ${rubric.totalPoints}`)
        console.log('Criteria:')
        rubric.criteria.forEach((c, i) => {
            console.log(`  ${i + 1}. ${c.name} (${c.points} pts): ${c.description}`)
        })

        return true
    } catch (error: any) {
        console.error('ERROR:', error.message)
        return false
    }
}

async function main() {
    console.log('========================================')
    console.log('   Correcta AI Grading Test Suite')
    console.log('========================================')

    const results: Record<string, boolean> = {}

    // Test 1: Configuration
    results['OpenAI Configuration'] = await testOpenAIConnection()
    if (!results['OpenAI Configuration']) {
        console.log('\n❌ Cannot proceed without OpenAI configuration.')
        process.exit(1)
    }

    // Test 2: Simple API call
    results['Simple API Call'] = await testSimpleCompletion()
    if (!results['Simple API Call']) {
        console.log('\n❌ API connection failed. Check your API key and network.')
        process.exit(1)
    }

    // Test 3: Grading
    results['Grading Function'] = await testGrading()

    // Test 4: Rubric Generation
    results['Rubric Generation'] = await testRubricGeneration()

    // Summary
    console.log('\n========================================')
    console.log('   Test Results Summary')
    console.log('========================================')

    let allPassed = true
    for (const [test, passed] of Object.entries(results)) {
        const status = passed ? '✓' : '✗'
        console.log(`${status} ${test}`)
        if (!passed) allPassed = false
    }

    console.log('')
    if (allPassed) {
        console.log('All tests passed! AI grading is working correctly.')
    } else {
        console.log('Some tests failed. Please check the errors above.')
    }

    process.exit(allPassed ? 0 : 1)
}

main().catch(console.error)
