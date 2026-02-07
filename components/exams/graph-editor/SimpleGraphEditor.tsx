'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { GraphEditorProps, GraphPayload, GraphArea, GraphAnchor, GraphStrokeStyle } from './types'
import { ShapePalette } from './ShapePalette'
import { GraphCanvas } from './canvas/GraphCanvas'
import { ShapeTemplate, PREDEFINED_SHAPES } from './templates/predefinedShapes'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { pixelToGraph } from './coordinate-utils'
import { AreaPropertiesPanel } from './AreaPropertiesPanel'
import { StrokePropertiesPanel } from './StrokePropertiesPanel'
import { findEnclosingRegion, type RegionElement } from './region-detection'

/**
 * SimpleGraphEditor provides a PowerPoint-like drag-and-drop interface.
 * Layout: ShapePalette on the left, GraphCanvas in the center.
 * Features: shape insertion, selection, deletion, mini properties panel, collapsible axes config.
 */
export const SimpleGraphEditor: React.FC<GraphEditorProps> = ({ value, onChange, locale = 'fr' }) => {
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [showAxesConfig, setShowAxesConfig] = useState(false)
    const [draggedTemplate, setDraggedTemplate] = useState<ShapeTemplate | null>(null)
    const canvasContainerRef = useRef<HTMLDivElement>(null)
    const isFrench = locale === 'fr'

    /**
     * Add a shape from the palette.
     * Merges template elements into existing graph, auto-selects the first new element.
     */
    const handleAddShape = useCallback((template: ShapeTemplate) => {
        const newElements = template.createElements(value.axes)

        // Merge new elements into existing arrays
        const updated: GraphPayload = {
            ...value,
            points: [...(value.points || []), ...(newElements.points || [])],
            lines: [...(value.lines || []), ...(newElements.lines || [])],
            curves: [...(value.curves || []), ...(newElements.curves || [])],
            functions: [...(value.functions || []), ...(newElements.functions || [])],
            areas: [...(value.areas || []), ...(newElements.areas || [])],
            texts: [...(value.texts || []), ...(newElements.texts || [])],
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
     * Handle drop from palette - creates shape at drop position.
     */
    const handleCanvasDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        const shapeId = e.dataTransfer.getData('application/shape-template')

        if (!shapeId) {
            setDraggedTemplate(null)
            return
        }

        const template = PREDEFINED_SHAPES.find((s) => s.id === shapeId)

        if (!template) {
            setDraggedTemplate(null)
            return
        }

        // Get drop position relative to canvas
        const container = canvasContainerRef.current
        const canvasWidth = value.width || 480
        const canvasHeight = value.height || 280

        let dropCoord = { x: 0, y: 0 }

        if (container) {
            const rect = container.getBoundingClientRect()
            // Calculate offset to center canvas in container
            const offsetX = (rect.width - canvasWidth) / 2
            const offsetY = (rect.height - canvasHeight) / 2

            const pixelX = e.clientX - rect.left - offsetX
            const pixelY = e.clientY - rect.top - offsetY

            // Convert to graph coordinates
            dropCoord = pixelToGraph({ x: pixelX, y: pixelY }, value.axes, canvasWidth, canvasHeight)
        }

        // Create elements from template
        const newElements = template.createElements(value.axes)

        // Offset points to drop position
        if (newElements.points) {
            newElements.points = newElements.points.map((p) => ({
                ...p,
                x: p.x + dropCoord.x,
                y: p.y + dropCoord.y,
            }))
        }

        // Smart area detection: use findEnclosingRegion to calculate polygon at drop
        if (newElements.areas) {
            // Build elements list for region detection (all lines participate, including dashed/asymptotes)
            const regionElements: RegionElement[] = [
                ...(value.functions || []).map(fn => ({ type: 'function' as const, id: fn.id, element: fn })),
                ...(value.lines || []).map(ln => ({ type: 'line' as const, id: ln.id, element: ln })),
            ]

            newElements.areas = newElements.areas.map((a) => {
                // Try to find enclosing region at drop point
                const result = findEnclosingRegion(dropCoord, regionElements, value.axes)

                if (result && result.polygon.length >= 3) {
                    return {
                        ...a,
                        mode: 'bounded-region' as const,
                        boundaryIds: result.boundaryIds,
                        domain: result.domain,
                        points: result.polygon.map(pt => ({ type: 'coord' as const, x: pt.x, y: pt.y })),
                        labelPos: dropCoord,
                    }
                }

                // Fallback: create area with just the control point, user will drag it
                return {
                    ...a,
                    labelPos: dropCoord,
                    points: [],
                }
            })
        }

        // Merge into graph
        const updated: GraphPayload = {
            ...value,
            points: [...(value.points || []), ...(newElements.points || [])],
            lines: [...(value.lines || []), ...(newElements.lines || [])],
            curves: [...(value.curves || []), ...(newElements.curves || [])],
            functions: [...(value.functions || []), ...(newElements.functions || [])],
            areas: [...(value.areas || []), ...(newElements.areas || [])],
            texts: [...(value.texts || []), ...(newElements.texts || [])],
        }

        // Auto-select the first new element
        const firstNewId =
            newElements.areas?.[0]?.id ||
            newElements.points?.[0]?.id ||
            newElements.lines?.[0]?.id ||
            newElements.curves?.[0]?.id ||
            newElements.functions?.[0]?.id ||
            newElements.texts?.[0]?.id ||
            null

        onChange(updated)
        setSelectedId(firstNewId)
        setDraggedTemplate(null)
    }, [value, onChange])

    const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
    }, [])

    /**
     * Delete the currently selected element.
     */
    const handleDeleteSelected = useCallback(() => {
        if (!selectedId) return

        const updated: GraphPayload = {
            ...value,
            points: (value.points || []).filter((p) => p.id !== selectedId),
            lines: (value.lines || []).filter((l) => l.id !== selectedId),
            curves: (value.curves || []).filter((c) => c.id !== selectedId),
            functions: (value.functions || []).filter((f) => f.id !== selectedId),
            areas: (value.areas || []).filter((a) => a.id !== selectedId),
            texts: (value.texts || []).filter((t) => t.id !== selectedId),
        }

        onChange(updated)
        setSelectedId(null)
    }, [selectedId, value, onChange])

    // Handle Delete/Backspace key for removing selected element
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
                // Don't delete if user is typing in an input
                const target = e.target as HTMLElement
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                    return
                }
                e.preventDefault()
                handleDeleteSelected()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedId, handleDeleteSelected])

    /**
     * Find the selected element and its type.
     */
    const getSelectedElement = () => {
        if (!selectedId) return null

        const point = (value.points || []).find((p) => p.id === selectedId)
        if (point) return { type: 'point', element: point }

        const line = (value.lines || []).find((l) => l.id === selectedId)
        if (line) return { type: 'line', element: line }

        const curve = (value.curves || []).find((c) => c.id === selectedId)
        if (curve) return { type: 'curve', element: curve }

        const func = (value.functions || []).find((f) => f.id === selectedId)
        if (func) return { type: 'function', element: func }

        const area = (value.areas || []).find((a) => a.id === selectedId)
        if (area) return { type: 'area', element: area }

        const text = (value.texts || []).find((t) => t.id === selectedId)
        if (text) return { type: 'text', element: text }

        return null
    }

    const selected = getSelectedElement()

    // Get the selected area object from value.areas using selectedId
    const selectedArea = useMemo(() => {
        if (selected?.type !== 'area') return null
        return value.areas.find(a => a.id === selectedId) || null
    }, [selected, value.areas, selectedId])

    // Compute potential boundaries for extend mode
    const potentialBoundaries = useMemo(() => {
        if (!selectedArea) return []

        const boundaries: Array<{ id: string; label: string; type: 'function' | 'line' | 'axis' }> = []

        // Add all functions
        value.functions.forEach(fn => {
            boundaries.push({
                id: fn.id,
                label: fn.label || `f(x) = ${fn.expression}`,
                type: 'function'
            })
        })

        // Add all lines
        value.lines.forEach(ln => {
            boundaries.push({
                id: ln.id,
                label: ln.label || `${ln.kind}`,
                type: 'line'
            })
        })

        // Note: Axes are NOT included as automatic boundaries
        // Users must use explicit line segments if they want axis-like boundaries

        return boundaries
    }, [selectedArea, value.functions, value.lines, value.axes, isFrench])

    // Handle area update
    const handleAreaUpdate = useCallback((updatedArea: GraphArea) => {
        const updated: GraphPayload = {
            ...value,
            areas: value.areas.map(a => a.id === updatedArea.id ? updatedArea : a)
        }
        onChange(updated)
    }, [value, onChange])

    // Handle style update for functions, lines, and curves
    const handleStyleUpdate = useCallback((newStyle: GraphStrokeStyle) => {
        if (!selectedId) return
        const updated: GraphPayload = {
            ...value,
            functions: (value.functions || []).map(f =>
                f.id === selectedId ? { ...f, style: newStyle } : f
            ),
            lines: (value.lines || []).map(l =>
                l.id === selectedId ? { ...l, style: newStyle } : l
            ),
            curves: (value.curves || []).map(c =>
                c.id === selectedId ? { ...c, style: newStyle } : c
            ),
        }
        onChange(updated)
    }, [selectedId, value, onChange])

    return (
        <div className="flex h-full bg-white">
            {/* Left: Shape Palette */}
            <ShapePalette
                onAddShape={handleAddShape}
                onDragStart={setDraggedTemplate}
                onDragEnd={() => setDraggedTemplate(null)}
                locale={locale}
            />

            {/* Center: Canvas and properties */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Canvas - drop zone */}
                <div
                    ref={canvasContainerRef}
                    className={`flex-1 flex items-center justify-center bg-gray-50 p-4 relative ${draggedTemplate ? 'ring-2 ring-indigo-300 ring-inset' : ''}`}
                    onDragOver={handleCanvasDragOver}
                    onDrop={handleCanvasDrop}
                >
                    <GraphCanvas
                        graph={value}
                        width={value.width || 480}
                        height={value.height || 280}
                        onUpdate={onChange}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                    />
                    {/* Visual indicator during drag */}
                    {draggedTemplate && (
                        <div
                            className="absolute inset-0 bg-indigo-100/20 flex items-center justify-center"
                            onDragOver={handleCanvasDragOver}
                            onDrop={handleCanvasDrop}
                        >
                            <div className="text-indigo-600 font-medium text-sm bg-white/80 px-3 py-1 rounded-lg shadow pointer-events-none">
                                {isFrench ? 'Déposez ici' : 'Drop here'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Mini properties bar for selected element */}
                {selected && (
                    <div className="border-t border-gray-200 bg-white p-3">
                        {selected.type === 'area' && selectedArea ? (
                            <div className="flex items-start gap-3">
                                <AreaPropertiesPanel
                                    area={selectedArea}
                                    onUpdate={handleAreaUpdate}
                                    locale={locale}
                                    potentialBoundaries={potentialBoundaries}
                                />
                                <button
                                    type="button"
                                    onClick={handleDeleteSelected}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                                >
                                    <Trash2 size={14} />
                                    {isFrench ? 'Supprimer' : 'Delete'}
                                </button>
                            </div>
                        ) : (selected.type === 'function' || selected.type === 'line' || selected.type === 'curve') ? (
                            <div className="flex items-center gap-3">
                                <StrokePropertiesPanel
                                    style={(selected.element as { style?: GraphStrokeStyle }).style}
                                    onStyleChange={handleStyleUpdate}
                                    locale={locale}
                                />
                                <button
                                    type="button"
                                    onClick={handleDeleteSelected}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded shrink-0"
                                >
                                    <Trash2 size={14} />
                                    {isFrench ? 'Supprimer' : 'Delete'}
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-4">
                                <div className="text-xs font-medium text-gray-700">
                                    {isFrench ? 'Sélectionné:' : 'Selected:'}
                                </div>
                                <div className="text-xs text-gray-600 flex-1">
                                    {selected.type === 'point' && `Point (${(selected.element as typeof value.points[0]).x}, ${(selected.element as typeof value.points[0]).y})`}
                                    {selected.type === 'text' && `Texte: ${(selected.element as typeof value.texts[0]).text}`}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleDeleteSelected}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                                >
                                    <Trash2 size={14} />
                                    {isFrench ? 'Supprimer' : 'Delete'}
                                </button>
                            </div>
                        )}
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
