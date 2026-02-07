import { redirect } from 'next/navigation'
import { getAuthSession, isPlatformAdmin } from '@/lib/api-auth'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import { prisma } from '@/lib/prisma'
import PlatformInstitutionLayout from '@/components/admin/platform/PlatformInstitutionLayout'

export default async function InstitutionLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ id: string }>
}) {
    const session = await getAuthSession()

    if (!session) {
        redirect('/login')
    }

    if (!isPlatformAdmin(session)) {
        redirect('/admin/school')
    }

    const { id } = await params

    const institution = await prisma.institution.findUnique({
        where: { id },
        select: { name: true },
    })

    if (!institution) {
        redirect('/admin/platform')
    }

    const locale = await getLocale()
    const dictionary = await getDictionary()

    return (
        <PlatformInstitutionLayout
            dictionary={dictionary}
            currentLocale={locale}
            institutionId={id}
            institutionName={institution.name}
        >
            {children}
        </PlatformInstitutionLayout>
    )
}
