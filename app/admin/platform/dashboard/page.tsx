import { redirect } from 'next/navigation'
import { getAuthSession, isPlatformAdmin } from '@/lib/api-auth'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import PlatformAdminLayout from '@/components/admin/platform/PlatformAdminLayout'

export default async function PlatformDashboardPage() {
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
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
                Dashboard placeholder
            </div>
        </PlatformAdminLayout>
    )
}
