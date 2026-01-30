import { redirect } from 'next/navigation'
import { getAuthSession, isPlatformAdmin } from '@/lib/api-auth'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import PlatformAdminLayout from '@/components/admin/platform/PlatformAdminLayout'
import AIConfigClient from './AIConfigClient'

export default async function PlatformAIPage() {
    const session = await getAuthSession()

    if (!session) {
        redirect('/login')
    }

    if (!isPlatformAdmin(session)) {
        redirect('/admin')
    }

    const locale = await getLocale()
    const dictionary = await getDictionary()

    return (
        <PlatformAdminLayout currentLocale={locale} dictionary={dictionary}>
            <AIConfigClient />
        </PlatformAdminLayout>
    )
}
