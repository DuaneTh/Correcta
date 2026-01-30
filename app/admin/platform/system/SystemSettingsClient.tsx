'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'

type SettingStatus = {
    value: string
    isSet: boolean
    updatedAt: string | null
}

type SettingsResponse = {
    settings: Record<string, SettingStatus>
}

interface SystemSettingsClientProps {
    locale?: string
}

export default function SystemSettingsClient({ locale = 'fr' }: SystemSettingsClientProps) {
    const [settings, setSettings] = useState<Record<string, SettingStatus>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [apiKey, setApiKey] = useState('')
    const [showKey, setShowKey] = useState(false)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState('')

    const dict = {
        title: locale === 'fr' ? 'Configuration du systeme' : 'System Configuration',
        apiSection: locale === 'fr' ? 'Cle API OpenAI' : 'OpenAI API Key',
        apiDescription: locale === 'fr'
            ? 'Cette cle est utilisee pour la correction automatique des examens par IA (GPT-4).'
            : 'This key is used for AI-powered automatic exam grading (GPT-4).',
        placeholder: locale === 'fr' ? 'sk-...' : 'sk-...',
        save: locale === 'fr' ? 'Enregistrer' : 'Save',
        saving: locale === 'fr' ? 'Enregistrement...' : 'Saving...',
        saved: locale === 'fr' ? 'Enregistre' : 'Saved',
        notConfigured: locale === 'fr' ? 'Non configure' : 'Not configured',
        configured: locale === 'fr' ? 'Configure' : 'Configured',
        lastUpdated: locale === 'fr' ? 'Derniere mise a jour' : 'Last updated',
        clearKey: locale === 'fr' ? 'Supprimer la cle' : 'Clear key',
        getKey: locale === 'fr' ? 'Obtenir une cle API' : 'Get an API key',
        envNote: locale === 'fr'
            ? 'Note: Si une cle est definie dans les variables d\'environnement du serveur, elle sera utilisee comme fallback.'
            : 'Note: If a key is set in server environment variables, it will be used as fallback.',
    }

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const data = await fetchJsonWithCsrf<SettingsResponse>('/api/admin/platform/settings')
            setSettings(data.settings)
        } catch (error) {
            console.error('Failed to fetch settings:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        setSaveStatus('idle')
        setErrorMessage('')

        try {
            await fetchJsonWithCsrf('/api/admin/platform/settings', {
                method: 'PUT',
                body: {
                    key: 'OPENAI_API_KEY',
                    value: apiKey
                }
            })

            setSaveStatus('success')
            setApiKey('')
            await fetchSettings()

            setTimeout(() => setSaveStatus('idle'), 3000)
        } catch (error) {
            setSaveStatus('error')
            setErrorMessage(error instanceof Error ? error.message : 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    const handleClear = async () => {
        if (!confirm(locale === 'fr'
            ? 'Voulez-vous vraiment supprimer la cle API ?'
            : 'Are you sure you want to delete the API key?')) {
            return
        }

        setSaving(true)
        try {
            await fetchJsonWithCsrf('/api/admin/platform/settings', {
                method: 'PUT',
                body: {
                    key: 'OPENAI_API_KEY',
                    value: ''
                }
            })
            await fetchSettings()
        } catch (error) {
            console.error('Failed to clear key:', error)
        } finally {
            setSaving(false)
        }
    }

    const openaiSetting = settings['OPENAI_API_KEY']

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">{dict.title}</h1>

            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">{dict.apiSection}</h2>
                    <p className="mt-1 text-sm text-gray-600">{dict.apiDescription}</p>
                </div>

                <div className="p-6 space-y-4">
                    {/* Current status */}
                    <div className="flex items-center gap-2">
                        {openaiSetting?.isSet ? (
                            <>
                                <CheckCircle className="w-5 h-5 text-green-500" />
                                <span className="text-sm font-medium text-green-700">{dict.configured}</span>
                                <span className="text-sm text-gray-500">-</span>
                                <code className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                    {openaiSetting.value}
                                </code>
                            </>
                        ) : (
                            <>
                                <AlertCircle className="w-5 h-5 text-amber-500" />
                                <span className="text-sm font-medium text-amber-700">{dict.notConfigured}</span>
                            </>
                        )}
                    </div>

                    {openaiSetting?.updatedAt && (
                        <p className="text-xs text-gray-500">
                            {dict.lastUpdated}: {new Date(openaiSetting.updatedAt).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')}
                        </p>
                    )}

                    {/* Input for new key */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            {openaiSetting?.isSet
                                ? (locale === 'fr' ? 'Nouvelle cle (laissez vide pour conserver l\'actuelle)' : 'New key (leave empty to keep current)')
                                : (locale === 'fr' ? 'Cle API' : 'API Key')}
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type={showKey ? 'text' : 'password'}
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder={dict.placeholder}
                                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-brand-500 focus:border-brand-500 font-mono text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving || !apiKey.trim()}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-900 text-white rounded-md hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : saveStatus === 'success' ? (
                                    <CheckCircle className="w-4 h-4" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {saving ? dict.saving : saveStatus === 'success' ? dict.saved : dict.save}
                            </button>
                        </div>

                        {saveStatus === 'error' && errorMessage && (
                            <p className="text-sm text-red-600">{errorMessage}</p>
                        )}
                    </div>

                    {/* Clear button */}
                    {openaiSetting?.isSet && !openaiSetting.value.includes('(env)') && (
                        <button
                            type="button"
                            onClick={handleClear}
                            disabled={saving}
                            className="text-sm text-red-600 hover:text-red-700 underline"
                        >
                            {dict.clearKey}
                        </button>
                    )}

                    {/* Help link */}
                    <div className="pt-4 border-t border-gray-100">
                        <a
                            href="https://platform.openai.com/api-keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-brand-600 hover:text-brand-700 underline"
                        >
                            {dict.getKey} &rarr;
                        </a>
                        <p className="mt-2 text-xs text-gray-500">{dict.envNote}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
