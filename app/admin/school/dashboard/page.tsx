import { redirect } from 'next/navigation'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import { getAuthSession, isSchoolAdmin } from '@/lib/api-auth'
import { loadSchoolAdminData, resolveInstitutionId } from '@/lib/school-admin-data'
import SchoolAdminLayout from '@/components/admin/school/SchoolAdminLayout'
import SchoolDashboardClient from './SchoolDashboardClient'

export default async function SchoolDashboardPage() {
    const session = await getAuthSession()

    if (!session) {
        redirect('/login')
    }

    if (!isSchoolAdmin(session)) {
        redirect('/teacher/courses')
    }

    const locale = await getLocale()
    const dictionary = await getDictionary()

    const institutionId = await resolveInstitutionId(session)

    if (!institutionId) {
        redirect('/teacher/courses')
    }

    const data = await loadSchoolAdminData(institutionId)

    return (
        <SchoolAdminLayout
            dictionary={dictionary}
            currentLocale={locale}
            institutionName={data.institution?.name}
        >
            <SchoolDashboardClient
                dictionary={dictionary}
                institution={data.institution}
                teachers={data.teachers}
                students={data.students}
                courses={data.courses}
                sections={data.sections}
                exams={data.exams}
            />
        </SchoolAdminLayout>
    )
}
