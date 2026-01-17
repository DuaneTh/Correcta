import { redirect } from 'next/navigation'
import { getAuthSession, isPlatformAdmin, isSchoolAdmin } from '@/lib/api-auth'

export default async function AdminIndexPage() {
    const session = await getAuthSession()

    if (!session) {
        redirect('/login')
    }

    if (isPlatformAdmin(session)) {
        redirect('/admin/platform')
    }

    if (isSchoolAdmin(session)) {
        redirect('/admin/school')
    }

    redirect('/teacher/courses')
}
