'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'
import Drawer from '@/components/ui/Drawer'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Stack, Inline, Surface } from '@/components/ui/Layout'
import { Badge } from '@/components/ui/Badge'
import { Input, Select, Textarea } from '@/components/ui/Form'
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

const getStringField = (
    record: Record<string, unknown>,
    key: string,
    fallback: string
): string => {
    const value = record[key]
    return typeof value === 'string' ? value : fallback
}

const getBooleanField = (
    record: Record<string, unknown>,
    key: string,
    fallback: boolean
): boolean => {
    const value = record[key]
    return typeof value === 'boolean' ? value : fallback
}

const getObjectField = (
    record: Record<string, unknown>,
    key: string
): Record<string, unknown> | null => {
    const value = record[key]
    if (!value || typeof value !== 'object') return null
    return value as Record<string, unknown>
}

const emptyForm = {
    name: '',
    domains: '',
    ssoType: 'none',
    issuer: '',
    clientId: '',
    clientSecret: '',
    roleClaim: '',
    roleMapping: '',
    defaultRole: 'STUDENT',
    enabled: true,
}

export default function InstitutionsClient({ dictionary, canCreate }: InstitutionsClientProps) {
    const dict = dictionary.admin.institutions
    const [institutions, setInstitutions] = useState<InstitutionRecord[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [form, setForm] = useState({ ...emptyForm })
    const [setNewSecret, setSetNewSecret] = useState(false)
    const [clientSecretInput, setClientSecretInput] = useState('')
    const [search, setSearch] = useState('')
    const [ssoFilter, setSsoFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
    const [secretFilter, setSecretFilter] = useState<'all' | 'set' | 'not_set'>('all')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editingMode, setEditingMode] = useState<'edit' | 'create'>('edit')
    const [confirmOpen, setConfirmOpen] = useState(false)
    const confirmActionRef = useRef<(() => void) | null>(null)
    const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
    const drawerReturnFocusRef = useRef<HTMLElement | null>(null)
    const saveButtonRef = useRef<HTMLButtonElement | null>(null)
    const drawerOpenedFromUrlRef = useRef(false)
    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const selectedInstitution = useMemo(() => {
        return institutions.find((institution) => institution.id === selectedId) ?? null
    }, [institutions, selectedId])

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

    const baselineForm = useMemo(() => {
        if (isCreating || !selectedInstitution) {
            return { ...emptyForm }
        }
        const ssoConfig = (selectedInstitution.ssoConfig ?? {}) as Record<string, unknown>
        const domains = selectedInstitution.domains?.map((entry) => entry.domain).join(', ') ?? ''
        const roleMapping = getObjectField(ssoConfig, 'roleMapping')
        return {
            name: selectedInstitution.name ?? '',
            domains,
            ssoType: getStringField(ssoConfig, 'type', 'none'),
            issuer: getStringField(ssoConfig, 'issuer', ''),
            clientId: getStringField(ssoConfig, 'clientId', ''),
            clientSecret: '',
            roleClaim: getStringField(ssoConfig, 'roleClaim', ''),
            roleMapping: roleMapping ? JSON.stringify(roleMapping, null, 2) : '',
            defaultRole: getStringField(ssoConfig, 'defaultRole', 'STUDENT'),
            enabled: getBooleanField(ssoConfig, 'enabled', true),
        }
    }, [isCreating, selectedInstitution])

    const isDirty = useMemo(() => {
        if (JSON.stringify(form) !== JSON.stringify(baselineForm)) return true
        if (setNewSecret) return true
        if (clientSecretInput.trim()) return true
        return false
    }, [form, baselineForm, setNewSecret, clientSecretInput])

    const loadInstitutions = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/institutions')
            const data = await res.json()
            if (!res.ok) {
                throw new Error(data?.error || dict.loadError)
            }
            const list = data.institutions ?? []
            setInstitutions(list)
            const urlInstitutionId = searchParams.get('institutionId')
            const urlMode = searchParams.get('mode')
            if (!selectedId && !urlInstitutionId && !urlMode && list.length > 0) {
                setSelectedId(list[0].id)
                setIsCreating(false)
            }
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
        if (!selectedInstitution || isCreating) {
            return
        }

        const ssoConfig = (selectedInstitution.ssoConfig ?? {}) as Record<string, unknown>
        const domains = selectedInstitution.domains?.map((entry) => entry.domain).join(', ') ?? ''
        const roleMapping = getObjectField(ssoConfig, 'roleMapping')

        setForm({
            name: selectedInstitution.name ?? '',
            domains,
            ssoType: getStringField(ssoConfig, 'type', 'none'),
            issuer: getStringField(ssoConfig, 'issuer', ''),
            clientId: getStringField(ssoConfig, 'clientId', ''),
            clientSecret: '',
            roleClaim: getStringField(ssoConfig, 'roleClaim', ''),
            roleMapping: roleMapping ? JSON.stringify(roleMapping, null, 2) : '',
            defaultRole: getStringField(ssoConfig, 'defaultRole', 'STUDENT'),
            enabled: getBooleanField(ssoConfig, 'enabled', true),
        })
        setSetNewSecret(false)
        setClientSecretInput('')
    }, [selectedInstitution, isCreating])

    const buildUrlWithParams = useCallback(
        (update: (params: URLSearchParams) => void) => {
            const params = new URLSearchParams(searchParams.toString())
            update(params)
            const query = params.toString()
            return query ? `${pathname}?${query}` : pathname
        },
        [pathname, searchParams]
    )

    const setDrawerUrl = useCallback(
        (next: { mode: 'create' } | { institutionId: string }) => {
            const nextUrl = buildUrlWithParams((params) => {
                if ('mode' in next) {
                    params.delete('institutionId')
                    params.set('mode', next.mode)
                } else {
                    params.delete('mode')
                    params.set('institutionId', next.institutionId)
                }
            })
            router.replace(nextUrl)
        },
        [buildUrlWithParams, router]
    )

    const clearDrawerUrl = useCallback(() => {
        const nextUrl = buildUrlWithParams((params) => {
            params.delete('institutionId')
            params.delete('mode')
        })
        router.replace(nextUrl)
    }, [buildUrlWithParams, router])

    const handleSelect = useCallback(
        (
            institutionId: string,
            trigger?: HTMLElement | null,
            options: { updateUrl?: boolean; fromUrl?: boolean } = {}
        ) => {
            setSelectedId(institutionId)
            setIsCreating(false)
            setEditingMode('edit')
            setDrawerOpen(true)
            drawerOpenedFromUrlRef.current = options.fromUrl === true
            if (trigger) {
                drawerReturnFocusRef.current = trigger
            }
            setError('')
            if (options.updateUrl) {
                setDrawerUrl({ institutionId })
            }
        },
        [setDrawerUrl]
    )

    const handleCreate = useCallback(
        (
            trigger?: HTMLElement | null,
            options: { updateUrl?: boolean; fromUrl?: boolean } = {}
        ) => {
            setIsCreating(true)
            setSelectedId(null)
            setForm({ ...emptyForm })
            setSetNewSecret(false)
            setClientSecretInput('')
            setEditingMode('create')
            setDrawerOpen(true)
            drawerOpenedFromUrlRef.current = options.fromUrl === true
            if (trigger) {
                drawerReturnFocusRef.current = trigger
            }
            setError('')
            if (options.updateUrl) {
                setDrawerUrl({ mode: 'create' })
            }
        },
        [setDrawerUrl]
    )

    const handleChange = (field: keyof typeof emptyForm, value: string | boolean) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const handleCopyLink = async (institutionId: string) => {
        try {
            if (!navigator?.clipboard?.writeText) {
                return
            }
            const relativeUrl = buildUrlWithParams((params) => {
                params.delete('mode')
                params.set('institutionId', institutionId)
            })
            const baseUrl = window.location.origin
            await navigator.clipboard.writeText(`${baseUrl}${relativeUrl}`)
            if (copyTimeoutRef.current) {
                clearTimeout(copyTimeoutRef.current)
            }
            setCopiedId(institutionId)
            copyTimeoutRef.current = setTimeout(() => {
                setCopiedId(null)
            }, 2000)
        } catch {
            setError(dict.saveError)
        }
    }

    const executeSave = async () => {
        if (!isCreating && !selectedInstitution) {
            return
        }

        setSaving(true)
        setError('')

        let roleMapping: Record<string, string> | undefined
        if (form.roleMapping.trim()) {
            try {
                roleMapping = JSON.parse(form.roleMapping)
            } catch {
                setError(dict.invalidMapping)
                setSaving(false)
                return
            }
        }

        const domains = form.domains
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)

        const payload: Record<string, unknown> = {
            name: form.name,
            domains,
            ssoConfig: null,
        }

        if (form.ssoType !== 'none') {
            payload.ssoConfig = {
                type: form.ssoType,
                issuer: form.issuer || undefined,
                clientId: form.clientId || undefined,
                ...(setNewSecret && clientSecretInput.trim()
                    ? { clientSecret: clientSecretInput.trim() }
                    : {}),
                roleClaim: form.roleClaim || undefined,
                roleMapping: roleMapping ?? undefined,
                defaultRole: form.defaultRole || undefined,
                enabled: form.enabled,
            }
        }

        try {
            if (!isCreating && selectedInstitution) {
                const currentDomains = selectedInstitution.domains?.map((entry) => entry.domain).join(', ') ?? ''
                const domainsChanged = currentDomains !== form.domains
                const currentSsoConfig = (selectedInstitution.ssoConfig ?? {}) as Record<string, unknown>
                const currentRoleMapping = getObjectField(currentSsoConfig, 'roleMapping')
                    ? JSON.stringify(getObjectField(currentSsoConfig, 'roleMapping'), null, 2)
                    : ''
                const ssoChanged = Boolean(
                    form.ssoType !== getStringField(currentSsoConfig, 'type', 'none') ||
                    form.issuer !== getStringField(currentSsoConfig, 'issuer', '') ||
                    form.clientId !== getStringField(currentSsoConfig, 'clientId', '') ||
                    form.roleClaim !== getStringField(currentSsoConfig, 'roleClaim', '') ||
                    form.defaultRole !== getStringField(currentSsoConfig, 'defaultRole', 'STUDENT') ||
                    form.enabled !== getBooleanField(currentSsoConfig, 'enabled', true) ||
                    form.roleMapping !== currentRoleMapping ||
                    setNewSecret
                )
                if (domainsChanged || ssoChanged) {
                    confirmActionRef.current = executeSave
                    setConfirmOpen(true)
                    setSaving(false)
                    return
                }
            }
            const data = await fetchJsonWithCsrf<{
                institution?: { id?: string }
            }>(
                isCreating ? '/api/institutions' : `/api/institutions/${selectedInstitution?.id}`,
                {
                    method: isCreating ? 'POST' : 'PATCH',
                    body: payload,
                }
            )
            await loadInstitutions()
            if (isCreating && data?.institution?.id) {
                setSelectedId(data.institution.id)
                setIsCreating(false)
            }
            setSetNewSecret(false)
            setClientSecretInput('')
            setDrawerOpen(false)
            clearDrawerUrl()
        } catch (err) {
            console.error('[Institutions] Save failed', err)
            setError(dict.saveError)
        } finally {
            setSaving(false)
        }
    }

    const handleSave = () => {
        void executeSave()
    }

    const handleDiscardConfirm = () => {
        setDiscardConfirmOpen(false)
        setForm(baselineForm)
        setSetNewSecret(false)
        setClientSecretInput('')
        setError('')
        setDrawerOpen(false)
        clearDrawerUrl()
    }

    const requestCloseDrawer = useCallback(() => {
        if (isDirty) {
            setDiscardConfirmOpen(true)
            return
        }
        setDrawerOpen(false)
        clearDrawerUrl()
    }, [clearDrawerUrl, isDirty])

    const handleConfirm = () => {
        setConfirmOpen(false)
        const action = confirmActionRef.current
        confirmActionRef.current = null
        if (action) {
            action()
        }
    }

    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) {
                clearTimeout(copyTimeoutRef.current)
            }
        }
    }, [])

    useEffect(() => {
        const urlInstitutionId = searchParams.get('institutionId')
        const urlMode = searchParams.get('mode')

        if (urlMode === 'create') {
            if (!drawerOpen || editingMode !== 'create' || !isCreating) {
                handleCreate(null, { fromUrl: true })
            } else {
                drawerOpenedFromUrlRef.current = true
            }
            return
        }

        if (urlInstitutionId) {
            const match = institutions.find((institution) => institution.id === urlInstitutionId)
            if (match) {
                if (
                    !drawerOpen ||
                    selectedId !== urlInstitutionId ||
                    isCreating ||
                    editingMode !== 'edit'
                ) {
                    handleSelect(urlInstitutionId, null, { fromUrl: true })
                } else {
                    drawerOpenedFromUrlRef.current = true
                }
            }
            return
        }

        if (drawerOpen && drawerOpenedFromUrlRef.current) {
            requestCloseDrawer()
        }
    }, [
        drawerOpen,
        editingMode,
        handleCreate,
        handleSelect,
        institutions,
        isCreating,
        requestCloseDrawer,
        searchParams,
        selectedId,
    ])

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
                            onClick={(event) =>
                                handleCreate(event.currentTarget, { updateUrl: true })
                            }
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
                                        <th className="px-4 py-3 text-right">{dict.actionEdit}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredInstitutions.map((institution) => {
                                        const primaryDomain = institution.domains?.[0]?.domain ?? '—'
                                        const domainCount = institution.domains?.length ?? 0
                                        const ssoConfig = (institution.ssoConfig ?? {}) as Record<string, unknown>
                                        const ssoEnabled = getBooleanField(ssoConfig, 'enabled', false)
                                        const secretSet = institution.hasClientSecret === true
                                        const isActive = institution.id === selectedId && !isCreating
                                        return (
                                            <tr key={institution.id} className={isActive ? 'bg-brand-50/40' : ''}>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-gray-900">{institution.name}</div>
                                                    <div className="text-xs text-gray-500">{institution.id}</div>
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
                                                    <Inline align="end" gap="xs">
                                                        <Button
                                                            onClick={(event) =>
                                                                handleSelect(institution.id, event.currentTarget, {
                                                                    updateUrl: true,
                                                                })
                                                            }
                                                            variant="secondary"
                                                            size="xs"
                                                        >
                                                            {dict.actionEdit}
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleCopyLink(institution.id)}
                                                            variant="ghost"
                                                            size="xs"
                                                        >
                                                            {copiedId === institution.id
                                                                ? dict.actionCopied
                                                                : dict.actionCopyLink}
                                                        </Button>
                                                    </Inline>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>

                <Drawer
                    open={drawerOpen}
                    onClose={requestCloseDrawer}
                    title={editingMode === 'create' ? dict.createTitle : dict.editTitle}
                    returnFocusRef={drawerReturnFocusRef}
                >
                    <Stack gap="md">
                        <Stack gap="xs">
                            <Text variant="label">{dict.nameLabel}</Text>
                            <Input
                                value={form.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                            />
                        </Stack>
                        <Stack gap="xs">
                            <Text variant="label">{dict.domainsLabel}</Text>
                            <Input
                                value={form.domains}
                                onChange={(e) => handleChange('domains', e.target.value)}
                            />
                        </Stack>
                    </Stack>

                    <Stack gap="md" className="mt-6">
                        <Stack gap="xs">
                            <Text variant="label">{dict.ssoTypeLabel}</Text>
                            <Select
                                value={form.ssoType}
                                onChange={(e) => handleChange('ssoType', e.target.value)}
                            >
                                <option value="none">{dict.ssoTypeNone}</option>
                                <option value="oidc">{dict.ssoTypeOidc}</option>
                                <option value="saml">{dict.ssoTypeSaml}</option>
                            </Select>
                        </Stack>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={form.enabled}
                                onChange={(e) => handleChange('enabled', e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                            />
                            <Text variant="body">{dict.enabledLabel}</Text>
                        </label>
                        <Stack gap="xs">
                            <Text variant="label">{dict.issuerLabel}</Text>
                            <Input
                                value={form.issuer}
                                onChange={(e) => handleChange('issuer', e.target.value)}
                            />
                        </Stack>
                        <Stack gap="xs">
                            <Text variant="label">{dict.clientIdLabel}</Text>
                            <Input
                                value={form.clientId}
                                onChange={(e) => handleChange('clientId', e.target.value)}
                            />
                        </Stack>
                        <Stack gap="xs">
                            <Text variant="label">{dict.clientSecretLabel}</Text>
                            {selectedInstitution?.hasClientSecret && !setNewSecret && (
                                <Text variant="caption">{dict.secretSetLabel}</Text>
                            )}
                            <Input
                                type="password"
                                value={clientSecretInput}
                                onChange={(e) => setClientSecretInput(e.target.value)}
                                disabled={!setNewSecret}
                            />
                            <label className="mt-2 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={setNewSecret}
                                    onChange={(e) => setSetNewSecret(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                />
                                <Text variant="caption">{dict.setNewSecretLabel}</Text>
                            </label>
                        </Stack>
                        <Stack gap="xs">
                            <Text variant="label">{dict.roleClaimLabel}</Text>
                            <Input
                                value={form.roleClaim}
                                onChange={(e) => handleChange('roleClaim', e.target.value)}
                            />
                        </Stack>
                        <Stack gap="xs">
                            <Text variant="label">{dict.defaultRoleLabel}</Text>
                            <Select
                                value={form.defaultRole}
                                onChange={(e) => handleChange('defaultRole', e.target.value)}
                            >
                                <option value="STUDENT">STUDENT</option>
                                <option value="TEACHER">TEACHER</option>
                                <option value="SCHOOL_ADMIN">SCHOOL_ADMIN</option>
                            </Select>
                        </Stack>
                        <Stack gap="xs">
                            <Text variant="label">{dict.roleMappingLabel}</Text>
                            <Textarea
                                value={form.roleMapping}
                                onChange={(e) => handleChange('roleMapping', e.target.value)}
                                rows={6}
                            />
                        </Stack>
                    </Stack>

                    {error && (
                        <Card className="mt-4">
                            <CardBody padding="sm">
                                <Text variant="body" className="text-red-700">
                                    {error}
                                </Text>
                            </CardBody>
                        </Card>
                    )}

                    <Inline align="end" gap="sm" className="mt-6">
                        <Button
                            ref={saveButtonRef}
                            onClick={handleSave}
                            disabled={saving}
                            variant="primary"
                        >
                            {dict.updateButton}
                        </Button>
                    </Inline>
                </Drawer>
                <ConfirmModal
                    open={confirmOpen}
                    title={dict.confirmTitle}
                    description={dict.confirmDescription}
                    confirmLabel={dict.confirmConfirmLabel}
                    cancelLabel={dict.confirmCancelLabel}
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirmOpen(false)}
                    returnFocusRef={saveButtonRef}
                />
                <ConfirmModal
                    open={discardConfirmOpen}
                    title={dict.discardTitle}
                    description={dict.discardDescription}
                    confirmLabel={dict.discardConfirmLabel}
                    cancelLabel={dict.discardCancelLabel}
                    onConfirm={handleDiscardConfirm}
                    onCancel={() => setDiscardConfirmOpen(false)}
                    returnFocusRef={drawerReturnFocusRef}
                />
            </Stack>
        </Surface>
    )
}
