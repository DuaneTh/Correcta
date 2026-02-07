import { redirect } from 'next/navigation'
import { getAuthSession, isPlatformAdmin } from '@/lib/api-auth'
import { getDictionary } from '@/lib/i18n/server'
import { loadSchoolAdminData } from '@/lib/school-admin-data'
import SchoolUsersClient from '@/app/admin/school/users/SchoolUsersClient'

export default async function PlatformInstitutionUsersPage({
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
        <SchoolUsersClient
            dictionary={dictionary}
            institutionId={institutionId}
            teachers={data.teachers}
            students={data.students}
            courses={data.courses}
            sections={data.sections}
        />
    )
}
