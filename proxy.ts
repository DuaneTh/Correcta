import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const STUDENT_PREFIX = '/student'
const TEACHER_PREFIX = '/teacher'

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

    // If not authenticated and accessing protected route → redirect to /login
    const isProtected =
        pathname.startsWith(STUDENT_PREFIX) ||
        pathname.startsWith(TEACHER_PREFIX)

    if (!token && isProtected) {
        const url = req.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    const role = token?.role

    // Protection /student/* - only STUDENT role
    if (pathname.startsWith(STUDENT_PREFIX) && role !== 'STUDENT') {
        // If TEACHER or ADMIN, redirect to their space
        if (role === 'TEACHER' || role === 'ADMIN') {
            return NextResponse.redirect(new URL('/teacher/courses', req.url))
        }
        // Unknown role, redirect to login
        return NextResponse.redirect(new URL('/login', req.url))
    }

    // Protection /teacher/* - only TEACHER or ADMIN roles
    if (pathname.startsWith(TEACHER_PREFIX) && role !== 'TEACHER' && role !== 'ADMIN') {
        // If STUDENT, redirect to their space
        if (role === 'STUDENT') {
            return NextResponse.redirect(new URL('/student/courses', req.url))
        }
        // Unknown role, redirect to login
        return NextResponse.redirect(new URL('/login', req.url))
    }

    return NextResponse.next()
}

export default proxy

export const config = {
    matcher: ['/student/:path*', '/teacher/:path*'],
}

