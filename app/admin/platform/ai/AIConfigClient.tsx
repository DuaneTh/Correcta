'use client'

import { useState, useEffect } from 'react'
import { Bot, FileText, History, Save, RotateCcw, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Inline, Stack } from '@/components/ui/Layout'
import { Textarea } from '@/components/ui/Form'
import { Text } from '@/components/ui/Text'
import { Badge } from '@/components/ui/Badge'

type Prompt = {
    id: string | null
    key: string
    name: string
    description: string | null
    content: string
    defaultContent: string
    isActive: boolean
    isCustomized: boolean
    version: number
    updatedAt: string | null
}

type LogEntry = {
    id: string
    attemptId: string | null
    answerId: string | null
    questionId: string | null
    operation: string
    model: string
    systemPrompt: string
    userPrompt: string
    rawResponse: string | null
    score: number | null
    feedback: string | null
    aiRationale: string | null
    tokensInput: number | null
    tokensOutput: number | null
    durationMs: number | null
    success: boolean
    error: string | null
    createdAt: string
}

type Tab = 'prompts' | 'logs'

export default function AIConfigClient() {
    const [activeTab, setActiveTab] = useState<Tab>('prompts')
    const [prompts, setPrompts] = useState<Prompt[]>([])
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editingPrompt, setEditingPrompt] = useState<string | null>(null)
    const [editContent, setEditContent] = useState('')
    const [expandedLog, setExpandedLog] = useState<string | null>(null)
    const [logPage, setLogPage] = useState(1)
    const [logTotal, setLogTotal] = useState(0)

    useEffect(() => {
        if (activeTab === 'prompts') {
            fetchPrompts()
        } else {
            fetchLogs()
        }
    }, [activeTab, logPage])

    const fetchPrompts = async () => {
        setLoading(true)
        try {
            const data = await fetchJsonWithCsrf<{ prompts: Prompt[] }>('/api/admin/platform/ai-prompts')
            setPrompts(data.prompts)
        } catch (error) {
            console.error('Failed to fetch prompts:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchLogs = async () => {
        setLoading(true)
        try {
            const data = await fetchJsonWithCsrf<{ logs: LogEntry[], pagination: { total: number } }>(
                `/api/admin/platform/ai-logs?page=${logPage}&limit=20`
            )
            setLogs(data.logs)
            setLogTotal(data.pagination.total)
        } catch (error) {
            console.error('Failed to fetch logs:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleEditPrompt = (prompt: Prompt) => {
        setEditingPrompt(prompt.key)
        setEditContent(prompt.content)
    }

    const handleSavePrompt = async (key: string) => {
        setSaving(true)
        try {
            await fetchJsonWithCsrf('/api/admin/platform/ai-prompts', {
                method: 'PUT',
                body: { key, content: editContent }
            })
            setEditingPrompt(null)
            await fetchPrompts()
        } catch (error) {
            console.error('Failed to save prompt:', error)
        } finally {
            setSaving(false)
        }
    }

    const handleResetPrompt = async (key: string) => {
        if (!confirm('Reinitialiser ce prompt aux valeurs par defaut ?')) return

        setSaving(true)
        try {
            await fetchJsonWithCsrf(`/api/admin/platform/ai-prompts?key=${key}`, {
                method: 'DELETE'
            })
            setEditingPrompt(null)
            await fetchPrompts()
        } catch (error) {
            console.error('Failed to reset prompt:', error)
        } finally {
            setSaving(false)
        }
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <Stack gap="lg">
            <Inline align="start" gap="sm">
                <Bot className="w-8 h-8 text-brand-600" />
                <Text as="h1" variant="pageTitle">Configuration IA</Text>
            </Inline>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                    <Button
                        onClick={() => setActiveTab('prompts')}
                        variant="ghost"
                        size="sm"
                        className={`flex items-center gap-2 border-b-2 ${
                            activeTab === 'prompts'
                                ? 'border-brand-600 text-brand-600'
                                : 'border-transparent text-gray-500'
                        }`}
                    >
                        <FileText className="w-4 h-4" />
                        Prompts
                    </Button>
                    <Button
                        onClick={() => setActiveTab('logs')}
                        variant="ghost"
                        size="sm"
                        className={`flex items-center gap-2 border-b-2 ${
                            activeTab === 'logs'
                                ? 'border-brand-600 text-brand-600'
                                : 'border-transparent text-gray-500'
                        }`}
                    >
                        <History className="w-4 h-4" />
                        Historique ({logTotal})
                    </Button>
                </nav>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
            ) : activeTab === 'prompts' ? (
                /* Prompts Tab */
                <Stack gap="lg">
                    {prompts.map((prompt) => (
                        <Card key={prompt.key}>
                            <div className="p-4 border-b border-gray-100">
                                <Inline align="between" gap="sm">
                                    <Stack gap="xs">
                                        <Text variant="body" className="font-semibold">{prompt.name}</Text>
                                        <Text variant="muted">{prompt.description}</Text>
                                    </Stack>
                                    <Inline align="start" gap="sm">
                                        {prompt.isCustomized && (
                                            <Badge variant="warning">Personnalise</Badge>
                                        )}
                                        <Text variant="xsMuted">v{prompt.version}</Text>
                                    </Inline>
                                </Inline>
                            </div>

                            <CardBody padding="md">
                                {editingPrompt === prompt.key ? (
                                    <Stack gap="sm">
                                        <Textarea
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            rows={15}
                                            className="font-mono text-sm"
                                        />
                                        <Inline align="between" gap="sm">
                                            <Button
                                                onClick={() => setEditContent(prompt.defaultContent)}
                                                variant="ghost"
                                                size="xs"
                                            >
                                                Voir le prompt par defaut
                                            </Button>
                                            <Inline align="start" gap="sm">
                                                <Button
                                                    onClick={() => setEditingPrompt(null)}
                                                    variant="ghost"
                                                    size="xs"
                                                >
                                                    Annuler
                                                </Button>
                                                <Button
                                                    onClick={() => handleSavePrompt(prompt.key)}
                                                    disabled={saving}
                                                    size="xs"
                                                >
                                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                    Enregistrer
                                                </Button>
                                            </Inline>
                                        </Inline>
                                    </Stack>
                                ) : (
                                    <Stack gap="sm">
                                        <pre className="p-3 bg-gray-50 rounded-md text-sm text-gray-700 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                                            {prompt.content}
                                        </pre>
                                        <Inline align="between" gap="sm">
                                            {prompt.updatedAt && (
                                                <Text variant="xsMuted">
                                                    Modifie le {formatDate(prompt.updatedAt)}
                                                </Text>
                                            )}
                                            <Inline align="start" gap="sm" className="ml-auto">
                                                {prompt.isCustomized && (
                                                    <Button
                                                        onClick={() => handleResetPrompt(prompt.key)}
                                                        variant="secondary"
                                                        size="xs"
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                        Reinitialiser
                                                    </Button>
                                                )}
                                                <Button
                                                    onClick={() => handleEditPrompt(prompt)}
                                                    variant="secondary"
                                                    size="xs"
                                                >
                                                    Modifier
                                                </Button>
                                            </Inline>
                                        </Inline>
                                    </Stack>
                                )}
                            </CardBody>
                        </Card>
                    ))}
                </Stack>
            ) : (
                /* Logs Tab */
                <Stack gap="md">
                    {logs.length === 0 ? (
                        <div className="text-center py-12">
                            <Text variant="muted">Aucune interaction IA enregistree</Text>
                        </div>
                    ) : (
                        <>
                            {logs.map((log) => (
                                <Card key={log.id} overflow="hidden">
                                    <button
                                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                                    >
                                        <Inline align="start" gap="md">
                                            {log.success ? (
                                                <CheckCircle className="w-5 h-5 text-green-500" />
                                            ) : (
                                                <AlertCircle className="w-5 h-5 text-red-500" />
                                            )}
                                            <Stack gap="xs">
                                                <Inline align="start" gap="sm">
                                                    <Text variant="body" className="font-medium">{log.operation}</Text>
                                                    <Badge variant="neutral">{log.model}</Badge>
                                                </Inline>
                                                <Text variant="xsMuted">
                                                    {formatDate(log.createdAt)}
                                                    {log.durationMs && ` • ${log.durationMs}ms`}
                                                    {log.tokensInput && log.tokensOutput && ` • ${log.tokensInput + log.tokensOutput} tokens`}
                                                </Text>
                                            </Stack>
                                        </Inline>
                                        <Inline align="start" gap="md">
                                            {log.score !== null && (
                                                <Text className="text-lg font-semibold text-brand-600">
                                                    {log.score} pts
                                                </Text>
                                            )}
                                            {expandedLog === log.id ? (
                                                <ChevronUp className="w-5 h-5 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-400" />
                                            )}
                                        </Inline>
                                    </button>

                                    {expandedLog === log.id && (
                                        <div className="border-t border-gray-200 p-4 bg-gray-50">
                                            <Stack gap="md">
                                                {/* System Prompt */}
                                                <Stack gap="xs">
                                                    <Text variant="label">Prompt Systeme</Text>
                                                    <pre className="p-3 bg-white border border-gray-200 rounded text-xs text-gray-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                                        {log.systemPrompt}
                                                    </pre>
                                                </Stack>

                                                {/* User Prompt */}
                                                <Stack gap="xs">
                                                    <Text variant="label">Prompt Utilisateur</Text>
                                                    <pre className="p-3 bg-white border border-gray-200 rounded text-xs text-gray-600 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                                        {log.userPrompt}
                                                    </pre>
                                                </Stack>

                                                {/* Response */}
                                                {log.success ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {log.feedback && (
                                                            <Stack gap="xs">
                                                                <Text variant="label">Feedback etudiant</Text>
                                                                <Card>
                                                                    <CardBody padding="sm">
                                                                        <Text variant="body">{log.feedback}</Text>
                                                                    </CardBody>
                                                                </Card>
                                                            </Stack>
                                                        )}
                                                        {log.aiRationale && (
                                                            <Stack gap="xs">
                                                                <Text variant="label">Raisonnement IA</Text>
                                                                <Card>
                                                                    <CardBody padding="sm">
                                                                        <Text variant="body">{log.aiRationale}</Text>
                                                                    </CardBody>
                                                                </Card>
                                                            </Stack>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <Stack gap="xs">
                                                        <Text variant="label" className="text-red-700">Erreur</Text>
                                                        <Card className="bg-red-50 border-red-200">
                                                            <CardBody padding="sm">
                                                                <Text variant="body" className="text-red-700">{log.error}</Text>
                                                            </CardBody>
                                                        </Card>
                                                    </Stack>
                                                )}

                                                {/* Raw Response (collapsible) */}
                                                {log.rawResponse && (
                                                    <details className="text-xs">
                                                        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                                                            Voir la reponse brute
                                                        </summary>
                                                        <pre className="mt-2 p-3 bg-white border border-gray-200 rounded text-gray-600 whitespace-pre-wrap overflow-x-auto">
                                                            {JSON.stringify(JSON.parse(log.rawResponse), null, 2)}
                                                        </pre>
                                                    </details>
                                                )}
                                            </Stack>
                                        </div>
                                    )}
                                </Card>
                            ))}

                            {/* Pagination */}
                            {logTotal > 20 && (
                                <Inline align="center" gap="sm" className="pt-4">
                                    <Button
                                        onClick={() => setLogPage(p => Math.max(1, p - 1))}
                                        disabled={logPage === 1}
                                        variant="secondary"
                                        size="xs"
                                    >
                                        Precedent
                                    </Button>
                                    <Text variant="muted">
                                        Page {logPage} / {Math.ceil(logTotal / 20)}
                                    </Text>
                                    <Button
                                        onClick={() => setLogPage(p => p + 1)}
                                        disabled={logPage >= Math.ceil(logTotal / 20)}
                                        variant="secondary"
                                        size="xs"
                                    >
                                        Suivant
                                    </Button>
                                </Inline>
                            )}
                        </>
                    )}
                </Stack>
            )}
        </Stack>
    )
}
