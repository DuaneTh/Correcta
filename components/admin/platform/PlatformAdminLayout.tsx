'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/config'

type PlatformAdminLayoutProps = {
    children: React.ReactNode
    dictionary: Dictionary
    currentLocale: Locale
}

export default function PlatformAdminLayout({
    children,
    dictionary,
    currentLocale,
}: PlatformAdminLayoutProps) {
    const pathname = usePathname()
    const { data: session } = useSession()
    const userName = session?.user?.name || session?.user?.email || 'Admin'

    const links = useMemo(() => ([
        { href: '/admin/platform/dashboard', label: 'Dashboard', isActive: (path: string) => path.startsWith('/admin/platform/dashboard') },
        { href: '/admin/platform', label: dictionary.admin.institutions.title, isActive: (path: string) => path === '/admin/platform' },
        { href: '/admin/platform/audit', label: 'Audit', isActive: (path: string) => path.startsWith('/admin/platform/audit') },
        { href: '/admin/platform/system', label: 'System', isActive: (path: string) => path.startsWith('/admin/platform/system') },
    ]), [dictionary.admin.institutions.title])

    return (
        <div className="flex min-h-[calc(100vh-64px)] bg-gray-50">
            <aside className="w-64 border-r border-gray-200 bg-white p-6">
                <div className="mb-6 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {dictionary.common.adminNav}
                </div>
                <nav className="space-y-2 text-sm">
                    {links.map((link) => {
                        const active = link.isActive(pathname)
                        return (
                            <Link
                                key={`${link.href}-${link.label}`}
                                href={link.href}
                                className={`block rounded-md px-3 py-2 transition ${active
                                    ? 'bg-brand-50 text-brand-900'
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
                        <div className="text-sm font-semibold text-gray-900">Platform Admin</div>
                        <div className="text-xs text-gray-500">{currentLocale.toUpperCase()}</div>
                    </div>
                    <div className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                        {userName}
                    </div>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    )
}
