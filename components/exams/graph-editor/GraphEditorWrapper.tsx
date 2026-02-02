'use client'

import React, { useState } from 'react'
import { GraphPayload, EditorMode } from './types'
import { SimpleGraphEditor } from './SimpleGraphEditor'
import { AdvancedGraphEditor } from './AdvancedGraphEditor'
import { Check, X, Trash2 } from 'lucide-react'

interface GraphEditorWrapperProps {
    value: GraphPayload
    onChange: (payload: GraphPayload) => void
    onConfirm?: () => void
    onCancel?: () => void
    onDelete?: () => void
    locale?: string
    initialMode?: EditorMode
}

/**
 * GraphEditorWrapper provides dual-mode graph editing:
 * - Simple mode: PowerPoint-like drag-and-drop canvas
 * - Advanced mode: Form-based precise numeric controls
 *
 * Features:
 * - Mode toggle between Simple and Advanced
 * - Shared state across both modes (switching preserves data)
 * - Action buttons for confirm/cancel/delete operations
 * - Clean modern UI with border, rounded corners, shadow
 */
export const GraphEditorWrapper: React.FC<GraphEditorWrapperProps> = ({
    value,
    onChange,
    onConfirm,
    onCancel,
    onDelete,
    locale = 'fr',
    initialMode = 'simple',
}) => {
    const [mode, setMode] = useState<EditorMode>(initialMode)
    const isFrench = locale === 'fr'

    return (
        <div className="bg-white rounded-lg border border-gray-300 shadow-lg overflow-hidden flex flex-col h-[600px]">
            {/* Header */}
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
                {/* Title */}
                <h3 className="text-base font-semibold text-gray-800">
                    {isFrench ? 'Éditeur de graphique' : 'Graph Editor'}
                </h3>

                {/* Mode Toggle */}
                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md p-1">
                    <button
                        type="button"
                        onClick={() => setMode('simple')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                            mode === 'simple'
                                ? 'bg-indigo-600 text-white'
                                : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        {isFrench ? 'Simple' : 'Simple'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('advanced')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                            mode === 'advanced'
                                ? 'bg-indigo-600 text-white'
                                : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        {isFrench ? 'Avancé' : 'Advanced'}
                    </button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    {onDelete && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200"
                        >
                            <Trash2 size={14} />
                            {isFrench ? 'Supprimer' : 'Delete'}
                        </button>
                    )}
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded border border-gray-300"
                        >
                            <X size={14} />
                            {isFrench ? 'Annuler' : 'Cancel'}
                        </button>
                    )}
                    {onConfirm && (
                        <button
                            type="button"
                            onClick={onConfirm}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded"
                        >
                            <Check size={14} />
                            {isFrench ? 'Confirmer' : 'Confirm'}
                        </button>
                    )}
                </div>
            </div>

            {/* Body - renders mode-specific editor */}
            <div className="flex-1 overflow-hidden">
                {mode === 'simple' ? (
                    <SimpleGraphEditor value={value} onChange={onChange} locale={locale} />
                ) : (
                    <AdvancedGraphEditor value={value} onChange={onChange} locale={locale} />
                )}
            </div>
        </div>
    )
}
