import { z } from 'zod'

/**
 * Extracted Question Schema
 *
 * Defines the structure of a single question extracted from a PDF exam:
 * - questionNumber: extracted question number from PDF
 * - content: question text, may include LaTeX with $...$
 * - type: detected question type (TEXT or MCQ)
 * - maxPoints: points if found in PDF, null if not stated
 * - correctionGuidelines: extracted rubric/answer key if present
 * - choices: MCQ options if type is MCQ
 */
export const ExtractedQuestionSchema = z.object({
  questionNumber: z.number().describe('Numero de la question extrait du PDF'),
  content: z.string().describe('Texte de la question, peut inclure des formules LaTeX avec $...$'),
  type: z.enum(['TEXT', 'MCQ']).describe('Type de question detecte (TEXT pour question ouverte, MCQ pour choix multiple)'),
  maxPoints: z.number().nullable().describe('Points attribues si trouves dans le PDF, null si non indique'),
  correctionGuidelines: z.string().nullable().describe('Bareme ou corrige extrait si present dans le PDF'),
  choices: z.array(z.object({
    text: z.string().describe('Texte de l\'option'),
    isCorrect: z.boolean().nullable().describe('Vrai si l\'option est correcte, null si le corrige n\'est pas fourni dans le PDF')
  })).nullable().describe('Options pour les questions a choix multiple, null pour les questions TEXT')
})

/**
 * Exam Extraction Schema
 *
 * Defines the complete structure of an exam extracted from PDF:
 * - title: exam title extracted from PDF
 * - questions: array of extracted questions
 * - totalPoints: total if stated in PDF
 * - metadata: confidence level and warnings
 */
export const ExamExtractionSchema = z.object({
  title: z.string().describe('Titre de l\'examen extrait du PDF'),
  questions: z.array(ExtractedQuestionSchema).describe('Liste des questions extraites'),
  totalPoints: z.number().nullable().describe('Total des points si indique dans le PDF, null sinon'),
  metadata: z.object({
    confidence: z.enum(['high', 'medium', 'low']).describe('Niveau de confiance dans l\'extraction (high/medium/low)'),
    warnings: z.array(z.string()).describe('Liste des avertissements sur des ambiguites ou informations manquantes')
  }).describe('Metadonnees sur la qualite de l\'extraction')
})

/**
 * TypeScript types inferred from Zod schemas
 */
export type ExtractedQuestion = z.infer<typeof ExtractedQuestionSchema>
export type ExamExtraction = z.infer<typeof ExamExtractionSchema>
