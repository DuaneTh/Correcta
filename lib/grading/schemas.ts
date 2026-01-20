import { z } from 'zod'

/**
 * Grading Response Schema
 *
 * Defines the structure of AI grading output:
 * - score: numeric score (will be clamped to 0-maxPoints by the grader)
 * - feedback: student-facing feedback in French, neutral academic tone
 * - aiRationale: internal reasoning for the grade (not shown to student)
 */
export const GradingResponseSchema = z.object({
    score: z.number().describe('Score attribue a la reponse (sera ajuste entre 0 et le maximum de points)'),
    feedback: z.string().describe('Commentaire destine a l\'etudiant, ton academique neutre, en francais. Peut inclure des formules LaTeX avec $...$'),
    aiRationale: z.string().describe('Raisonnement interne expliquant la notation (non montre a l\'etudiant)')
})

/**
 * Rubric Criterion Schema
 *
 * A single grading criterion within a rubric
 */
export const RubricCriterionSchema = z.object({
    name: z.string().describe('Nom du critere de notation'),
    points: z.number().describe('Nombre de points attribues a ce critere'),
    description: z.string().describe('Description detaillee de ce qui est attendu pour ce critere')
})

/**
 * Rubric Schema
 *
 * AI-generated grading rubric for a question:
 * - criteria: array of grading criteria with points distribution
 * - totalPoints: sum of all criteria points
 */
export const RubricSchema = z.object({
    criteria: z.array(RubricCriterionSchema).describe('Liste des criteres de notation'),
    totalPoints: z.number().describe('Total des points pour la question')
})

/**
 * TypeScript types inferred from Zod schemas
 */
export type GradingResponse = z.infer<typeof GradingResponseSchema>
export type RubricCriterion = z.infer<typeof RubricCriterionSchema>
export type Rubric = z.infer<typeof RubricSchema>
