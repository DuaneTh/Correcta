import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"

import { cookies } from "next/headers"

export async function getAuthSession(req?: NextRequest) {
    let institutionId: string | undefined

    if (req) {
        // Extract institutionId from cookie for buildAuthOptions
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        institutionId = match ? match[1] : undefined
    } else {
        // Fallback for Server Components
        try {
            const cookieStore = await cookies()
            const cookie = cookieStore.get('correcta-institution')
            institutionId = cookie?.value
        } catch (e) {
            // Ignore if called outside request context
        }
    }

    const authOptions = await buildAuthOptions(institutionId)
    const session = await getServerSession(authOptions)

    return session
}

export function isTeacher(session: any): boolean {
    return session?.user?.role === 'TEACHER' ||
        session?.user?.role === 'SCHOOL_ADMIN' ||
        session?.user?.role === 'PLATFORM_ADMIN'
}

export function isStudent(session: any): boolean {
    return session?.user?.role === 'STUDENT'
}
