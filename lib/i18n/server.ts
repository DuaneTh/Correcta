import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, SUPPORTED_LOCALES, type Locale } from './config'
import { getDictionary as getDict } from './dictionaries'

export async function getLocale(): Promise<Locale> {
    const cookieStore = await cookies()
    const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value as Locale | undefined

    if (localeCookie && SUPPORTED_LOCALES.includes(localeCookie)) {
        return localeCookie
    }

    return DEFAULT_LOCALE
}

export async function getDictionary() {
    const locale = await getLocale()
    return getDict(locale)
}
