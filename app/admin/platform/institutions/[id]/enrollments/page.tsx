import { redirect } from 'next/navigation'
import { getAuthSession, isPlatformAdmin } from '@/lib/api-auth'
import { getDictionary } from '@/lib/i18n/server'
import { loadSchoolAdminData } from '@/lib/school-admin-data'
import SchoolEnrollmentsClient from '@/app/admin/school/enrollments/SchoolEnrollmentsClient'

export default async function PlatformInstitutionEnrollmentsPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const session = await getAuthSession()

    if (!session || !isPlatformAdmin(session)) {
        redirect('/login')
    }

    const { id: institutionId } = await params
    const dictionary = await getDictionary()
    const data = await loadSchoolAdminData(institutionId)

    return (
        <SchoolEnrollmentsClient
            dictionary={dictionary}
            institutionId={institutionId}
            teachers={data.teachers}
            students={data.students}
            courses={data.courses}
            sections={data.sections}
        />
    )
}
