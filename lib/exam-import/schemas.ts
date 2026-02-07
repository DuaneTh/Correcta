import { z } from 'zod'

/**
 * Bounding box schema — percentages (0–100) relative to the PDF page.
 * Used by GPT to indicate where a figure/image is located on a page.
 */
const BoundingBoxSchema = z.object({
  xPercent: z.number().describe('Position X du coin superieur-gauche en % de la largeur de la page (0-100)'),
  yPercent: z.number().describe('Position Y du coin superieur-gauche en % de la hauteur de la page (0-100)'),
  widthPercent: z.number().describe('Largeur de la zone en % de la largeur de la page (0-100)'),
  heightPercent: z.number().describe('Hauteur de la zone en % de la hauteur de la page (0-100)'),
})

/**
 * Table cell segment — flattened (no discriminatedUnion) for OpenAI compatibility.
 * Only text and math are valid inside table cells.
 *
 * OpenAI Structured Outputs does not support `oneOf`/`anyOf`, so we use a single
 * object with an enum `type` field and nullable variant-specific fields.
 */
const TableCellSegmentSchema = z.object({
  type: z.enum(['text', 'math']).describe('Type du segment dans la cellule'),
  text: z.string().nullable().describe('Texte brut (pour type=text), null sinon'),
  latex: z.string().nullable().describe('LaTeX sans delimiteurs $ (pour type=math), null sinon'),
})

/**
 * ContentSegment schema for rich content (text, math, tables, image references).
 * Mirrors the app's ContentSegment type used by the exam builder.
 *
 * Flattened into a single object (no discriminatedUnion) because OpenAI Structured
 * Outputs does not support `oneOf`/`anyOf` in JSON Schema.
 *
 * Rules:
 * - type='text': set `text`, leave others null
 * - type='math': set `latex`, leave others null
 * - type='table': set `rows`, leave others null
 * - type='image_ref': set `pageNumber`, `boundingBox`, `alt`, leave others null
 */
const ContentSegmentSchema = z.object({
  type: z.enum(['text', 'math', 'table', 'image_ref']).describe('Type du segment de contenu'),
  text: z.string().nullable().describe('Texte brut (pour type=text), null sinon'),
  latex: z.string().nullable().describe('LaTeX sans delimiteurs $ — juste la formule brute (pour type=math), null sinon'),
  rows: z.array(
    z.array(
      z.array(TableCellSegmentSchema)
    )
  ).nullable().describe('Tableau : rows[ligne][colonne] = array de segments texte/math (pour type=table), null sinon'),
  pageNumber: z.number().nullable().describe('Numero de la page du PDF 1-indexed (pour type=image_ref), null sinon'),
  boundingBox: BoundingBoxSchema.nullable().describe('Zone de la figure a decouper sur la page (pour type=image_ref), null sinon'),
  alt: z.string().nullable().describe("Description courte de l'image (pour type=image_ref), null sinon"),
})

/**
 * Extracted Sub-Question Schema
 *
 * Defines a single sub-question within an exercise.
 * Content uses ContentSegment[] for rich formatting (text + math + tables + image refs).
 */
export const ExtractedSubQuestionSchema = z.object({
  label: z.string().describe("Label de la sous-question tel qu'il apparait (ex: '1)', 'a)', '1.a)')"),
  content: z.array(ContentSegmentSchema).describe('Contenu de la sous-question en segments riches (text, math, table, image_ref)'),
  type: z.enum(['TEXT', 'MCQ']).describe('Type de question (TEXT pour question ouverte, MCQ pour choix multiple)'),
  maxPoints: z.number().nullable().describe('Points attribues si trouves dans le PDF, null si non indique'),
  correctionGuidelines: z.string().nullable().describe('Bareme ou corrige extrait si present dans le PDF'),
  choices: z.array(z.object({
    content: z.array(ContentSegmentSchema).describe("Contenu de l'option en segments riches"),
    isCorrect: z.boolean().nullable().describe("Vrai si l'option est correcte, null si le corrige n'est pas fourni")
  })).nullable().describe('Options pour les questions MCQ, null pour TEXT')
})

/**
 * Extracted Exercise Schema
 *
 * Defines an exercise containing sub-questions.
 * IMPORTANT: Nested parts (A, B with sub-questions a, b, c) must be FLATTENED
 * into a single exercise with sequential questions.
 */
export const ExtractedExerciseSchema = z.object({
  exerciseNumber: z.number().describe("Numero de l'exercice"),
  title: z.string().nullable().describe("Titre de l'exercice si present"),
  preamble: z.array(ContentSegmentSchema).nullable().describe('Enonce/contexte commun en segments riches, null si absent'),
  totalPoints: z.number().nullable().describe("Points totaux de l'exercice si indique"),
  subQuestions: z.array(ExtractedSubQuestionSchema).describe('Liste des sous-questions (aplatie si parties imbriquees)')
})

/**
 * Exam Extraction Schema
 *
 * Complete hierarchical structure of an exam extracted from PDF.
 */
export const ExamExtractionSchema = z.object({
  title: z.string().describe("Titre de l'examen extrait du PDF"),
  exercises: z.array(ExtractedExerciseSchema).describe('Liste des exercices extraits'),
  totalPoints: z.number().nullable().describe('Total des points si indique dans le PDF, null sinon'),
  metadata: z.object({
    confidence: z.enum(['high', 'medium', 'low']).describe("Niveau de confiance dans l'extraction"),
    warnings: z.array(z.string()).describe('Avertissements sur des ambiguites ou informations manquantes')
  })
})

/**
 * TypeScript types inferred from Zod schemas
 */
export type ExtractedSubQuestion = z.infer<typeof ExtractedSubQuestionSchema>
export type ExtractedExercise = z.infer<typeof ExtractedExerciseSchema>
export type ExamExtraction = z.infer<typeof ExamExtractionSchema>
