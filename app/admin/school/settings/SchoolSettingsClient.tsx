'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'

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
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-brand-900">{dict.nav.settings}</h1>
                <p className="text-sm text-gray-500">{dict.settings.subtitle}</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setTabParam('sso')}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${activeTab === 'sso'
                        ? 'bg-brand-900 text-white'
                        : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    {dict.settings.ssoTab}
                </button>
                <button
                    type="button"
                    onClick={() => setTabParam('import')}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${activeTab === 'import'
                        ? 'bg-brand-900 text-white'
                        : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    {dict.settings.importTab}
                </button>
            </div>

            {/* SSO Tab */}
            {activeTab === 'sso' && (
                <div className="space-y-6">
                    {/* SSO Status Card */}
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900">{dict.settings.ssoStatus}</h2>
                        <p className="mt-1 text-sm text-gray-500">{dict.settings.ssoStatusHint}</p>

                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            <div>
                                <div className="text-xs uppercase text-gray-500">{dict.ssoLabel}</div>
                                <div className="mt-1 flex items-center gap-2">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ssoConfig.enabled
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {ssoConfig.enabled ? dict.ssoEnabled : dict.ssoDisabled}
                                    </span>
                                    {ssoConfig.type !== 'none' && (
                                        <span className="text-sm text-gray-600">({ssoConfig.type.toUpperCase()})</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs uppercase text-gray-500">{dict.domainsLabel}</div>
                                <div className="mt-1 text-sm text-gray-900">{domains}</div>
                            </div>
                        </div>

                        {ssoConfig.enabled && ssoConfig.type !== 'none' && (
                            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                                <div className="text-sm font-medium text-blue-900">{dict.ssoHint}</div>
                                <p className="mt-1 text-sm text-blue-700">{dict.settings.ssoAuthOnly}</p>
                            </div>
                        )}

                        <div className="mt-6 text-sm text-gray-500">
                            {dict.settings.ssoContactAdmin}
                        </div>
                    </div>

                    {/* Institution Info */}
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900">{dict.settings.institutionInfo}</h2>

                        <div className="mt-4 space-y-3">
                            <div>
                                <div className="text-xs uppercase text-gray-500">{dict.namePlaceholder}</div>
                                <div className="mt-1 text-sm text-gray-900">{institution?.name || dict.unknownInstitution}</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase text-gray-500">ID</div>
                                <div className="mt-1 font-mono text-xs text-gray-600">{institution?.id || '-'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Import & Sync Tab */}
            {activeTab === 'import' && (
                <div className="space-y-6">
                    {/* Manual Roster Card */}
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900">{dict.settings.manualRoster}</h2>
                        <p className="mt-1 text-sm text-gray-500">{dict.settings.manualRosterHint}</p>

                        <div className="mt-6 space-y-4">
                            <div className="rounded-lg border border-gray-200 p-4">
                                <h3 className="text-sm font-medium text-gray-900">{dict.settings.importCsv}</h3>
                                <p className="mt-1 text-sm text-gray-500">{dict.settings.importCsvHint}</p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <a
                                        href="/admin/school/users?role=teacher&action=add"
                                        className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        {dict.createTeacherButton}
                                    </a>
                                    <a
                                        href="/admin/school/users?role=student&action=add"
                                        className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        {dict.createStudentButton}
                                    </a>
                                    <a
                                        href="/admin/school/classes?action=add-course"
                                        className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        {dict.createCourseButton}
                                    </a>
                                </div>
                            </div>

                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                <h3 className="text-sm font-medium text-amber-900">{dict.settings.ssoNotRoster}</h3>
                                <p className="mt-1 text-sm text-amber-700">{dict.settings.ssoNotRosterHint}</p>
                            </div>
                        </div>
                    </div>

                    {/* Directory Sync Card (Coming Soon) */}
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">{dict.settings.directorySync}</h2>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                                {dict.settings.comingSoon}
                            </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">{dict.settings.directorySyncHint}</p>

                        <div className="mt-6 space-y-3 opacity-50">
                            <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                                <div className="h-8 w-8 rounded bg-gray-200"></div>
                                <div>
                                    <div className="text-sm font-medium text-gray-900">SCIM 2.0</div>
                                    <div className="text-xs text-gray-500">{dict.settings.scimHint}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                                <div className="h-8 w-8 rounded bg-gray-200"></div>
                                <div>
                                    <div className="text-sm font-medium text-gray-900">Azure AD / Entra ID</div>
                                    <div className="text-xs text-gray-500">{dict.settings.azureHint}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                                <div className="h-8 w-8 rounded bg-gray-200"></div>
                                <div>
                                    <div className="text-sm font-medium text-gray-900">Google Workspace</div>
                                    <div className="text-xs text-gray-500">{dict.settings.googleHint}</div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6">
                            <button
                                type="button"
                                disabled
                                className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
                            >
                                {dict.settings.configureSync}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
