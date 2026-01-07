import { getDictionary, getLocale } from '@/lib/i18n/server'
import DashboardLayoutClient from '@/app/dashboard/DashboardLayoutClient'

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const locale = await getLocale()
    const dictionary = await getDictionary()

    return (
        <DashboardLayoutClient dictionary={dictionary} currentLocale={locale}>
            {children}
        </DashboardLayoutClient>
    )
}
