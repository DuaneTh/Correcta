import { z } from 'zod'

export const upsertGradeSchema = z.object({
    answerId: z.string().min(1),
    score: z.number(),
    feedback: z.string().optional(),
})
