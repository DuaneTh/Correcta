'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type InstitutionRecord = {
    id: string
    name: string
    ssoConfig?: Record<string, any> | null
    domains?: { domain: string }[]
}

type InstitutionsClientProps = {
    dictionary: Dictionary
    canCreate: boolean
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

    const selectedInstitution = useMemo(() => {
        return institutions.find((institution) => institution.id === selectedId) ?? null
    }, [institutions, selectedId])

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

        const ssoConfig = (selectedInstitution.ssoConfig ?? {}) as Record<string, any>
        const domains = selectedInstitution.domains?.map((entry) => entry.domain).join(', ') ?? ''

        setForm({
            name: selectedInstitution.name ?? '',
            domains,
            ssoType: ssoConfig.type ?? 'none',
            issuer: ssoConfig.issuer ?? '',
            clientId: ssoConfig.clientId ?? '',
            clientSecret: ssoConfig.clientSecret ?? '',
            roleClaim: ssoConfig.roleClaim ?? '',
            roleMapping: ssoConfig.roleMapping ? JSON.stringify(ssoConfig.roleMapping, null, 2) : '',
            defaultRole: ssoConfig.defaultRole ?? 'STUDENT',
            enabled: ssoConfig.enabled !== false,
        })
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
        setError('')
    }

    const handleChange = (field: keyof typeof emptyForm, value: string | boolean) => {
        setForm((prev) => ({ ...prev, [field]: value }))
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

        const payload: Record<string, any> = {
            name: form.name,
            domains,
            ssoConfig: null,
        }

        if (form.ssoType !== 'none') {
            payload.ssoConfig = {
                type: form.ssoType,
                issuer: form.issuer || undefined,
                clientId: form.clientId || undefined,
                clientSecret: form.clientSecret || undefined,
                roleClaim: form.roleClaim || undefined,
                roleMapping: roleMapping ?? undefined,
                defaultRole: form.defaultRole || undefined,
                enabled: form.enabled,
            }
        }

        try {
            const res = await fetch(
                isCreating ? '/api/institutions' : `/api/institutions/${selectedInstitution?.id}`,
                {
                    method: isCreating ? 'POST' : 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            )
            const data = await res.json()
            if (!res.ok) {
                throw new Error(data?.error || dict.saveError)
            }
            await loadInstitutions()
            if (isCreating && data?.institution?.id) {
                setSelectedId(data.institution.id)
                setIsCreating(false)
            }
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

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
                    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                        {loading ? (
                            <div className="text-sm text-gray-500">{dict.loading}</div>
                        ) : institutions.length === 0 ? (
                            <div className="text-sm text-gray-500">{dict.emptyState}</div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {institutions.map((institution) => {
                                    const isActive = institution.id === selectedId && !isCreating
                                    const domains = institution.domains?.map((entry) => entry.domain).join(', ')
                                    return (
                                        <button
                                            key={institution.id}
                                            type="button"
                                            onClick={() => handleSelect(institution.id)}
                                            className={`rounded-md border px-3 py-2 text-left text-sm transition ${isActive
                                                ? 'border-brand-900 bg-brand-50 text-brand-900'
                                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="font-semibold">{institution.name}</div>
                                            {domains && (
                                                <div className="text-xs text-gray-500">{domains}</div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
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
                                <input
                                    type="password"
                                    value={form.clientSecret}
                                    onChange={(e) => handleChange('clientSecret', e.target.value)}
                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-900"
                                />
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
                </div>
            </div>
        </div>
    )
}
