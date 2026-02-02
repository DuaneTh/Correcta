'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { GraphEditorProps, GraphPayload } from './types'
import { ShapePalette } from './ShapePalette'
import { GraphCanvas } from './canvas/GraphCanvas'
import { ShapeTemplate } from './templates/predefinedShapes'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

/**
 * SimpleGraphEditor provides a PowerPoint-like drag-and-drop interface.
 * Layout: ShapePalette on the left, GraphCanvas in the center.
 * Features: shape insertion, selection, deletion, mini properties panel, collapsible axes config.
 */
export const SimpleGraphEditor: React.FC<GraphEditorProps> = ({ value, onChange, locale = 'fr' }) => {
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [showAxesConfig, setShowAxesConfig] = useState(false)
    const isFrench = locale === 'fr'

    // Handle Delete key for removing selected element
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' && selectedId) {
                handleDeleteSelected()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedId])

    /**
     * Add a shape from the palette.
     * Merges template elements into existing graph, auto-selects the first new element.
     */
    const handleAddShape = useCallback((template: ShapeTemplate) => {
        const newElements = template.createElements(value.axes)

        // Merge new elements into existing arrays
        const updated: GraphPayload = {
            ...value,
            points: [...value.points, ...(newElements.points || [])],
            lines: [...value.lines, ...(newElements.lines || [])],
            curves: [...value.curves, ...(newElements.curves || [])],
            functions: [...value.functions, ...(newElements.functions || [])],
            areas: [...value.areas, ...(newElements.areas || [])],
            texts: [...value.texts, ...(newElements.texts || [])],
        }

        // Auto-select the first newly added element
        const firstNewId =
            newElements.points?.[0]?.id ||
            newElements.lines?.[0]?.id ||
            newElements.curves?.[0]?.id ||
            newElements.functions?.[0]?.id ||
            newElements.areas?.[0]?.id ||
            newElements.texts?.[0]?.id ||
            null

        onChange(updated)
        setSelectedId(firstNewId)
    }, [value, onChange])

    /**
     * Delete the currently selected element.
     */
    const handleDeleteSelected = useCallback(() => {
        if (!selectedId) return

        const updated: GraphPayload = {
            ...value,
            points: value.points.filter((p) => p.id !== selectedId),
            lines: value.lines.filter((l) => l.id !== selectedId),
            curves: value.curves.filter((c) => c.id !== selectedId),
            functions: value.functions.filter((f) => f.id !== selectedId),
            areas: value.areas.filter((a) => a.id !== selectedId),
            texts: value.texts.filter((t) => t.id !== selectedId),
        }

        onChange(updated)
        setSelectedId(null)
    }, [selectedId, value, onChange])

    /**
     * Find the selected element and its type.
     */
    const getSelectedElement = () => {
        if (!selectedId) return null

        const point = value.points.find((p) => p.id === selectedId)
        if (point) return { type: 'point', element: point }

        const line = value.lines.find((l) => l.id === selectedId)
        if (line) return { type: 'line', element: line }

        const curve = value.curves.find((c) => c.id === selectedId)
        if (curve) return { type: 'curve', element: curve }

        const func = value.functions.find((f) => f.id === selectedId)
        if (func) return { type: 'function', element: func }

        const area = value.areas.find((a) => a.id === selectedId)
        if (area) return { type: 'area', element: area }

        const text = value.texts.find((t) => t.id === selectedId)
        if (text) return { type: 'text', element: text }

        return null
    }

    const selected = getSelectedElement()

    return (
        <div className="flex h-full bg-white">
            {/* Left: Shape Palette */}
            <ShapePalette onAddShape={handleAddShape} locale={locale} />

            {/* Center: Canvas and properties */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Canvas */}
                <div className="flex-1 flex items-center justify-center bg-gray-50 p-4">
                    <GraphCanvas
                        graph={value}
                        width={value.width || 480}
                        height={value.height || 280}
                        onUpdate={onChange}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                    />
                </div>

                {/* Mini properties bar for selected element */}
                {selected && (
                    <div className="border-t border-gray-200 bg-white p-3 flex items-center gap-4">
                        <div className="text-xs font-medium text-gray-700">
                            {isFrench ? 'Sélectionné:' : 'Selected:'}
                        </div>
                        <div className="text-xs text-gray-600">
                            {selected.type === 'point' && `Point (${(selected.element as typeof value.points[0]).x}, ${(selected.element as typeof value.points[0]).y})`}
                            {selected.type === 'line' && `${isFrench ? 'Ligne' : 'Line'} - ${(selected.element as typeof value.lines[0]).kind}`}
                            {selected.type === 'curve' && `${isFrench ? 'Courbe' : 'Curve'}`}
                            {selected.type === 'function' && `Fonction: ${(selected.element as typeof value.functions[0]).expression}`}
                            {selected.type === 'area' && `${isFrench ? 'Surface' : 'Area'} - ${(selected.element as typeof value.areas[0]).mode}`}
                            {selected.type === 'text' && `Texte: ${(selected.element as typeof value.texts[0]).text}`}
                        </div>
                        <button
                            type="button"
                            onClick={handleDeleteSelected}
                            className="ml-auto flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                        >
                            <Trash2 size={14} />
                            {isFrench ? 'Supprimer' : 'Delete'}
                        </button>
                    </div>
                )}

                {/* Collapsible axes config panel */}
                <div className="border-t border-gray-200 bg-white">
                    <button
                        type="button"
                        onClick={() => setShowAxesConfig(!showAxesConfig)}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                        <span>{isFrench ? 'Configuration des axes' : 'Axes Configuration'}</span>
                        {showAxesConfig ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {showAxesConfig && (
                        <div className="px-3 pb-3 space-y-3">
                            <div className="grid grid-cols-4 gap-2">
                                <label className="flex flex-col gap-1">
                                    <span className="text-[11px] text-gray-500">x min</span>
                                    <input
                                        type="number"
                                        value={value.axes.xMin}
                                        onChange={(e) => onChange({
                                            ...value,
                                            axes: { ...value.axes, xMin: Number(e.target.value) }
                                        })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                                    />
                                </label>
                                <label className="flex flex-col gap-1">
                                    <span className="text-[11px] text-gray-500">x max</span>
                                    <input
                                        type="number"
                                        value={value.axes.xMax}
                                        onChange={(e) => onChange({
                                            ...value,
                                            axes: { ...value.axes, xMax: Number(e.target.value) }
                                        })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                                    />
                                </label>
                                <label className="flex flex-col gap-1">
                                    <span className="text-[11px] text-gray-500">y min</span>
                                    <input
                                        type="number"
                                        value={value.axes.yMin}
                                        onChange={(e) => onChange({
                                            ...value,
                                            axes: { ...value.axes, yMin: Number(e.target.value) }
                                        })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                                    />
                                </label>
                                <label className="flex flex-col gap-1">
                                    <span className="text-[11px] text-gray-500">y max</span>
                                    <input
                                        type="number"
                                        value={value.axes.yMax}
                                        onChange={(e) => onChange({
                                            ...value,
                                            axes: { ...value.axes, yMax: Number(e.target.value) }
                                        })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                                    />
                                </label>
                            </div>

                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-xs text-gray-600">
                                    <input
                                        type="checkbox"
                                        checked={value.axes.showGrid}
                                        onChange={(e) => onChange({
                                            ...value,
                                            axes: { ...value.axes, showGrid: e.target.checked }
                                        })}
                                    />
                                    {isFrench ? 'Afficher la grille' : 'Show Grid'}
                                </label>
                                <label className="flex items-center gap-2">
                                    <span className="text-[11px] text-gray-500">
                                        {isFrench ? 'Pas de grille:' : 'Grid step:'}
                                    </span>
                                    <input
                                        type="number"
                                        value={value.axes.gridStep}
                                        onChange={(e) => onChange({
                                            ...value,
                                            axes: { ...value.axes, gridStep: Number(e.target.value) }
                                        })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-16"
                                    />
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
