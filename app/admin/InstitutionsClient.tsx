'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'

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
            if (!selectedId && list.length > 0) {
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

    const handleSelect = (institutionId: string) => {
        setSelectedId(institutionId)
        setIsCreating(false)
        setError('')
    }

    const handleCreate = () => {
        setIsCreating(true)
        setSelectedId(null)
        setForm({ ...emptyForm })
        setSetNewSecret(false)
        setClientSecretInput('')
        setError('')
    }

    const handleChange = (field: keyof typeof emptyForm, value: string | boolean) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const handleCopyId = async (institutionId: string) => {
        try {
            if (!navigator?.clipboard?.writeText) {
                return
            }
            await navigator.clipboard.writeText(institutionId)
        } catch {
            setError(dict.saveError)
        }
    }

    const handleSave = async () => {
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
                if ((domainsChanged || ssoChanged) && !window.confirm(dict.confirmUpdate)) {
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
        } catch (err) {
            console.error('[Institutions] Save failed', err)
            setError(dict.saveError)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-brand-900">{dict.title}</h1>
                        <p className="text-sm text-gray-500">{dict.selectHint}</p>
                    </div>
                    {canCreate && (
                        <button
                            type="button"
                            onClick={handleCreate}
                            className="inline-flex items-center rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
                        >
                            {dict.createButton}
                        </button>
                    )}
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <label className="flex w-full flex-col gap-1 text-sm text-gray-700 md:max-w-xs">
                            <span className="font-medium">{dict.searchPlaceholder}</span>
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={dict.searchPlaceholder}
                                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                            />
                        </label>
                        <div className="flex flex-wrap items-end gap-3 text-sm text-gray-700">
                            <label className="flex flex-col gap-1">
                                <span className="font-medium">{dict.filterSsoLabel}</span>
                                <select
                                    value={ssoFilter}
                                    onChange={(e) => setSsoFilter(e.target.value as 'all' | 'enabled' | 'disabled')}
                                    className="rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                >
                                    <option value="all">{dict.filterAll}</option>
                                    <option value="enabled">{dict.filterEnabled}</option>
                                    <option value="disabled">{dict.filterDisabled}</option>
                                </select>
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="font-medium">{dict.filterSecretLabel}</span>
                                <select
                                    value={secretFilter}
                                    onChange={(e) => setSecretFilter(e.target.value as 'all' | 'set' | 'not_set')}
                                    className="rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                >
                                    <option value="all">{dict.filterAll}</option>
                                    <option value="set">{dict.filterSet}</option>
                                    <option value="not_set">{dict.filterNotSet}</option>
                                </select>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                    {loading ? (
                        <div className="p-4 text-sm text-gray-500">{dict.loading}</div>
                    ) : filteredInstitutions.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500">
                            {institutions.length === 0 ? dict.emptyState : dict.noMatches}
                        </div>
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
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ssoEnabled
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {ssoEnabled ? dict.filterEnabled : dict.filterDisabled}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${secretSet
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {secretSet ? dict.filterSet : dict.filterNotSet}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSelect(institution.id)}
                                                            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                                        >
                                                            {dict.actionEdit}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopyId(institution.id)}
                                                            className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50"
                                                        >
                                                            {dict.actionCopyId}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {(selectedInstitution || isCreating) && (
                    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="mb-4 text-lg font-semibold text-gray-900">
                            {isCreating ? dict.createTitle : dict.editTitle}
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <label className="flex flex-col gap-1 text-sm text-gray-700">
                                <span className="font-medium">{dict.nameLabel}</span>
                                <input
                                    value={form.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-sm text-gray-700 md:col-span-2">
                                <span className="font-medium">{dict.domainsLabel}</span>
                                <input
                                    value={form.domains}
                                    onChange={(e) => handleChange('domains', e.target.value)}
                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                />
                            </label>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <label className="flex flex-col gap-1 text-sm text-gray-700">
                                <span className="font-medium">{dict.ssoTypeLabel}</span>
                                <select
                                    value={form.ssoType}
                                    onChange={(e) => handleChange('ssoType', e.target.value)}
                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                >
                                    <option value="none">{dict.ssoTypeNone}</option>
                                    <option value="oidc">{dict.ssoTypeOidc}</option>
                                    <option value="saml">{dict.ssoTypeSaml}</option>
                                </select>
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={form.enabled}
                                    onChange={(e) => handleChange('enabled', e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                />
                                {dict.enabledLabel}
                            </label>
                            <label className="flex flex-col gap-1 text-sm text-gray-700">
                                <span className="font-medium">{dict.issuerLabel}</span>
                                <input
                                    value={form.issuer}
                                    onChange={(e) => handleChange('issuer', e.target.value)}
                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-sm text-gray-700">
                                <span className="font-medium">{dict.clientIdLabel}</span>
                                <input
                                    value={form.clientId}
                                    onChange={(e) => handleChange('clientId', e.target.value)}
                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-sm text-gray-700">
                                <span className="font-medium">{dict.clientSecretLabel}</span>
                                {selectedInstitution?.hasClientSecret && !setNewSecret && (
                                    <span className="text-xs text-gray-500">{dict.secretSetLabel}</span>
                                )}
                                <input
                                    type="password"
                                    value={clientSecretInput}
                                    onChange={(e) => setClientSecretInput(e.target.value)}
                                    disabled={!setNewSecret}
                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                />
                                <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                                    <input
                                        type="checkbox"
                                        checked={setNewSecret}
                                        onChange={(e) => setSetNewSecret(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                    />
                                    {dict.setNewSecretLabel}
                                </label>
                            </label>
                            <label className="flex flex-col gap-1 text-sm text-gray-700">
                                <span className="font-medium">{dict.roleClaimLabel}</span>
                                <input
                                    value={form.roleClaim}
                                    onChange={(e) => handleChange('roleClaim', e.target.value)}
                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-sm text-gray-700">
                                <span className="font-medium">{dict.defaultRoleLabel}</span>
                                <select
                                    value={form.defaultRole}
                                    onChange={(e) => handleChange('defaultRole', e.target.value)}
                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                >
                                    <option value="STUDENT">STUDENT</option>
                                    <option value="TEACHER">TEACHER</option>
                                    <option value="SCHOOL_ADMIN">SCHOOL_ADMIN</option>
                                </select>
                            </label>
                            <label className="flex flex-col gap-1 text-sm text-gray-700 md:col-span-2">
                                <span className="font-medium">{dict.roleMappingLabel}</span>
                                <textarea
                                    value={form.roleMapping}
                                    onChange={(e) => handleChange('roleMapping', e.target.value)}
                                    rows={6}
                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                />
                            </label>
                        </div>

                        {error && (
                            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        <div className="mt-6 flex justify-end">
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="inline-flex items-center rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {dict.updateButton}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
