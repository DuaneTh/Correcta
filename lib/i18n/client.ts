import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, SUPPORTED_LOCALES, type Locale } from './config'
import { getDictionary } from './dictionaries'

/** Read locale from document.cookie (client-side only). */
export function getClientLocale(): Locale {
    if (typeof document === 'undefined') return DEFAULT_LOCALE
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE_NAME}=([^;]+)`))
    const value = match?.[1] as Locale | undefined
    if (value && SUPPORTED_LOCALES.includes(value)) return value
    return DEFAULT_LOCALE
}

/** Get the dictionary for the current client locale. */
export function getClientDictionary() {
    return getDictionary(getClientLocale())
}
