import { zodResponseFormat } from 'openai/helpers/zod'
import { getOpenAIClient, GRADING_MODEL } from '@/lib/grading/openai-client'
import { ExamExtractionSchema, type ExamExtraction } from './schemas'
import { getPresignedDownloadUrl, DEFAULT_BUCKET } from '@/lib/storage/minio'
import { logAIInteraction } from '@/lib/grading/ai-logger'

/**
 * Extract exam structure from PDF using GPT-4o
 *
 * Uses GPT-4o's native PDF vision capabilities to analyze exam documents
 * and extract structured data (questions, types, points, correction guidelines).
 *
 * @param params.pdfKey - MinIO object key for the PDF file
 * @param params.userId - Optional user ID for logging
 * @returns Structured exam extraction with questions, types, and metadata
 * @throws Error if OpenAI is not configured or API call fails
 */
export async function extractExamFromPDF(params: {
  pdfKey: string
  userId?: string
}): Promise<ExamExtraction> {
  const startTime = Date.now()
  const openai = await getOpenAIClient()

  // Generate presigned download URL from MinIO (1 hour expiry)
  const pdfUrl = await getPresignedDownloadUrl(DEFAULT_BUCKET, params.pdfKey, 3600)

  // System prompt - Guide GPT-4o on extraction task
  const systemPrompt = `Tu es un assistant specialise dans l'extraction de structure d'examens depuis des documents PDF.

Ton role est d'analyser le PDF fourni et d'extraire :
1. Le titre de l'examen
2. Les questions avec leur numero, type (TEXT ou MCQ), contenu, et points
3. Les baremes ou corriges s'ils sont presents
4. Pour les MCQ, les options avec indication de reponse correcte si disponible

Regles importantes :
- Si une information est ambigue ou absente, utilise null plutot que d'inventer
- Les formules mathematiques doivent etre en LaTeX avec $...$
- Distingue les questions ouvertes (TEXT) des questions a choix multiple (MCQ)
- Pour les MCQ, extrais toutes les options et marque isCorrect=true pour les reponses correctes si le corrige est present
- Si le corrige n'est pas present, utilise isCorrect=null pour les options
- Inclus des warnings dans metadata.warnings pour tout ce qui est ambigu ou manquant
- Evalue ton niveau de confiance dans l'extraction (high/medium/low)`

  const userPrompt = `Analyse ce document PDF d'examen et extrais sa structure complete.`

  let rawResponse: string | undefined
  let tokensInput: number | undefined
  let tokensOutput: number | undefined

  try {
    const completion = await openai.chat.completions.parse({
      model: GRADING_MODEL, // gpt-4o supports PDF vision
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image_url',
              image_url: {
                url: pdfUrl,
                detail: 'high' // High detail for better text extraction
              }
            }
          ]
        }
      ],
      response_format: zodResponseFormat(ExamExtractionSchema, 'exam_extraction'),
      temperature: 0.1, // Low temperature for more consistent extraction
      max_tokens: 4000
    })

    rawResponse = JSON.stringify(completion.choices[0]?.message)
    tokensInput = completion.usage?.prompt_tokens
    tokensOutput = completion.usage?.completion_tokens

    const parsed = completion.choices[0]?.message?.parsed
    if (!parsed) {
      throw new Error('Failed to parse exam extraction response from OpenAI')
    }

    // Log successful interaction
    const durationMs = Date.now() - startTime
    await logAIInteraction({
      operation: 'PDF_IMPORT',
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

    return parsed
  } catch (error) {
    // Log failed interaction
    const durationMs = Date.now() - startTime
    await logAIInteraction({
      operation: 'PDF_IMPORT',
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
