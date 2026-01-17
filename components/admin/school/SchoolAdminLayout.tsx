'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/config'

type SchoolAdminLayoutProps = {
    children: React.ReactNode
    dictionary: Dictionary
    currentLocale: Locale
    institutionName?: string
}

export default function SchoolAdminLayout({
    children,
    dictionary,
    currentLocale,
    institutionName,
}: SchoolAdminLayoutProps) {
    const pathname = usePathname()
    const { data: session } = useSession()
    const userName = session?.user?.name || session?.user?.email || 'Admin'

    const dict = dictionary.admin.school

    const links = useMemo(() => ([
        {
            href: '/admin/school/dashboard',
            label: dict.nav.dashboard,
            isActive: (path: string) => path.startsWith('/admin/school/dashboard')
        },
        {
            href: '/admin/school/users',
            label: dict.nav.users,
            isActive: (path: string) => path.startsWith('/admin/school/users')
        },
        {
            href: '/admin/school/classes',
            label: dict.nav.classes,
            isActive: (path: string) => path.startsWith('/admin/school/classes')
        },
        {
            href: '/admin/school/enrollments',
            label: dict.nav.enrollments,
            isActive: (path: string) => path.startsWith('/admin/school/enrollments')
        },
        {
            href: '/admin/school/settings',
            label: dict.nav.settings,
            isActive: (path: string) => path.startsWith('/admin/school/settings')
        },
    ]), [dict.nav])

    return (
        <div className="flex min-h-[calc(100vh-64px)] bg-gray-50">
            <aside className="w-64 border-r border-gray-200 bg-white p-6">
                <div className="mb-6">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {dict.titlePrefix}
                    </div>
                    <div className="mt-1 truncate text-sm font-medium text-gray-900">
                        {institutionName || dict.unknownInstitution}
                    </div>
                </div>
                <nav className="space-y-1 text-sm">
                    {links.map((link) => {
                        const active = link.isActive(pathname)
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`block rounded-md px-3 py-2 transition ${active
                                    ? 'bg-brand-50 text-brand-900 font-medium'
                                    : 'text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                {link.label}
                            </Link>
                        )
                    })}
                </nav>
                <div className="mt-8 text-xs text-gray-500">
                    <div className="uppercase tracking-wide">User</div>
                    <div className="mt-1 truncate text-sm text-gray-700">{userName}</div>
                </div>
            </aside>

            <div className="flex-1">
                <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
                    <div>
                        <div className="text-sm font-semibold text-gray-900">
                            {dict.titlePrefix}
                        </div>
                        <div className="text-xs text-gray-500">
                            {institutionName || dict.unknownInstitution}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{currentLocale.toUpperCase()}</span>
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                            {userName}
                        </span>
                    </div>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    )
}
