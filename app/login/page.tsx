import { getDictionary, getLocale } from '@/lib/i18n/server'
import LoginForm from './LoginForm'

export default async function LoginPage() {
    const locale = await getLocale()
    const dictionary = await getDictionary()

    return <LoginForm dictionary={dictionary} initialLocale={locale} />
}
