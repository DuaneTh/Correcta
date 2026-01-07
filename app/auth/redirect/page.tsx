import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { buildAuthOptions } from '@/lib/auth'

export default async function AuthRedirectPage() {
    const session = await getServerSession(await buildAuthOptions())

    if (!session?.user?.role) {
        redirect('/login')
    }

    const role = session.user.role

    if (role === 'STUDENT') {
        redirect('/student/courses')
    }

    if (role === 'TEACHER') {
        redirect('/teacher/courses')
    }

    if (role === 'SCHOOL_ADMIN' || role === 'PLATFORM_ADMIN') {
        redirect('/admin')
    }

    redirect('/login')
}
