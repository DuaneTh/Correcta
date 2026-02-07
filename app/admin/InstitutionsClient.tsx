'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Stack, Inline, Surface } from '@/components/ui/Layout'
import { Badge } from '@/components/ui/Badge'
import { Input, Select } from '@/components/ui/Form'
import { SearchField } from '@/components/ui/SearchField'
import { EmptyState } from '@/components/ui/EmptyState'

type InstitutionRecord = {
    id: string
    name: string
    ssoConfig?: Record<string, unknown> | null
    domains?: { domain: string }[]
    hasClientSecret?: boolean
}

type InstitutionsClientProps = {
    dictionary: Dictionary
    canCreate: boolean
}

const getBooleanField = (
    record: Record<string, unknown>,
    key: string,
    fallback: boolean
): boolean => {
    const value = record[key]
    return typeof value === 'boolean' ? value : fallback
}

export default function InstitutionsClient({ dictionary, canCreate }: InstitutionsClientProps) {
    const dict = dictionary.admin.institutions
    const router = useRouter()
    const [institutions, setInstitutions] = useState<InstitutionRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [ssoFilter, setSsoFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
    const [secretFilter, setSecretFilter] = useState<'all' | 'set' | 'not_set'>('all')

    // Create modal state
    const [createOpen, setCreateOpen] = useState(false)
    const [createName, setCreateName] = useState('')
    const [createDomain, setCreateDomain] = useState('')
    const [creating, setCreating] = useState(false)
    const nameInputRef = useRef<HTMLInputElement | null>(null)

    const filteredInstitutions = useMemo(() => {
        const query = search.trim().toLowerCase()
        return institutions.filter((institution) => {
            const name = institution.name?.toLowerCase() ?? ''
            const domains = institution.domains?.map((entry) => entry.domain).join(', ') ?? ''
            const haystack = `${name} ${domains}`.toLowerCase()
            if (query && !haystack.includes(query)) return false

            const ssoConfig = (institution.ssoConfig ?? {}) as Record<string, unknown>
            const ssoEnabled = getBooleanField(ssoConfig, 'enabled', false)
            if (ssoFilter === 'enabled' && !ssoEnabled) return false
            if (ssoFilter === 'disabled' && ssoEnabled) return false

            const secretSet = institution.hasClientSecret === true
            if (secretFilter === 'set' && !secretSet) return false
            if (secretFilter === 'not_set' && secretSet) return false

            return true
        })
    }, [institutions, search, ssoFilter, secretFilter])

    const loadInstitutions = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/institutions')
            const data = await res.json()
            if (!res.ok) {
                throw new Error(data?.error || dict.loadError)
            }
            setInstitutions(data.institutions ?? [])
        } catch (err) {
            console.error('[Institutions] Load failed', err)
            setError(dict.loadError)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadInstitutions()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (createOpen) {
            nameInputRef.current?.focus()
        }
    }, [createOpen])

    const handleCreate = async () => {
        if (!createName.trim()) return

        setCreating(true)
        setError('')

        const domains = createDomain.trim()
            ? createDomain.split(',').map((d) => d.trim()).filter(Boolean)
            : []

        try {
            const data = await fetchJsonWithCsrf<{
                institution?: { id?: string }
            }>('/api/institutions', {
                method: 'POST',
                body: { name: createName.trim(), domains, ssoConfig: null },
            })
            setCreateOpen(false)
            setCreateName('')
            setCreateDomain('')
            if (data?.institution?.id) {
                router.push(`/admin/platform/institutions/${data.institution.id}`)
            } else {
                await loadInstitutions()
            }
        } catch (err) {
            console.error('[Institutions] Create failed', err)
            setError(dict.saveError)
        } finally {
            setCreating(false)
        }
    }

    const closeCreateModal = () => {
        setCreateOpen(false)
        setCreateName('')
        setCreateDomain('')
    }

    return (
        <Surface>
            <Stack gap="xl">
                <Inline align="between" gap="md">
                    <Stack gap="xs">
                        <Text as="h1" variant="pageTitle">{dict.title}</Text>
                        <Text variant="muted">{dict.selectHint}</Text>
                    </Stack>
                    {canCreate && (
                        <Button
                            onClick={() => setCreateOpen(true)}
                            variant="primary"
                        >
                            {dict.createButton}
                        </Button>
                    )}
                </Inline>

                <Card>
                    <CardBody padding="md">
                        <Inline align="between" gap="md" wrap="wrap">
                            <Stack gap="xs" className="flex-1 md:max-w-xs">
                                <Text variant="label">{dict.searchPlaceholder}</Text>
                                <SearchField
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={dict.searchPlaceholder}
                                />
                            </Stack>
                            <Inline align="end" gap="sm" wrap="wrap">
                                <Stack gap="xs">
                                    <Text variant="label">{dict.filterSsoLabel}</Text>
                                    <Select
                                        value={ssoFilter}
                                        onChange={(e) => setSsoFilter(e.target.value as 'all' | 'enabled' | 'disabled')}
                                        size="sm"
                                    >
                                        <option value="all">{dict.filterAll}</option>
                                        <option value="enabled">{dict.filterEnabled}</option>
                                        <option value="disabled">{dict.filterDisabled}</option>
                                    </Select>
                                </Stack>
                                <Stack gap="xs">
                                    <Text variant="label">{dict.filterSecretLabel}</Text>
                                    <Select
                                        value={secretFilter}
                                        onChange={(e) => setSecretFilter(e.target.value as 'all' | 'set' | 'not_set')}
                                        size="sm"
                                    >
                                        <option value="all">{dict.filterAll}</option>
                                        <option value="set">{dict.filterSet}</option>
                                        <option value="not_set">{dict.filterNotSet}</option>
                                    </Select>
                                </Stack>
                            </Inline>
                        </Inline>
                    </CardBody>
                </Card>

                {error && (
                    <Card>
                        <CardBody padding="sm">
                            <Text variant="body" className="text-red-700">{error}</Text>
                        </CardBody>
                    </Card>
                )}

                <Card>
                    {loading ? (
                        <CardBody padding="md">
                            <Text variant="muted">{dict.loading}</Text>
                        </CardBody>
                    ) : filteredInstitutions.length === 0 ? (
                        <CardBody padding="md">
                            <EmptyState
                                title={institutions.length === 0 ? dict.emptyState : dict.noMatches}
                                size="compact"
                            />
                        </CardBody>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3">{dict.nameLabel}</th>
                                        <th className="px-4 py-3">{dict.domainsLabel}</th>
                                        <th className="px-4 py-3">{dict.filterSsoLabel}</th>
                                        <th className="px-4 py-3">{dict.filterSecretLabel}</th>
                                        <th className="px-4 py-3 text-right">{dict.manageButton}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredInstitutions.map((institution) => {
                                        const primaryDomain = institution.domains?.[0]?.domain ?? '\u2014'
                                        const domainCount = institution.domains?.length ?? 0
                                        const ssoConfig = (institution.ssoConfig ?? {}) as Record<string, unknown>
                                        const ssoEnabled = getBooleanField(ssoConfig, 'enabled', false)
                                        const secretSet = institution.hasClientSecret === true
                                        return (
                                            <tr key={institution.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    <Link
                                                        href={`/admin/platform/institutions/${institution.id}`}
                                                        className="block"
                                                    >
                                                        <div className="font-medium text-brand-900 hover:underline">
                                                            {institution.name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">{institution.id}</div>
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="text-gray-700">{primaryDomain}</div>
                                                    {domainCount > 1 && (
                                                        <div className="text-xs text-gray-500">
                                                            {domainCount} domains
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge variant={ssoEnabled ? 'success' : 'neutral'}>
                                                        {ssoEnabled ? dict.filterEnabled : dict.filterDisabled}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge variant={secretSet ? 'info' : 'neutral'}>
                                                        {secretSet ? dict.filterSet : dict.filterNotSet}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button
                                                        variant="secondary"
                                                        size="xs"
                                                        onClick={() => router.push(`/admin/platform/institutions/${institution.id}`)}
                                                    >
                                                        {dict.manageButton}
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>

                {createOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
                        role="dialog"
                        aria-modal="true"
                        aria-label={dict.createTitle}
                        onClick={closeCreateModal}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl"
                        >
                            <h2 className="text-base font-semibold text-gray-900">{dict.createTitle}</h2>
                            <Stack gap="md" className="mt-4">
                                <Stack gap="xs">
                                    <Text variant="label">{dict.createNameLabel}</Text>
                                    <Input
                                        ref={nameInputRef}
                                        value={createName}
                                        onChange={(e) => setCreateName(e.target.value)}
                                        placeholder={dict.nameLabel}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') void handleCreate()
                                        }}
                                    />
                                </Stack>
                                <Stack gap="xs">
                                    <Text variant="label">{dict.createDomainLabel}</Text>
                                    <Input
                                        value={createDomain}
                                        onChange={(e) => setCreateDomain(e.target.value)}
                                        placeholder="example.edu"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') void handleCreate()
                                        }}
                                    />
                                </Stack>
                            </Stack>
                            <div className="mt-6 flex justify-end gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={closeCreateModal}
                                >
                                    {dict.confirmCancelLabel}
                                </Button>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => void handleCreate()}
                                    disabled={creating || !createName.trim()}
                                >
                                    {creating ? dict.loading : dict.createButton}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </Stack>
        </Surface>
    )
}
