import { z } from 'zod'

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
})

export const authLookupSchema = z.object({
    email: z.string().email(),
})
