/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
        } catch {
            // Ignore if called outside request context
        }
    }

    const authOptions = await buildAuthOptions(institutionId)
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return session
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { archivedAt: true }
    })

    if (user?.archivedAt) {
        return null
    }

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

export function isSchoolAdmin(session: any): boolean {
    return session?.user?.role === 'SCHOOL_ADMIN'
}

export function isPlatformAdmin(session: any): boolean {
    return session?.user?.role === 'PLATFORM_ADMIN'
}

export function isAdmin(session: any): boolean {
    return isSchoolAdmin(session) || isPlatformAdmin(session)
}
