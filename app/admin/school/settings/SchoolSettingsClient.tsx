'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Grid, Inline, Stack } from '@/components/ui/Layout'
import { Text } from '@/components/ui/Text'
import { Badge } from '@/components/ui/Badge'

type InstitutionInfo = {
    id: string
    name: string
    domains?: { domain: string }[]
    ssoConfig?: Record<string, unknown> | null
}

type SchoolSettingsClientProps = {
    dictionary: Dictionary
    institution: InstitutionInfo | null
}

type TabType = 'sso' | 'import'

export default function SchoolSettingsClient({
    dictionary,
    institution,
}: SchoolSettingsClientProps) {
    const dict = dictionary.admin.school
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const tabParam = searchParams.get('tab') as TabType | null
    const activeTab: TabType = tabParam === 'import' ? 'import' : 'sso'

    const buildUrl = useCallback(
        (update: (params: URLSearchParams) => void) => {
            const params = new URLSearchParams(searchParams.toString())
            update(params)
            const query = params.toString()
            return query ? `${pathname}?${query}` : pathname
        },
        [pathname, searchParams]
    )

    const setTabParam = useCallback((tab: TabType) => {
        const url = buildUrl((params) => {
            if (tab === 'sso') {
                params.delete('tab')
            } else {
                params.set('tab', tab)
            }
        })
        router.replace(url)
    }, [buildUrl, router])

    const ssoConfig = useMemo(() => {
        const config = institution?.ssoConfig as Record<string, unknown> | null
        return {
            type: (config?.type as string) || 'none',
            enabled: config?.enabled !== false,
            issuer: (config?.issuer as string) || '',
            clientId: (config?.clientId as string) || '',
        }
    }, [institution])

    const domains = useMemo(() => {
        return institution?.domains?.map(d => d.domain).join(', ') || dict.noDomains
    }, [institution, dict.noDomains])

    return (
        <Stack gap="lg">
            {/* Header */}
            <Stack gap="xs">
                <Text as="h1" variant="pageTitle">
                    {dict.nav.settings}
                </Text>
                <Text variant="muted">{dict.settings.subtitle}</Text>
            </Stack>

            {/* Tabs */}
            <Inline align="start" gap="sm">
                <Button
                    type="button"
                    onClick={() => setTabParam('sso')}
                    variant={activeTab === 'sso' ? 'primary' : 'secondary'}
                    size="xs"
                >
                    {dict.settings.ssoTab}
                </Button>
                <Button
                    type="button"
                    onClick={() => setTabParam('import')}
                    variant={activeTab === 'import' ? 'primary' : 'secondary'}
                    size="xs"
                >
                    {dict.settings.importTab}
                </Button>
            </Inline>

            {/* SSO Tab */}
            {activeTab === 'sso' && (
                <Stack gap="lg">
                    {/* SSO Status Card */}
                    <Card>
                        <CardBody padding="lg">
                            <Stack gap="sm">
                                <Text variant="sectionTitle">{dict.settings.ssoStatus}</Text>
                                <Text variant="muted">{dict.settings.ssoStatusHint}</Text>
                            </Stack>

                            <Grid cols="2" gap="md" className="mt-6">
                                <Stack gap="xs">
                                    <Text variant="overline">{dict.ssoLabel}</Text>
                                    <Inline align="start" gap="sm">
                                        <Badge variant={ssoConfig.enabled ? 'success' : 'neutral'}>
                                            {ssoConfig.enabled ? dict.ssoEnabled : dict.ssoDisabled}
                                        </Badge>
                                        {ssoConfig.type !== 'none' && (
                                            <Text variant="muted">({ssoConfig.type.toUpperCase()})</Text>
                                        )}
                                    </Inline>
                                </Stack>
                                <Stack gap="xs">
                                    <Text variant="overline">{dict.domainsLabel}</Text>
                                    <Text variant="body">{domains}</Text>
                                </Stack>
                            </Grid>

                            {ssoConfig.enabled && ssoConfig.type !== 'none' && (
                                <Card className="mt-6 border-blue-200 bg-blue-50">
                                    <CardBody padding="md">
                                        <Stack gap="xs">
                                            <Text variant="body" className="font-medium text-blue-900">
                                                {dict.ssoHint}
                                            </Text>
                                            <Text variant="muted" className="text-blue-700">
                                                {dict.settings.ssoAuthOnly}
                                            </Text>
                                        </Stack>
                                    </CardBody>
                                </Card>
                            )}

                            <Text variant="muted" className="mt-6">
                                {dict.settings.ssoContactAdmin}
                            </Text>
                        </CardBody>
                    </Card>

                    {/* Institution Info */}
                    <Card>
                        <CardBody padding="lg">
                            <Text variant="sectionTitle">{dict.settings.institutionInfo}</Text>

                            <Stack gap="sm" className="mt-4">
                                <Stack gap="xs">
                                    <Text variant="overline">{dict.namePlaceholder}</Text>
                                    <Text variant="body">{institution?.name || dict.unknownInstitution}</Text>
                                </Stack>
                                <Stack gap="xs">
                                    <Text variant="overline">ID</Text>
                                    <Text variant="muted" className="font-mono text-xs">
                                        {institution?.id || '-'}
                                    </Text>
                                </Stack>
                            </Stack>
                        </CardBody>
                    </Card>
                </Stack>
            )}

            {/* Import & Sync Tab */}
            {activeTab === 'import' && (
                <Stack gap="lg">
                    {/* Manual Roster Card */}
                    <Card>
                        <CardBody padding="lg">
                            <Stack gap="sm">
                                <Text variant="sectionTitle">{dict.settings.manualRoster}</Text>
                                <Text variant="muted">{dict.settings.manualRosterHint}</Text>
                            </Stack>

                            <Stack gap="md" className="mt-6">
                                <Card>
                                    <CardBody padding="md">
                                        <Stack gap="sm">
                                            <Text variant="body" className="font-medium">
                                                {dict.settings.importCsv}
                                            </Text>
                                            <Text variant="muted">{dict.settings.importCsvHint}</Text>
                                            <Inline align="start" gap="sm" wrap="wrap" className="mt-4">
                                                <Button
                                                    onClick={() => window.location.href = '/admin/school/users?role=teacher&action=add'}
                                                    variant="secondary"
                                                    size="xs"
                                                >
                                                    {dict.createTeacherButton}
                                                </Button>
                                                <Button
                                                    onClick={() => window.location.href = '/admin/school/users?role=student&action=add'}
                                                    variant="secondary"
                                                    size="xs"
                                                >
                                                    {dict.createStudentButton}
                                                </Button>
                                                <Button
                                                    onClick={() => window.location.href = '/admin/school/classes?action=add-course'}
                                                    variant="secondary"
                                                    size="xs"
                                                >
                                                    {dict.createCourseButton}
                                                </Button>
                                            </Inline>
                                        </Stack>
                                    </CardBody>
                                </Card>

                                <Card className="border-amber-200 bg-amber-50">
                                    <CardBody padding="md">
                                        <Stack gap="xs">
                                            <Text variant="body" className="font-medium text-amber-900">
                                                {dict.settings.ssoNotRoster}
                                            </Text>
                                            <Text variant="muted" className="text-amber-700">
                                                {dict.settings.ssoNotRosterHint}
                                            </Text>
                                        </Stack>
                                    </CardBody>
                                </Card>
                            </Stack>
                        </CardBody>
                    </Card>

                    {/* Directory Sync Card (Coming Soon) */}
                    <Card>
                        <CardBody padding="lg">
                            <Inline align="between" gap="sm">
                                <Text variant="sectionTitle">{dict.settings.directorySync}</Text>
                                <Badge variant="neutral">{dict.settings.comingSoon}</Badge>
                            </Inline>
                            <Text variant="muted" className="mt-1">
                                {dict.settings.directorySyncHint}
                            </Text>

                            <Stack gap="sm" className="mt-6 opacity-50">
                                <Card>
                                    <CardBody padding="sm">
                                        <Inline align="start" gap="sm">
                                            <div className="h-8 w-8 rounded bg-gray-200"></div>
                                            <Stack gap="xs">
                                                <Text variant="body" className="font-medium">SCIM 2.0</Text>
                                                <Text variant="xsMuted">{dict.settings.scimHint}</Text>
                                            </Stack>
                                        </Inline>
                                    </CardBody>
                                </Card>
                                <Card>
                                    <CardBody padding="sm">
                                        <Inline align="start" gap="sm">
                                            <div className="h-8 w-8 rounded bg-gray-200"></div>
                                            <Stack gap="xs">
                                                <Text variant="body" className="font-medium">Azure AD / Entra ID</Text>
                                                <Text variant="xsMuted">{dict.settings.azureHint}</Text>
                                            </Stack>
                                        </Inline>
                                    </CardBody>
                                </Card>
                                <Card>
                                    <CardBody padding="sm">
                                        <Inline align="start" gap="sm">
                                            <div className="h-8 w-8 rounded bg-gray-200"></div>
                                            <Stack gap="xs">
                                                <Text variant="body" className="font-medium">Google Workspace</Text>
                                                <Text variant="xsMuted">{dict.settings.googleHint}</Text>
                                            </Stack>
                                        </Inline>
                                    </CardBody>
                                </Card>
                            </Stack>

                            <Button
                                type="button"
                                disabled
                                className="mt-6 cursor-not-allowed bg-gray-100 text-gray-400"
                            >
                                {dict.settings.configureSync}
                            </Button>
                        </CardBody>
                    </Card>
                </Stack>
            )}
        </Stack>
    )
}
