'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'

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
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold text-brand-900">{dict.title}</h1>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="text-xs uppercase text-gray-500">{dict.kpiInstitutions}</div>
                    <div className="mt-2 text-3xl font-semibold text-gray-900">
                        {metrics.institutionsTotal}
                    </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="text-xs uppercase text-gray-500">{dict.kpiSsoEnabled}</div>
                    <div className="mt-2 text-3xl font-semibold text-gray-900">
                        {metrics.ssoEnabledCount}
                    </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="text-xs uppercase text-gray-500">{dict.kpiSsoMissingSecret}</div>
                    <div className="mt-2 text-3xl font-semibold text-gray-900">
                        {metrics.ssoMissingSecretCount}
                    </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="text-xs uppercase text-gray-500">{dict.kpiDomainsMissing}</div>
                    <div className="mt-2 text-3xl font-semibold text-gray-900">
                        {metrics.domainsMissingCount}
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm font-semibold text-gray-900">{dict.quickActions}</div>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/admin/platform?mode=create"
                            className="rounded-md bg-brand-900 px-3 py-2 text-xs font-medium text-white hover:bg-brand-800"
                        >
                            {dict.createInstitution}
                        </Link>
                        <Link
                            href="/admin/platform"
                            className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                            {dict.manageInstitutions}
                        </Link>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-4 text-sm font-semibold text-gray-900">{dict.attentionTitle}</div>
                {loading ? (
                    <div className="text-sm text-gray-500">{dictionary.admin.institutions.loading}</div>
                ) : error ? (
                    <div className="text-sm text-red-600">{error}</div>
                ) : attentionItems.length === 0 ? (
                    <div className="text-sm text-gray-500">{dict.allGood}</div>
                ) : (
                    <div className="space-y-3">
                        {attentionItems.map((item) => (
                            <div
                                key={item.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                            >
                                <div>
                                    <div className="text-sm font-medium text-gray-900">{item.name}</div>
                                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                        {item.ssoEnabled && (
                                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">
                                                {dictionary.admin.institutions.filterEnabled}
                                            </span>
                                        )}
                                        {item.missingSecret && (
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                                                {dictionary.admin.institutions.filterNotSet}
                                            </span>
                                        )}
                                        {item.noDomains && (
                                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                                                {dictionary.admin.school.noDomains}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Link
                                    href={`/admin/platform?institutionId=${item.id}`}
                                    className="text-xs font-medium text-brand-900 hover:underline"
                                >
                                    {dictionary.admin.institutions.actionEdit}
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
