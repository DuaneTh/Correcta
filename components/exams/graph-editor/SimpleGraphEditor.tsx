'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { GraphEditorProps, GraphPayload, GraphArea, GraphAnchor } from './types'
import { ShapePalette } from './ShapePalette'
import { GraphCanvas } from './canvas/GraphCanvas'
import { ShapeTemplate, PREDEFINED_SHAPES } from './templates/predefinedShapes'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { pixelToGraph } from './coordinate-utils'
import { compileExpression } from '@/components/exams/graph-utils'
import { AreaPropertiesPanel } from './AreaPropertiesPanel'

/**
 * Find the function whose curve is closest to a given point.
 */
function findNearestFunction(
    point: { x: number; y: number },
    functions: GraphPayload['functions']
): { functionId: string; distance: number } | null {
    let nearest: { functionId: string; distance: number } | null = null

    for (const fn of functions) {
        const evaluator = compileExpression(fn.expression)
        if (!evaluator) continue

        const offsetX = fn.offsetX ?? 0
        const offsetY = fn.offsetY ?? 0
        const scaleY = fn.scaleY ?? 1

        try {
            const y = scaleY * evaluator(point.x - offsetX) + offsetY
            if (!Number.isFinite(y)) continue

            const distance = Math.abs(point.y - y)
            if (!nearest || distance < nearest.distance) {
                nearest = { functionId: fn.id, distance }
            }
        } catch {
            continue
        }
    }

    return nearest
}

/**
 * Find the line whose segment is closest to a given point.
 */
function findNearestLine(
    point: { x: number; y: number },
    lines: GraphPayload['lines']
): { lineId: string; distance: number; minX: number; maxX: number } | null {
    let nearest: { lineId: string; distance: number; minX: number; maxX: number } | null = null

    const getCoord = (anchor: GraphAnchor) => {
        if (anchor.type === 'coord') return { x: anchor.x, y: anchor.y }
        return { x: 0, y: 0 }
    }

    for (const line of lines) {
        const start = getCoord(line.start)
        const end = getCoord(line.end)

        const minX = Math.min(start.x, end.x)
        const maxX = Math.max(start.x, end.x)

        // Extend range for detection
        const margin = (maxX - minX) * 0.1 + 0.5
        if (point.x < minX - margin || point.x > maxX + margin) continue

        const dx = end.x - start.x
        const clampedX = Math.max(minX, Math.min(maxX, point.x))
        const t = dx !== 0 ? (clampedX - start.x) / dx : 0
        const lineY = start.y + t * (end.y - start.y)

        const distance = Math.abs(point.y - lineY)
        if (!nearest || distance < nearest.distance) {
            nearest = { lineId: line.id, distance, minX, maxX }
        }
    }

    return nearest
}

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

        // Smart area detection: automatically configure area based on nearby elements
        if (newElements.areas) {
            const threshold = 2 // Distance threshold in graph units
            const nearestFunc = findNearestFunction(dropCoord, value.functions || [])
            const nearestLine = findNearestLine(dropCoord, value.lines || [])

            const funcIsClose = nearestFunc && nearestFunc.distance < threshold
            const lineIsClose = nearestLine && nearestLine.distance < threshold

            newElements.areas = newElements.areas.map((a) => {
                // PRIORITY 1: Both line and function are close - area between them
                if (funcIsClose && lineIsClose && nearestFunc && nearestLine) {
                    return {
                        ...a,
                        mode: 'between-line-and-function' as const,
                        functionId: nearestFunc.functionId,
                        lineId: nearestLine.lineId,
                        domain: {
                            min: nearestLine.minX,
                            max: nearestLine.maxX,
                        },
                        labelPos: dropCoord,
                        points: undefined,
                    }
                }

                // PRIORITY 2: Only function is close - fill under function
                if (funcIsClose && nearestFunc) {
                    return {
                        ...a,
                        mode: 'under-function' as const,
                        functionId: nearestFunc.functionId,
                        lineId: undefined,
                        domain: {
                            min: dropCoord.x - 2,
                            max: dropCoord.x + 2,
                        },
                        labelPos: dropCoord,
                        points: undefined,
                    }
                }

                // FALLBACK: Create area at drop position, user will drag control point
                return {
                    ...a,
                    mode: 'under-function' as const,
                    labelPos: dropCoord,
                    domain: {
                        min: dropCoord.x - 2,
                        max: dropCoord.x + 2,
                    },
                    points: undefined,
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

    // Handle area update
    const handleAreaUpdate = useCallback((updatedArea: GraphArea) => {
        const updated: GraphPayload = {
            ...value,
            areas: value.areas.map(a => a.id === updatedArea.id ? updatedArea : a)
        }
        onChange(updated)
    }, [value, onChange])

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
                        ) : (
                            <div className="flex items-center gap-4">
                                <div className="text-xs font-medium text-gray-700">
                                    {isFrench ? 'Sélectionné:' : 'Selected:'}
                                </div>
                                <div className="text-xs text-gray-600 flex-1">
                                    {selected.type === 'point' && `Point (${(selected.element as typeof value.points[0]).x}, ${(selected.element as typeof value.points[0]).y})`}
                                    {selected.type === 'line' && `${isFrench ? 'Ligne' : 'Line'} - ${(selected.element as typeof value.lines[0]).kind}`}
                                    {selected.type === 'curve' && `${isFrench ? 'Courbe' : 'Curve'} - ${isFrench ? 'Glissez pour déplacer' : 'Drag to move'}`}
                                    {selected.type === 'function' && `f(x) = ${(selected.element as typeof value.functions[0]).expression} - ${isFrench ? 'Glissez pour déplacer' : 'Drag to move'}`}
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
