import { redirect } from 'next/navigation'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import { getAuthSession, isSchoolAdmin } from '@/lib/api-auth'
import { resolveInstitutionId } from '@/lib/school-admin-data'
import { prisma } from '@/lib/prisma'
import SchoolAdminLayout from '@/components/admin/school/SchoolAdminLayout'
import SchoolSettingsClient from './SchoolSettingsClient'

export default async function SchoolSettingsPage() {
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

    const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
        include: { domains: { select: { domain: true } } }
    })

    return (
        <SchoolAdminLayout
            dictionary={dictionary}
            currentLocale={locale}
            institutionName={institution?.name}
        >
            <SchoolSettingsClient
                dictionary={dictionary}
                institution={institution ? {
                    id: institution.id,
                    name: institution.name,
                    domains: institution.domains,
                    ssoConfig: institution.ssoConfig as Record<string, unknown> | null,
                } : null}
            />
        </SchoolAdminLayout>
    )
}
