import { getDictionary, getLocale } from '@/lib/i18n/server'
import TeacherLayoutClient from './TeacherLayoutClient'

export default async function TeacherLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const locale = await getLocale()
    const dictionary = await getDictionary()

    return (
        <TeacherLayoutClient dictionary={dictionary} currentLocale={locale}>
            {children}
        </TeacherLayoutClient>
    )
}
