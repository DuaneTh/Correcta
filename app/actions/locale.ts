'use server'

import { cookies } from 'next/headers'
import { LOCALE_COOKIE_NAME, SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/config'

export async function setLocale(locale: Locale) {
    if (!SUPPORTED_LOCALES.includes(locale)) {
        throw new Error(`Unsupported locale: ${locale}`)
    }

    const cookieStore = await cookies()
    cookieStore.set(LOCALE_COOKIE_NAME, locale, {
        path: '/',
        maxAge: 365 * 24 * 60 * 60, // 1 year
        sameSite: 'lax',
    })

    return { success: true }
}
