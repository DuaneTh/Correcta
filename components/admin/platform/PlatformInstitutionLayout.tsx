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

type PlatformInstitutionLayoutProps = {
    children: React.ReactNode
    dictionary: Dictionary
    currentLocale: Locale
    institutionId: string
    institutionName: string
}

export default function PlatformInstitutionLayout({
    children,
    dictionary,
    currentLocale,
    institutionId,
    institutionName,
}: PlatformInstitutionLayoutProps) {
    const pathname = usePathname()
    const { data: session } = useSession()
    const userName = session?.user?.name || session?.user?.email || 'Admin'

    const dict = dictionary.admin.school
    const instDict = dictionary.admin.institutions

    const basePath = `/admin/platform/institutions/${institutionId}`

    const links = useMemo(() => ([
        {
            href: `${basePath}/dashboard`,
            label: dict.nav.dashboard,
            isActive: (path: string) => path.startsWith(`${basePath}/dashboard`)
        },
        {
            href: `${basePath}/users`,
            label: dict.nav.users,
            isActive: (path: string) => path.startsWith(`${basePath}/users`)
        },
        {
            href: `${basePath}/classes`,
            label: dict.nav.classes,
            isActive: (path: string) => path.startsWith(`${basePath}/classes`)
        },
        {
            href: `${basePath}/enrollments`,
            label: dict.nav.enrollments,
            isActive: (path: string) => path.startsWith(`${basePath}/enrollments`)
        },
        {
            href: `${basePath}/settings`,
            label: dict.nav.settings,
            isActive: (path: string) => path.startsWith(`${basePath}/settings`)
        },
    ]), [basePath, dict.nav])

    return (
        <div className="flex min-h-[calc(100vh-64px)] bg-gray-50">
            <aside className="w-64 border-r border-gray-200 bg-white p-6">
                <div className="mb-6">
                    <TextLink
                        href="/admin/platform"
                        className="inline-block text-sm text-gray-500 hover:text-gray-900 transition mb-4"
                    >
                        {instDict.backToList}
                    </TextLink>
                    <Stack gap="xs">
                        <Inline align="start" gap="sm">
                            <Text variant="body" className="truncate font-medium">
                                {institutionName}
                            </Text>
                            <Badge variant="info">{instDict.supportBadge}</Badge>
                        </Inline>
                    </Stack>
                </div>
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
                        <Inline align="start" gap="sm">
                            <Text variant="body" className="font-semibold">
                                {institutionName}
                            </Text>
                            <Badge variant="info">{instDict.supportBadge}</Badge>
                        </Inline>
                        <Text variant="xsMuted">Platform Admin</Text>
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
