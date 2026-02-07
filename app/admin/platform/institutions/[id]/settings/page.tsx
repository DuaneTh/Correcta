import { redirect } from 'next/navigation'
import { getAuthSession, isPlatformAdmin } from '@/lib/api-auth'
import { getDictionary } from '@/lib/i18n/server'
import { prisma } from '@/lib/prisma'
import SchoolSettingsClient from '@/app/admin/school/settings/SchoolSettingsClient'

export default async function PlatformInstitutionSettingsPage({
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

    const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
        include: { domains: { select: { domain: true } } }
    })

    return (
        <SchoolSettingsClient
            dictionary={dictionary}
            institution={institution ? {
                id: institution.id,
                name: institution.name,
                domains: institution.domains,
                ssoConfig: institution.ssoConfig as Record<string, unknown> | null,
            } : null}
        />
    )
}
