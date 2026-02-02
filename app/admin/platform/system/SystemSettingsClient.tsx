'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Inline, Stack } from '@/components/ui/Layout'
import { Input } from '@/components/ui/Form'
import { Text } from '@/components/ui/Text'
import { TextLink } from '@/components/ui/TextLink'

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
        <Stack gap="lg">
            <Text as="h1" variant="pageTitle">{dict.title}</Text>

            <Card>
                <div className="p-6 border-b border-gray-200">
                    <Stack gap="xs">
                        <Text variant="sectionTitle">{dict.apiSection}</Text>
                        <Text variant="muted">{dict.apiDescription}</Text>
                    </Stack>
                </div>

                <CardBody padding="lg">
                    <Stack gap="md">
                        {/* Current status */}
                        <Inline align="start" gap="sm">
                            {openaiSetting?.isSet ? (
                                <>
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                    <Text variant="body" className="font-medium text-green-700">{dict.configured}</Text>
                                    <Text variant="muted">-</Text>
                                    <code className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                        {openaiSetting.value}
                                    </code>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="w-5 h-5 text-amber-500" />
                                    <Text variant="body" className="font-medium text-amber-700">{dict.notConfigured}</Text>
                                </>
                            )}
                        </Inline>

                        {openaiSetting?.updatedAt && (
                            <Text variant="xsMuted">
                                {dict.lastUpdated}: {new Date(openaiSetting.updatedAt).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')}
                            </Text>
                        )}

                        {/* Input for new key */}
                        <Stack gap="sm">
                            <Text variant="label">
                                {openaiSetting?.isSet
                                    ? (locale === 'fr' ? 'Nouvelle cle (laissez vide pour conserver l\'actuelle)' : 'New key (leave empty to keep current)')
                                    : (locale === 'fr' ? 'Cle API' : 'API Key')}
                            </Text>
                            <Inline align="start" gap="sm">
                                <div className="relative flex-1">
                                    <Input
                                        type={showKey ? 'text' : 'password'}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder={dict.placeholder}
                                        className="pr-10 font-mono text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowKey(!showKey)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <Button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving || !apiKey.trim()}
                                >
                                    {saving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : saveStatus === 'success' ? (
                                        <CheckCircle className="w-4 h-4" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    {saving ? dict.saving : saveStatus === 'success' ? dict.saved : dict.save}
                                </Button>
                            </Inline>

                            {saveStatus === 'error' && errorMessage && (
                                <Text variant="muted" className="text-red-600">{errorMessage}</Text>
                            )}
                        </Stack>

                        {/* Clear button */}
                        {openaiSetting?.isSet && !openaiSetting.value.includes('(env)') && (
                            <Button
                                type="button"
                                onClick={handleClear}
                                disabled={saving}
                                variant="ghost"
                                size="xs"
                                className="text-red-600 hover:text-red-700"
                            >
                                {dict.clearKey}
                            </Button>
                        )}

                        {/* Help link */}
                        <div className="pt-4 border-t border-gray-100">
                            <TextLink
                                href="https://platform.openai.com/api-keys"
                                target="_blank"
                                rel="noopener noreferrer"
                                size="sm"
                            >
                                {dict.getKey} &rarr;
                            </TextLink>
                            <Text variant="xsMuted" className="mt-2">{dict.envNote}</Text>
                        </div>
                    </Stack>
                </CardBody>
            </Card>
        </Stack>
    )
}
