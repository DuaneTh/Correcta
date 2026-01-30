'use client'

import { useState, useEffect } from 'react'
import { Bot, FileText, History, Save, RotateCcw, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'

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
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Bot className="w-8 h-8 text-brand-600" />
                <h1 className="text-2xl font-bold text-gray-900">Configuration IA</h1>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('prompts')}
                        className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm ${
                            activeTab === 'prompts'
                                ? 'border-brand-600 text-brand-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <FileText className="w-4 h-4" />
                        Prompts
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm ${
                            activeTab === 'logs'
                                ? 'border-brand-600 text-brand-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <History className="w-4 h-4" />
                        Historique ({logTotal})
                    </button>
                </nav>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
            ) : activeTab === 'prompts' ? (
                /* Prompts Tab */
                <div className="space-y-6">
                    {prompts.map((prompt) => (
                        <div key={prompt.key} className="bg-white rounded-lg border border-gray-200 shadow-sm">
                            <div className="p-4 border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{prompt.name}</h3>
                                        <p className="text-sm text-gray-500">{prompt.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {prompt.isCustomized && (
                                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                                                Personnalise
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-400">v{prompt.version}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4">
                                {editingPrompt === prompt.key ? (
                                    <div className="space-y-3">
                                        <textarea
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            rows={15}
                                            className="w-full p-3 border border-gray-300 rounded-md font-mono text-sm focus:ring-brand-500 focus:border-brand-500"
                                        />
                                        <div className="flex items-center justify-between">
                                            <button
                                                onClick={() => setEditContent(prompt.defaultContent)}
                                                className="text-sm text-gray-500 hover:text-gray-700"
                                            >
                                                Voir le prompt par defaut
                                            </button>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditingPrompt(null)}
                                                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                                                >
                                                    Annuler
                                                </button>
                                                <button
                                                    onClick={() => handleSavePrompt(prompt.key)}
                                                    disabled={saving}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 disabled:opacity-50"
                                                >
                                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                    Enregistrer
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <pre className="p-3 bg-gray-50 rounded-md text-sm text-gray-700 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                                            {prompt.content}
                                        </pre>
                                        <div className="flex items-center justify-between">
                                            {prompt.updatedAt && (
                                                <span className="text-xs text-gray-400">
                                                    Modifie le {formatDate(prompt.updatedAt)}
                                                </span>
                                            )}
                                            <div className="flex gap-2 ml-auto">
                                                {prompt.isCustomized && (
                                                    <button
                                                        onClick={() => handleResetPrompt(prompt.key)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded"
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                        Reinitialiser
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleEditPrompt(prompt)}
                                                    className="px-3 py-1.5 text-sm text-brand-600 hover:text-brand-700 border border-brand-300 rounded"
                                                >
                                                    Modifier
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Logs Tab */
                <div className="space-y-4">
                    {logs.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            Aucune interaction IA enregistree
                        </div>
                    ) : (
                        <>
                            {logs.map((log) => (
                                <div key={log.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                    <button
                                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                                    >
                                        <div className="flex items-center gap-4">
                                            {log.success ? (
                                                <CheckCircle className="w-5 h-5 text-green-500" />
                                            ) : (
                                                <AlertCircle className="w-5 h-5 text-red-500" />
                                            )}
                                            <div className="text-left">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-900">{log.operation}</span>
                                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                                        {log.model}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {formatDate(log.createdAt)}
                                                    {log.durationMs && ` • ${log.durationMs}ms`}
                                                    {log.tokensInput && log.tokensOutput && ` • ${log.tokensInput + log.tokensOutput} tokens`}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {log.score !== null && (
                                                <span className="text-lg font-semibold text-brand-600">
                                                    {log.score} pts
                                                </span>
                                            )}
                                            {expandedLog === log.id ? (
                                                <ChevronUp className="w-5 h-5 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                    </button>

                                    {expandedLog === log.id && (
                                        <div className="border-t border-gray-200 p-4 space-y-4 bg-gray-50">
                                            {/* System Prompt */}
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-700 mb-1">Prompt Systeme</h4>
                                                <pre className="p-3 bg-white border border-gray-200 rounded text-xs text-gray-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                                    {log.systemPrompt}
                                                </pre>
                                            </div>

                                            {/* User Prompt */}
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-700 mb-1">Prompt Utilisateur</h4>
                                                <pre className="p-3 bg-white border border-gray-200 rounded text-xs text-gray-600 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                                    {log.userPrompt}
                                                </pre>
                                            </div>

                                            {/* Response */}
                                            {log.success ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {log.feedback && (
                                                        <div>
                                                            <h4 className="text-sm font-medium text-gray-700 mb-1">Feedback etudiant</h4>
                                                            <div className="p-3 bg-white border border-gray-200 rounded text-sm text-gray-700">
                                                                {log.feedback}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {log.aiRationale && (
                                                        <div>
                                                            <h4 className="text-sm font-medium text-gray-700 mb-1">Raisonnement IA</h4>
                                                            <div className="p-3 bg-white border border-gray-200 rounded text-sm text-gray-700">
                                                                {log.aiRationale}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div>
                                                    <h4 className="text-sm font-medium text-red-700 mb-1">Erreur</h4>
                                                    <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                                                        {log.error}
                                                    </div>
                                                </div>
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
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Pagination */}
                            {logTotal > 20 && (
                                <div className="flex items-center justify-center gap-2 pt-4">
                                    <button
                                        onClick={() => setLogPage(p => Math.max(1, p - 1))}
                                        disabled={logPage === 1}
                                        className="px-3 py-1.5 text-sm border border-gray-300 rounded disabled:opacity-50"
                                    >
                                        Precedent
                                    </button>
                                    <span className="text-sm text-gray-500">
                                        Page {logPage} / {Math.ceil(logTotal / 20)}
                                    </span>
                                    <button
                                        onClick={() => setLogPage(p => p + 1)}
                                        disabled={logPage >= Math.ceil(logTotal / 20)}
                                        className="px-3 py-1.5 text-sm border border-gray-300 rounded disabled:opacity-50"
                                    >
                                        Suivant
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
