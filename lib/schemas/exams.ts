import { z } from 'zod'

export const createExamSchema = z.object({
    title: z.string().min(1).optional(),
    courseId: z.string().min(1),
    startAt: z.string().nullable().optional(),
    durationMinutes: z.union([z.number(), z.string()]).nullable().optional(),
    status: z.string().optional(),
    classIds: z.array(z.string()).optional(),
    sourceExamId: z.string().optional(),
})

export const updateExamSchema = z.object({
    title: z.string().min(1).optional(),
    startAt: z.string().nullable().optional(),
    durationMinutes: z.union([z.number(), z.string()]).nullable().optional(),
    requireHonorCommitment: z.boolean().optional(),
    allowedMaterials: z.string().nullable().optional(),
    antiCheatConfig: z.unknown().optional(),
    gradingConfig: z.unknown().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'No fields to update' })

export const createSectionSchema = z.object({
    title: z.string().optional(),
    order: z.number().optional(),
    customLabel: z.string().nullable().optional(),
    afterQuestionId: z.string().nullable().optional(),
    afterSectionId: z.string().nullable().optional(),
    isDefault: z.boolean().optional(),
})

export const updateSectionSchema = z.object({
    title: z.string().optional(),
    order: z.number().optional(),
    customLabel: z.string().nullable().optional(),
    introContent: z.string().nullable().optional(),
})

export const harmonizeSchema = z.object({
    method: z.string().min(1),
    params: z.record(z.string(), z.number()),
    scores: z.array(z.object({
        attemptId: z.string().min(1),
        newScore: z.number(),
    })),
})

export const variantsSchema = z.object({
    classIds: z.array(z.string()).optional(),
})
