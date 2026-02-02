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
                <Stack gap="lg" className="mb-6">
                    <Stack gap="xs">
                        <Text variant="overline" className="text-gray-500">
                            {dict.titlePrefix}
                        </Text>
                        <Text variant="body" className="truncate font-medium">
                            {institutionName || dict.unknownInstitution}
                        </Text>
                    </Stack>
                </Stack>
                <nav className="space-y-1 text-sm">
                    {links.map((link) => {
                        const active = link.isActive(pathname)
                        return (
                            <TextLink
                                key={link.href}
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
                        <Text variant="body" className="font-semibold">
                            {dict.titlePrefix}
                        </Text>
                        <Text variant="xsMuted">
                            {institutionName || dict.unknownInstitution}
                        </Text>
                    </Stack>
                    <Inline align="start" gap="sm">
                        <Text variant="xsMuted">{currentLocale.toUpperCase()}</Text>
                        <Badge variant="neutral">{userName}</Badge>
                    </Inline>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    )
}
