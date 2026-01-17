import { redirect } from 'next/navigation'
import { getAuthSession, isSchoolAdmin } from '@/lib/api-auth'

export default async function SchoolAdminPage() {
    const session = await getAuthSession()

    if (!session) {
        redirect('/login')
    }

    if (!isSchoolAdmin(session)) {
        redirect('/teacher/courses')
    }

    redirect('/admin/school/dashboard')
}
