import { redirect } from 'next/navigation'
import { getAuthSession, isPlatformAdmin, isSchoolAdmin } from '@/lib/api-auth'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import PlatformAdminLayout from '@/components/admin/platform/PlatformAdminLayout'
import InstitutionsClient from '../InstitutionsClient'

export default async function PlatformAdminPage() {
    const session = await getAuthSession()

    if (!session) {
        redirect('/login')
    }

    if (!isPlatformAdmin(session)) {
        if (isSchoolAdmin(session)) {
            redirect('/admin/school')
        }
        redirect('/teacher/courses')
    }

    const locale = await getLocale()
    const dictionary = await getDictionary()

    return (
        <PlatformAdminLayout currentLocale={locale} dictionary={dictionary}>
            <InstitutionsClient dictionary={dictionary} canCreate={true} />
        </PlatformAdminLayout>
    )
}
