import { z } from 'zod'

export const createAttemptSchema = z.object({
    examId: z.string().min(1),
})

export const updateAttemptSchema = z.union([
    z.object({
        honorStatementText: z.string(),
    }),
    z.object({
        questionId: z.string().min(1),
        segmentId: z.string().min(1),
        content: z.unknown(),
    }),
])

export const proctorEventSchema = z.object({
    type: z.enum([
        'FOCUS_LOST', 'TAB_SWITCH', 'FULLSCREEN_EXIT', 'INACTIVITY',
        'MULTI_SESSION', 'MULTIPLE_FACES', 'ABSENCE', 'NOISE_DETECTED',
        'COPY', 'PASTE'
    ]),
    metadata: z.record(z.string(), z.unknown()).optional(),
})
