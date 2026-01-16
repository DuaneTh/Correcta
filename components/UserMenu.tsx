'use client'

import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import HeaderLogoutButton from "./HeaderLogoutButton"
import { setLocale } from "@/app/actions/locale"
import type { Dictionary } from "@/lib/i18n/dictionaries"
import type { Locale } from "@/lib/i18n/config"

interface UserMenuProps {
    dictionary?: Dictionary
    currentLocale?: Locale
}

export default function UserMenu({ dictionary, currentLocale }: UserMenuProps) {
    const { data: session } = useSession()
    const router = useRouter()

    if (!session?.user) {
        return null
    }

    const handleLogout = async () => {
        const isOidc = (session.user as { provider?: string }).provider === 'oidc'

        if (isOidc) {
            await signOut({ redirect: false })
            const keycloakLogoutUrl = 'http://localhost:8080/realms/correcta-realm/protocol/openid-connect/logout'
            const params = new URLSearchParams({
                post_logout_redirect_uri: window.location.origin,
                client_id: 'correcta-client'
            })
            window.location.href = `${keycloakLogoutUrl}?${params.toString()}`
        } else {
            await signOut({ callbackUrl: '/login' })
        }
    }

    const handleLanguageSwitch = async (locale: Locale) => {
        await setLocale(locale)
        router.refresh()
    }

    const getRoleLabel = (role: string): string => {
        if (!dictionary?.common) return role
        if (role === 'STUDENT') return dictionary.common.roleStudent
        if (role === 'TEACHER') return dictionary.common.roleTeacher
        if (role === 'ADMIN') return dictionary.common.roleAdmin
        return role
    }

    const roleLabel = getRoleLabel(session.user.role)
    const role = session.user.role
    const profileHref =
        role === 'STUDENT'
            ? '/student/courses'
            : role === 'TEACHER'
                ? '/teacher/courses'
                : role === 'SCHOOL_ADMIN' || role === 'PLATFORM_ADMIN'
                    ? '/admin'
                    : '/login'

    return (
        <div className="flex items-center gap-4">
            <Link href={profileHref} className="text-right cursor-pointer hover:underline">
                <p className="text-sm font-medium text-gray-900">
                    {session.user.email}
                </p>
                <p className="text-xs text-gray-500">
                    {roleLabel}
                </p>
            </Link>
            <div className="flex flex-col items-center gap-1">
                {dictionary && <HeaderLogoutButton onClick={handleLogout} dictionary={dictionary} />}
                {!dictionary && (
                    <button onClick={handleLogout} className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50">
                        Logout
                    </button>
                )}
                <div className="flex items-center gap-1 text-xs">
                    <button
                        onClick={() => handleLanguageSwitch('fr')}
                        className={currentLocale === 'fr' ? 'font-semibold text-[#000040] cursor-default' : 'text-gray-500 hover:text-gray-700 cursor-pointer'}
                    >
                        {dictionary?.common?.languageFr ?? 'FR'}
                    </button>
                    <span className="text-gray-400">|</span>
                    <button
                        onClick={() => handleLanguageSwitch('en')}
                        className={currentLocale === 'en' ? 'font-semibold text-[#000040] cursor-default' : 'text-gray-500 hover:text-gray-700 cursor-pointer'}
                    >
                        {dictionary?.common?.languageEn ?? 'EN'}
                    </button>
                </div>
            </div>
        </div>
    )
}
