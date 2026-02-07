import { z } from 'zod'

// --- Users ---

export const createUserSchema = z.object({
    email: z.string().email(),
    name: z.string().nullable().optional(),
    role: z.enum(['TEACHER', 'STUDENT']),
    password: z.string().optional(),
    users: z.array(z.object({
        email: z.string().email(),
        name: z.string().optional(),
    })).optional(),
})

export const updateUserSchema = z.object({
    userId: z.string().min(1),
    name: z.string().optional(),
    email: z.string().email().optional(),
    archived: z.boolean().optional(),
})

// --- Enrollments ---

export const createEnrollmentSchema = z.object({
    userId: z.string().optional(),
    classId: z.string().optional(),
    courseId: z.string().optional(),
    role: z.enum(['TEACHER', 'STUDENT']),
    emails: z.array(z.string().email()).optional(),
})

export const deleteEnrollmentSchema = z.object({
    enrollmentId: z.string().optional(),
    userId: z.string().optional(),
    classId: z.string().optional(),
})

// --- Courses ---

export const createCourseSchema = z.object({
    code: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    courses: z.array(z.object({
        code: z.string().min(1),
        name: z.string().min(1),
    })).optional(),
})

export const updateCourseSchema = z.object({
    courseId: z.string().min(1),
    code: z.string().optional(),
    name: z.string().optional(),
    archived: z.boolean().optional(),
})

// --- Platform settings ---

export const updateSettingSchema = z.object({
    key: z.string().min(1),
    value: z.string().optional(),
})
