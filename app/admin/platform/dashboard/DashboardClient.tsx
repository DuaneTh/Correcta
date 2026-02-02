'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Grid, Inline, Stack } from '@/components/ui/Layout'
import { Text } from '@/components/ui/Text'
import { TextLink } from '@/components/ui/TextLink'
import { Badge } from '@/components/ui/Badge'

type Institution = {
    id: string
    name: string
    domains?: { domain: string }[] | null
    ssoConfig?: Record<string, unknown> | null
    hasClientSecret?: boolean
    updatedAt?: string
}

type DashboardClientProps = {
    dictionary: Dictionary
}

const hasDomains = (institution: Institution) => {
    const domains = institution.domains ?? []
    return domains.some((entry) => entry.domain?.trim())
}

const isSsoEnabled = (institution: Institution) => {
    const config = (institution.ssoConfig ?? {}) as Record<string, unknown>
    return config.enabled === true
}

export default function DashboardClient({ dictionary }: DashboardClientProps) {
    const dict = dictionary.admin.platformDashboard
    const [institutions, setInstitutions] = useState<Institution[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            setError('')
            try {
                const res = await fetch('/api/institutions')
                const data = await res.json()
                if (!res.ok) {
                    throw new Error(data?.error || dictionary.admin.institutions.loadError)
                }
                setInstitutions(data.institutions ?? [])
            } catch {
                setError(dictionary.admin.institutions.loadError)
            } finally {
                setLoading(false)
            }
        }
        void load()
    }, [dictionary.admin.institutions.loadError])

    const metrics = useMemo(() => {
        const institutionsTotal = institutions.length
        const ssoEnabledCount = institutions.filter(isSsoEnabled).length
        const ssoMissingSecretCount = institutions.filter(
            (institution) => isSsoEnabled(institution) && institution.hasClientSecret !== true
        ).length
        const domainsMissingCount = institutions.filter((institution) => !hasDomains(institution)).length

        return {
            institutionsTotal,
            ssoEnabledCount,
            ssoMissingSecretCount,
            domainsMissingCount,
        }
    }, [institutions])

    const attentionItems = useMemo(() => {
        const items = institutions
            .map((institution) => {
                const issues: string[] = []
                const ssoEnabled = isSsoEnabled(institution)
                if (ssoEnabled && institution.hasClientSecret !== true) {
                    issues.push('missingSecret')
                }
                if (!hasDomains(institution)) {
                    issues.push('noDomains')
                }
                if (issues.length === 0) {
                    return null
                }
                return {
                    id: institution.id,
                    name: institution.name,
                    ssoEnabled,
                    missingSecret: issues.includes('missingSecret'),
                    noDomains: issues.includes('noDomains'),
                }
            })
            .filter(
                (item): item is {
                    id: string
                    name: string
                    ssoEnabled: boolean
                    missingSecret: boolean
                    noDomains: boolean
                } => item !== null
            )
        return items.slice(0, 8)
    }, [institutions])

    return (
        <Stack gap="xl">
            <Text as="h1" variant="pageTitle">
                {dict.title}
            </Text>

            <Grid cols="2" gap="md">
                <Card>
                    <CardBody padding="md">
                        <Text variant="overline">{dict.kpiInstitutions}</Text>
                        <Text as="div" className="mt-2 text-3xl font-semibold text-gray-900">
                            {metrics.institutionsTotal}
                        </Text>
                    </CardBody>
                </Card>
                <Card>
                    <CardBody padding="md">
                        <Text variant="overline">{dict.kpiSsoEnabled}</Text>
                        <Text as="div" className="mt-2 text-3xl font-semibold text-gray-900">
                            {metrics.ssoEnabledCount}
                        </Text>
                    </CardBody>
                </Card>
                <Card>
                    <CardBody padding="md">
                        <Text variant="overline">{dict.kpiSsoMissingSecret}</Text>
                        <Text as="div" className="mt-2 text-3xl font-semibold text-gray-900">
                            {metrics.ssoMissingSecretCount}
                        </Text>
                    </CardBody>
                </Card>
                <Card>
                    <CardBody padding="md">
                        <Text variant="overline">{dict.kpiDomainsMissing}</Text>
                        <Text as="div" className="mt-2 text-3xl font-semibold text-gray-900">
                            {metrics.domainsMissingCount}
                        </Text>
                    </CardBody>
                </Card>
            </Grid>

            <Card>
                <CardBody padding="md">
                    <Inline align="between" gap="sm">
                        <Text variant="sectionTitle">{dict.quickActions}</Text>
                        <Inline align="start" gap="sm" wrap="wrap">
                            <Button
                                onClick={() => window.location.href = '/admin/platform?mode=create'}
                                size="xs"
                            >
                                {dict.createInstitution}
                            </Button>
                            <Button
                                onClick={() => window.location.href = '/admin/platform'}
                                variant="secondary"
                                size="xs"
                            >
                                {dict.manageInstitutions}
                            </Button>
                        </Inline>
                    </Inline>
                </CardBody>
            </Card>

            <Card>
                <CardBody padding="md">
                    <Text variant="sectionTitle" className="mb-4">
                        {dict.attentionTitle}
                    </Text>
                    {loading ? (
                        <Text variant="muted">{dictionary.admin.institutions.loading}</Text>
                    ) : error ? (
                        <Text variant="muted" className="text-red-600">{error}</Text>
                    ) : attentionItems.length === 0 ? (
                        <Text variant="muted">{dict.allGood}</Text>
                    ) : (
                        <Stack gap="sm">
                            {attentionItems.map((item) => (
                                <Card key={item.id}>
                                    <CardBody padding="sm">
                                        <Inline align="between" gap="sm" wrap="wrap">
                                            <Stack gap="xs">
                                                <Text variant="body" className="font-medium">
                                                    {item.name}
                                                </Text>
                                                <Inline align="start" gap="sm" wrap="wrap">
                                                    {item.ssoEnabled && (
                                                        <Badge variant="success">
                                                            {dictionary.admin.institutions.filterEnabled}
                                                        </Badge>
                                                    )}
                                                    {item.missingSecret && (
                                                        <Badge variant="warning">
                                                            {dictionary.admin.institutions.filterNotSet}
                                                        </Badge>
                                                    )}
                                                    {item.noDomains && (
                                                        <Badge variant="neutral">
                                                            {dictionary.admin.school.noDomains}
                                                        </Badge>
                                                    )}
                                                </Inline>
                                            </Stack>
                                            <TextLink
                                                href={`/admin/platform?institutionId=${item.id}`}
                                                size="xs"
                                            >
                                                {dictionary.admin.institutions.actionEdit}
                                            </TextLink>
                                        </Inline>
                                    </CardBody>
                                </Card>
                            ))}
                        </Stack>
                    )}
                </CardBody>
            </Card>
        </Stack>
    )
}
