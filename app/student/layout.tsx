import { getDictionary, getLocale } from '@/lib/i18n/server'
import StudentLayoutClient from './StudentLayoutClient'

export default async function StudentLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const locale = await getLocale()
    const dictionary = await getDictionary()

    return (
        <StudentLayoutClient dictionary={dictionary} currentLocale={locale}>
            {children}
        </StudentLayoutClient>
    )
}
