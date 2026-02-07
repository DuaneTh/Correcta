import { redirect } from 'next/navigation'
import { getAuthSession, isPlatformAdmin } from '@/lib/api-auth'
import { getDictionary } from '@/lib/i18n/server'
import { loadSchoolAdminData } from '@/lib/school-admin-data'
import SchoolClassesClient from '@/app/admin/school/classes/SchoolClassesClient'

export default async function PlatformInstitutionClassesPage({
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
        <SchoolClassesClient
            dictionary={dictionary}
            institutionId={institutionId}
            courses={data.courses}
            sections={data.sections}
            exams={data.exams}
            students={data.students}
            teachers={data.teachers}
        />
    )
}
