'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/config'
import { Stack, Inline } from '@/components/ui/Layout'
import { Text } from '@/components/ui/Text'
import { TextLink } from '@/components/ui/TextLink'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/components/ui/cn'

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
        { href: '/admin/platform/ai', label: 'Configuration IA', isActive: (path: string) => path.startsWith('/admin/platform/ai') },
        { href: '/admin/platform/audit', label: 'Audit', isActive: (path: string) => path.startsWith('/admin/platform/audit') },
        { href: '/admin/platform/system', label: 'System', isActive: (path: string) => path.startsWith('/admin/platform/system') },
    ]), [dictionary.admin.institutions.title])

    return (
        <div className="flex min-h-[calc(100vh-64px)] bg-gray-50">
            <aside className="w-64 border-r border-gray-200 bg-white p-6">
                <Text variant="overline" className="mb-6 text-gray-500">
                    {dictionary.common.adminNav}
                </Text>
                <nav className="space-y-2 text-sm">
                    {links.map((link) => {
                        const active = link.isActive(pathname)
                        return (
                            <TextLink
                                key={`${link.href}-${link.label}`}
                                href={link.href}
                                className={cn(
                                    'block rounded-md px-3 py-2 text-sm transition',
                                    active
                                        ? 'bg-brand-50 text-brand-900 font-medium'
                                        : 'text-gray-700 hover:bg-gray-100'
                                )}
                            >
                                {link.label}
                            </TextLink>
                        )
                    })}
                </nav>
                <Stack gap="xs" className="mt-8">
                    <Text variant="overline" className="text-gray-500">User</Text>
                    <Text variant="body" className="truncate text-sm">
                        {userName}
                    </Text>
                </Stack>
            </aside>

            <div className="flex-1">
                <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
                    <Stack gap="xs">
                        <Text variant="body" className="font-semibold">Platform Admin</Text>
                        <Text variant="xsMuted">{currentLocale.toUpperCase()}</Text>
                    </Stack>
                    <Badge variant="neutral">{userName}</Badge>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    )
}
