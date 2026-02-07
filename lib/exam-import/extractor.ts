import { zodResponseFormat } from 'openai/helpers/zod'
import { getOpenAIClient, GRADING_MODEL } from '@/lib/grading/openai-client'
import { ExamExtractionSchema, type ExamExtraction } from './schemas'
import { downloadFile } from '@/lib/storage/minio'
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

  // Download PDF and convert to base64 for inline sending
  // (presigned URLs point to localhost which OpenAI cannot access)
  const pdfBuffer = await downloadFile(params.pdfKey)
  const pdfBase64 = pdfBuffer.toString('base64')
  const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`

  // System prompt - Guide GPT-4o on hierarchical exercise extraction with rich content
  const systemPrompt = `Tu es un assistant specialise dans l'extraction de structure d'examens.

Analyse le PDF et extrais la structure HIERARCHIQUE de l'examen.

## STRUCTURE ATTENDUE
- Un examen contient des EXERCICES (numerotes 1, 2, 3...)
- Chaque exercice a un enonce/contexte commun (preamble) et des SOUS-QUESTIONS
- Les sous-questions sont labellisees (1), 2), a), b), etc.)

## APLATISSEMENT DES PARTIES IMBRIQUEES (TRES IMPORTANT)
Si un exercice a des sous-parties (ex: Partie A, Partie B chacune avec des questions a, b, c) :
- NE PAS essayer de representer la hierarchie intermediaire
- APLATIR en une seule liste sequentielle de sous-questions
- Exemple : Exercice 1, Partie A (a,b,c), Partie B (a,b) → sous-questions: A.a, A.b, A.c, B.a, B.b
- Inclure le contexte de chaque partie au debut de la premiere sous-question correspondante
- Le label doit refléter l'origine : "A.1)", "A.a)", "B.1)", etc.

## FORMAT DU CONTENU (TRES IMPORTANT)
Chaque segment est un objet PLAT avec TOUS les champs — mettre null pour les champs non utilises selon le type.

Exemples :
- Texte : {"type": "text", "text": "Calculer la valeur de", "latex": null, "rows": null, "pageNumber": null, "boundingBox": null, "alt": null}
- Math : {"type": "math", "text": null, "latex": "\\\\frac{x^2+1}{x-1}", "rows": null, "pageNumber": null, "boundingBox": null, "alt": null}
- Tableau : {"type": "table", "text": null, "latex": null, "rows": [[[{"type":"text","text":"A","latex":null}]]], "pageNumber": null, "boundingBox": null, "alt": null}
- Figure : {"type": "image_ref", "text": null, "latex": null, "rows": null, "pageNumber": 1, "boundingBox": {"xPercent": 10, "yPercent": 30, "widthPercent": 80, "heightPercent": 40}, "alt": "Graphique de f(x)"}

REGLES pour le contenu :
- TOUJOURS inclure TOUS les champs dans chaque segment (type, text, latex, rows, pageNumber, boundingBox, alt)
- Mettre null pour les champs non pertinents au type
- ALTERNER segments text et math — ne jamais mettre de LaTeX dans un segment text
- Le LaTeX est BRUT sans delimiteurs $ — juste la formule : "x^2 + 1" et non "$x^2 + 1$"
- Si du texte contient "Calculer $\\int_0^1 f(x) dx$" → 3 segments text, math, text
- Les tableaux dans le PDF → segment table avec rows[ligne][colonne] = [segments]
- Les cellules de tableau = {"type":"text"|"math", "text": ..., "latex": ...} (tous les champs presents, null si non utilise)

## FIGURES ET IMAGES (TRES IMPORTANT)
Quand le PDF contient des figures, graphiques, schemas ou photos :
- Inserer un segment image_ref A L'ENDROIT ou la figure apparait dans le contenu de la question/preamble
- pageNumber = numero de la page (1-indexed) ou se trouve la figure
- boundingBox = zone de la figure en POURCENTAGES (0-100) de la page :
  - xPercent, yPercent = coin superieur-gauche
  - widthPercent, heightPercent = dimensions de la zone
- alt = description courte et utile de la figure (ex: "Schema du circuit electrique", "Graphique de f(x)=x^2")
- Etre PRECIS sur le cadrage : la zone doit contenir TOUTE la figure sans trop de marge
- Ne PAS inclure le texte autour de la figure dans la zone de crop

## REGLES GENERALES
- Si l'examen n'a pas d'exercices explicites, creer un seul exercice contenant toutes les questions
- Le preamble = texte d'introduction/contexte AVANT les sous-questions (en segments riches)
- maxPoints = points par sous-question si indique, sinon null
- Pour les MCQ, extraire les choix (content en segments riches) et isCorrect si le corrige est fourni
- N'inventer rien : null si l'info est absente
- Inclure des warnings dans metadata.warnings pour tout ce qui est ambigu
- Evaluer le niveau de confiance (high/medium/low)`

  const userPrompt = `Analyse ce document PDF d'examen et extrais sa structure hierarchique complete (exercices et sous-questions) avec le formatage riche (segments text/math/table).`

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
              type: 'file',
              file: {
                filename: 'exam.pdf',
                file_data: pdfDataUrl,
              }
            } as never // SDK types may not include 'file' content type yet
          ]
        }
      ],
      response_format: zodResponseFormat(ExamExtractionSchema, 'exam_extraction'),
      temperature: 0.1, // Low temperature for more consistent extraction
      max_tokens: 8000
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
