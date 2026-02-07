import { z } from 'zod'

export const createInstitutionSchema = z.object({
    name: z.string().min(1),
    domains: z.array(z.string()).optional(),
    ssoConfig: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const updateInstitutionSchema = z.object({
    name: z.string().min(1).optional(),
    domains: z.array(z.string()).optional(),
    ssoConfig: z.record(z.string(), z.unknown()).nullable().optional(),
})
