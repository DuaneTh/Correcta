'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { GraphPayload } from './types'
import { renderGraphInto } from '@/components/exams/graph-utils'

/**
 * Utility to generate unique IDs for graph elements.
 */
const createId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return `seg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Utility to normalize numeric values.
 */
const normalizeNumber = (value: unknown, fallback: number): number => {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
}

/**
 * Normalize a graph anchor (either point reference or coordinate).
 */
const normalizeGraphAnchor = (value: unknown) => {
    const anchor = value as { type?: string; pointId?: string; x?: unknown; y?: unknown } | undefined
    if (anchor?.type === 'point' && typeof anchor.pointId === 'string') {
        return { type: 'point' as const, pointId: anchor.pointId }
    }
    return {
        type: 'coord' as const,
        x: normalizeNumber(anchor?.x, 0),
        y: normalizeNumber(anchor?.y, 0),
    }
}

/**
 * Normalize a graph payload to ensure all fields have valid values.
 */
const normalizeGraphPayload = (input?: Partial<GraphPayload>): GraphPayload => {
    const graph = input || {}
    const axesInput = graph.axes
    const axes = {
        xMin: normalizeNumber(axesInput?.xMin, -5),
        xMax: normalizeNumber(axesInput?.xMax, 5),
        yMin: normalizeNumber(axesInput?.yMin, -5),
        yMax: normalizeNumber(axesInput?.yMax, 5),
        xLabel: typeof axesInput?.xLabel === 'string' ? axesInput.xLabel : '',
        yLabel: typeof axesInput?.yLabel === 'string' ? axesInput.yLabel : '',
        xLabelIsMath: Boolean(axesInput?.xLabelIsMath),
        yLabelIsMath: Boolean(axesInput?.yLabelIsMath),
        showGrid: axesInput?.showGrid !== false,
        gridStep: normalizeNumber(axesInput?.gridStep, 1),
    }
    if (axes.xMax <= axes.xMin) {
        axes.xMin = -5
        axes.xMax = 5
    }
    if (axes.yMax <= axes.yMin) {
        axes.yMin = -5
        axes.yMax = 5
    }

    return {
        axes,
        points: Array.isArray(graph.points)
            ? graph.points.map((point) => ({
                id: point?.id || createId(),
                x: normalizeNumber(point?.x, 0),
                y: normalizeNumber(point?.y, 0),
                label: typeof point?.label === 'string' ? point.label : '',
                labelIsMath: Boolean(point?.labelIsMath),
                showLabel: point?.showLabel !== false,
                color: typeof point?.color === 'string' ? point.color : undefined,
                size: normalizeNumber(point?.size, 4),
                filled: point?.filled !== false,
                anchor: point?.anchor,
            }))
            : [],
        lines: Array.isArray(graph.lines)
            ? graph.lines.map((line) => ({
                id: line?.id || createId(),
                start: normalizeGraphAnchor(line?.start),
                end: normalizeGraphAnchor(line?.end),
                kind: line?.kind === 'line' || line?.kind === 'ray' ? line.kind : 'segment',
                style: line?.style,
                label: typeof line?.label === 'string' ? line.label : undefined,
                labelIsMath: Boolean(line?.labelIsMath),
                showLabel: line?.showLabel !== false,
            }))
            : [],
        curves: Array.isArray(graph.curves)
            ? graph.curves.map((curve) => ({
                id: curve?.id || createId(),
                start: normalizeGraphAnchor(curve?.start),
                end: normalizeGraphAnchor(curve?.end),
                curvature: normalizeNumber(curve?.curvature, 0),
                style: curve?.style,
                label: typeof curve?.label === 'string' ? curve.label : undefined,
                labelIsMath: Boolean(curve?.labelIsMath),
                showLabel: curve?.showLabel !== false,
            }))
            : [],
        functions: Array.isArray(graph.functions)
            ? graph.functions.map((fn) => ({
                id: fn?.id || createId(),
                expression: typeof fn?.expression === 'string' ? fn.expression : '',
                domain: fn?.domain,
                style: fn?.style,
                label: typeof fn?.label === 'string' ? fn.label : undefined,
                labelIsMath: Boolean(fn?.labelIsMath),
                showLabel: fn?.showLabel !== false,
            }))
            : [],
        areas: Array.isArray(graph.areas)
            ? graph.areas.map((area) => ({
                id: area?.id || createId(),
                mode: area?.mode === 'under-function' || area?.mode === 'between-functions' || area?.mode === 'between-line-and-function'
                    ? area.mode
                    : 'polygon',
                points: Array.isArray(area?.points) ? area.points.map((point) => normalizeGraphAnchor(point)) : undefined,
                functionId: typeof area?.functionId === 'string' ? area.functionId : undefined,
                functionId2: typeof area?.functionId2 === 'string' ? area.functionId2 : undefined,
                lineId: typeof area?.lineId === 'string' ? area.lineId : undefined,
                domain: area?.domain,
                fill: area?.fill,
                label: typeof area?.label === 'string' ? area.label : undefined,
                labelIsMath: Boolean(area?.labelIsMath),
                showLabel: area?.showLabel !== false,
            }))
            : [],
        texts: Array.isArray(graph.texts)
            ? graph.texts.map((text) => ({
                id: text?.id || createId(),
                x: normalizeNumber(text?.x, 0),
                y: normalizeNumber(text?.y, 0),
                text: typeof text?.text === 'string' ? text.text : '',
                isMath: Boolean(text?.isMath),
            }))
            : [],
        width: normalizeNumber(graph.width, 480),
        height: normalizeNumber(graph.height, 280),
        background: typeof graph.background === 'string' ? graph.background : 'white',
    }
}

interface AdvancedGraphEditorProps {
    value: GraphPayload
    onChange: (payload: GraphPayload) => void
    locale?: string
}

/**
 * AdvancedGraphEditor: Form-based graph editor with precise numeric controls.
 * Extracted from SegmentedMathField's InlineGraphEditor.
 *
 * This component provides a complete form interface for editing all graph elements:
 * - Axes configuration (bounds, labels, grid)
 * - Points (coordinates, labels, styling)
 * - Lines (segments, rays, infinite lines with anchors)
 * - Curves (bezier curves with curvature control)
 * - Functions (mathematical expressions with domains)
 * - Areas (polygon, under-function, between-functions, between-line-and-function)
 * - Texts (positioned labels)
 *
 * Includes live preview using renderGraphInto from graph-utils.
 */
export function AdvancedGraphEditor({ value, onChange, locale = 'fr' }: AdvancedGraphEditorProps) {
    const previewRef = useRef<HTMLDivElement>(null)
    const [pendingDelete, setPendingDelete] = useState<{ type: string; id: string } | null>(null)
    const isFrench = locale === 'fr'
    const payload = normalizeGraphPayload(value)

    // Update preview whenever payload changes
    useEffect(() => {
        if (!previewRef.current) return
        renderGraphInto(previewRef.current, { id: 'preview', type: 'graph', ...payload }, { maxWidth: 300 })
    }, [payload])

    const updatePayload = (next: GraphPayload) => {
        setPendingDelete(null)
        onChange(next)
    }

    const updateAxes = (key: keyof GraphPayload['axes'], value: string | number | boolean) => {
        updatePayload({
            ...payload,
            axes: {
                ...payload.axes,
                [key]: value,
            },
        })
    }

    const updatePoint = (id: string, patch: Partial<GraphPayload['points'][0]>) => {
        updatePayload({
            ...payload,
            points: payload.points.map((point) => (point.id === id ? { ...point, ...patch } : point)),
        })
    }

    const addPoint = () => {
        updatePayload({
            ...payload,
            points: [
                ...payload.points,
                { id: createId(), x: 0, y: 0, label: '', labelIsMath: false, size: 4, filled: true },
            ],
        })
    }

    const removePoint = (id: string) => {
        updatePayload({
            ...payload,
            points: payload.points.filter((point) => point.id !== id),
            lines: payload.lines.filter((line) => line.start.type !== 'point' || line.start.pointId !== id)
                .filter((line) => line.end.type !== 'point' || line.end.pointId !== id),
            curves: payload.curves.filter((curve) => curve.start.type !== 'point' || curve.start.pointId !== id)
                .filter((curve) => curve.end.type !== 'point' || curve.end.pointId !== id),
        })
    }

    const updateLine = (id: string, patch: Partial<GraphPayload['lines'][0]>) => {
        updatePayload({
            ...payload,
            lines: payload.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
        })
    }

    const addLine = () => {
        updatePayload({
            ...payload,
            lines: [
                ...payload.lines,
                {
                    id: createId(),
                    kind: 'segment',
                    start: { type: 'coord', x: -2, y: 0 },
                    end: { type: 'coord', x: 2, y: 0 },
                    style: { color: '#111827', width: 1.5 },
                },
            ],
        })
    }

    const removeLine = (id: string) => {
        updatePayload({ ...payload, lines: payload.lines.filter((line) => line.id !== id) })
    }

    const updateCurve = (id: string, patch: Partial<GraphPayload['curves'][0]>) => {
        updatePayload({
            ...payload,
            curves: payload.curves.map((curve) => (curve.id === id ? { ...curve, ...patch } : curve)),
        })
    }

    const addCurve = () => {
        updatePayload({
            ...payload,
            curves: [
                ...payload.curves,
                {
                    id: createId(),
                    start: { type: 'coord', x: -2, y: -1 },
                    end: { type: 'coord', x: 2, y: 1 },
                    curvature: 1,
                    style: { color: '#2563eb', width: 1.5 },
                },
            ],
        })
    }

    const removeCurve = (id: string) => {
        updatePayload({ ...payload, curves: payload.curves.filter((curve) => curve.id !== id) })
    }

    const updateFunction = (id: string, patch: Partial<GraphPayload['functions'][0]>) => {
        updatePayload({
            ...payload,
            functions: payload.functions.map((fn) => (fn.id === id ? { ...fn, ...patch } : fn)),
        })
    }

    const addFunction = () => {
        updatePayload({
            ...payload,
            functions: [
                ...payload.functions,
                {
                    id: createId(),
                    expression: 'sin(x)',
                    domain: { min: payload.axes.xMin, max: payload.axes.xMax },
                    style: { color: '#7c3aed', width: 1.5 },
                },
            ],
        })
    }

    const removeFunction = (id: string) => {
        updatePayload({
            ...payload,
            functions: payload.functions.filter((fn) => fn.id !== id),
            areas: payload.areas.filter((area) => area.functionId !== id && area.functionId2 !== id),
        })
    }

    const updateArea = (id: string, patch: Partial<GraphPayload['areas'][0]>) => {
        updatePayload({
            ...payload,
            areas: payload.areas.map((area) => (area.id === id ? { ...area, ...patch } : area)),
        })
    }

    const addArea = () => {
        updatePayload({
            ...payload,
            areas: [
                ...payload.areas,
                {
                    id: createId(),
                    mode: 'polygon',
                    points: [
                        { type: 'coord', x: -2, y: 0 },
                        { type: 'coord', x: 0, y: 2 },
                        { type: 'coord', x: 2, y: 0 },
                    ],
                    fill: { color: '#6366f1', opacity: 0.2 },
                },
            ],
        })
    }

    const removeArea = (id: string) => {
        updatePayload({ ...payload, areas: payload.areas.filter((area) => area.id !== id) })
    }

    const updateText = (id: string, patch: Partial<GraphPayload['texts'][0]>) => {
        updatePayload({
            ...payload,
            texts: payload.texts.map((text) => (text.id === id ? { ...text, ...patch } : text)),
        })
    }

    const addText = () => {
        updatePayload({
            ...payload,
            texts: [
                ...payload.texts,
                { id: createId(), x: 0, y: 0, text: isFrench ? 'Texte' : 'Text', isMath: false },
            ],
        })
    }

    const removeText = (id: string) => {
        updatePayload({ ...payload, texts: payload.texts.filter((text) => text.id !== id) })
    }

    const renderAnchorEditor = (
        anchor: GraphPayload['lines'][0]['start'],
        onUpdate: (next: GraphPayload['lines'][0]['start']) => void
    ) => {
        const pointOptions = payload.points
        const handleTypeChange = (value: string) => {
            if (value === 'point') {
                onUpdate({ type: 'point', pointId: pointOptions[0]?.id || '' })
            } else {
                onUpdate({ type: 'coord', x: 0, y: 0 })
            }
        }

        return (
            <div className="flex items-center gap-1">
                <select
                    value={anchor.type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="border border-gray-200 rounded px-1 py-0.5 text-[11px]"
                >
                    <option value="coord">{isFrench ? 'Coord' : 'Coord'}</option>
                    <option value="point">{isFrench ? 'Point' : 'Point'}</option>
                </select>
                {anchor.type === 'point' ? (
                    <select
                        value={anchor.pointId}
                        onChange={(e) => onUpdate({ type: 'point', pointId: e.target.value })}
                        className="border border-gray-200 rounded px-1 py-0.5 text-[11px]"
                    >
                        {pointOptions.length === 0 && (
                            <option value="">{isFrench ? 'Aucun' : 'None'}</option>
                        )}
                        {pointOptions.map((point) => (
                            <option key={point.id} value={point.id}>
                                {point.label || point.id.slice(0, 4)}
                            </option>
                        ))}
                    </select>
                ) : (
                    <>
                        <input
                            type="number"
                            value={anchor.x}
                            onChange={(e) => onUpdate({ type: 'coord', x: Number(e.target.value), y: anchor.y })}
                            className="border border-gray-200 rounded px-1 py-0.5 text-[11px] w-16"
                        />
                        <input
                            type="number"
                            value={anchor.y}
                            onChange={(e) => onUpdate({ type: 'coord', x: anchor.x, y: Number(e.target.value) })}
                            className="border border-gray-200 rounded px-1 py-0.5 text-[11px] w-16"
                        />
                    </>
                )}
            </div>
        )
    }

    const handleDeleteClick = (type: string, id: string, onConfirmDelete: () => void) => {
        if (pendingDelete?.id === id && pendingDelete.type === type) {
            onConfirmDelete()
            setPendingDelete(null)
            return
        }
        setPendingDelete({ type, id })
    }

    const inputLabelClass = 'text-[11px] text-gray-500'
    const inputClass = 'border border-gray-200 rounded px-1 py-0.5 text-xs'

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-800">{isFrench ? 'Modifier le graphique' : 'Edit Graph'}</span>
            </div>

            <div className="flex gap-3">
                <div className="flex-1 space-y-3 max-h-[70vh] overflow-auto pr-2">
                    {/* Axes Configuration */}
                    <div className="border border-gray-200 rounded p-2 space-y-2">
                        <div className="text-xs font-medium text-gray-700">{isFrench ? 'Axes' : 'Axes'}</div>
                        <div className="grid grid-cols-4 gap-2">
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>x min</span>
                                <input
                                    type="number"
                                    value={payload.axes.xMin}
                                    onChange={(e) => updateAxes('xMin', Number(e.target.value))}
                                    className={inputClass}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>x max</span>
                                <input
                                    type="number"
                                    value={payload.axes.xMax}
                                    onChange={(e) => updateAxes('xMax', Number(e.target.value))}
                                    className={inputClass}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>y min</span>
                                <input
                                    type="number"
                                    value={payload.axes.yMin}
                                    onChange={(e) => updateAxes('yMin', Number(e.target.value))}
                                    className={inputClass}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>y max</span>
                                <input
                                    type="number"
                                    value={payload.axes.yMax}
                                    onChange={(e) => updateAxes('yMax', Number(e.target.value))}
                                    className={inputClass}
                                />
                            </label>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>{isFrench ? 'Label x' : 'x label'}</span>
                                <input
                                    type="text"
                                    value={payload.axes.xLabel}
                                    onChange={(e) => updateAxes('xLabel', e.target.value)}
                                    className={inputClass}
                                />
                            </label>
                            <label className="flex items-center gap-2 text-xs text-gray-600">
                                <input
                                    type="checkbox"
                                    checked={payload.axes.xLabelIsMath}
                                    onChange={(e) => updateAxes('xLabelIsMath', e.target.checked)}
                                />
                                {isFrench ? 'Formule' : 'Math'}
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>{isFrench ? 'Label y' : 'y label'}</span>
                                <input
                                    type="text"
                                    value={payload.axes.yLabel}
                                    onChange={(e) => updateAxes('yLabel', e.target.value)}
                                    className={inputClass}
                                />
                            </label>
                            <label className="flex items-center gap-2 text-xs text-gray-600">
                                <input
                                    type="checkbox"
                                    checked={payload.axes.yLabelIsMath}
                                    onChange={(e) => updateAxes('yLabelIsMath', e.target.checked)}
                                />
                                {isFrench ? 'Formule' : 'Math'}
                            </label>
                            <label className="flex items-center gap-2 text-xs text-gray-600">
                                <input
                                    type="checkbox"
                                    checked={payload.axes.showGrid}
                                    onChange={(e) => updateAxes('showGrid', e.target.checked)}
                                />
                                {isFrench ? 'Grille' : 'Grid'}
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>{isFrench ? 'Pas' : 'Step'}</span>
                                <input
                                    type="number"
                                    value={payload.axes.gridStep}
                                    onChange={(e) => updateAxes('gridStep', Number(e.target.value))}
                                    className={inputClass}
                                />
                            </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>{isFrench ? 'Largeur' : 'Width'}</span>
                                <input
                                    type="number"
                                    value={payload.width}
                                    onChange={(e) => updatePayload({ ...payload, width: Number(e.target.value) })}
                                    className={inputClass}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>{isFrench ? 'Hauteur' : 'Height'}</span>
                                <input
                                    type="number"
                                    value={payload.height}
                                    onChange={(e) => updatePayload({ ...payload, height: Number(e.target.value) })}
                                    className={inputClass}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Points */}
                    <div className="border border-gray-200 rounded p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700">{isFrench ? 'Points' : 'Points'}</span>
                            <button
                                type="button"
                                onClick={addPoint}
                                className="text-xs text-indigo-700 hover:text-indigo-800"
                            >
                                {isFrench ? '+ Ajouter un point' : '+ Add point'}
                            </button>
                        </div>
                        {payload.points.length === 0 && (
                            <div className="text-[11px] text-gray-500">{isFrench ? 'Aucun point' : 'No points yet'}</div>
                        )}
                        {payload.points.map((point) => (
                            <div key={point.id} className="flex flex-wrap items-center gap-2 text-xs">
                                <label className="flex items-center gap-1 text-[11px] text-gray-600" title={isFrench ? 'Afficher le label' : 'Show label'}>
                                    <input
                                        type="checkbox"
                                        checked={point.showLabel !== false}
                                        onChange={(e) => updatePoint(point.id, { showLabel: e.target.checked })}
                                    />
                                </label>
                                <input
                                    type="text"
                                    value={point.label || ''}
                                    onChange={(e) => updatePoint(point.id, { label: e.target.value })}
                                    placeholder={isFrench ? 'Label' : 'Label'}
                                    className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                                />
                                <label className="flex items-center gap-1 text-[11px] text-gray-600" title="LaTeX">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(point.labelIsMath)}
                                        onChange={(e) => updatePoint(point.id, { labelIsMath: e.target.checked })}
                                    />
                                    $
                                </label>
                                <input
                                    type="number"
                                    value={point.x}
                                    onChange={(e) => updatePoint(point.id, { x: Number(e.target.value) })}
                                    className="border border-gray-200 rounded px-1 py-0.5 text-xs w-14"
                                    title="x"
                                />
                                <input
                                    type="number"
                                    value={point.y}
                                    onChange={(e) => updatePoint(point.id, { y: Number(e.target.value) })}
                                    className="border border-gray-200 rounded px-1 py-0.5 text-xs w-14"
                                    title="y"
                                />
                                <input
                                    type="color"
                                    value={point.color || '#111827'}
                                    onChange={(e) => updatePoint(point.id, { color: e.target.value })}
                                />
                                <input
                                    type="number"
                                    value={point.size ?? 4}
                                    onChange={(e) => updatePoint(point.id, { size: Number(e.target.value) })}
                                    className="border border-gray-200 rounded px-1 py-0.5 text-xs w-12"
                                    title={isFrench ? 'Taille' : 'Size'}
                                />
                                <label className="flex items-center gap-1 text-[11px] text-gray-600">
                                    <input
                                        type="checkbox"
                                        checked={point.filled !== false}
                                        onChange={(e) => updatePoint(point.id, { filled: e.target.checked })}
                                    />
                                    {isFrench ? 'Plein' : 'Filled'}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteClick('point', point.id, () => removePoint(point.id))}
                                    className={`text-[11px] ${
                                        pendingDelete?.id === point.id && pendingDelete.type === 'point'
                                            ? 'text-red-800'
                                            : 'text-red-600'
                                    }`}
                                >
                                    {pendingDelete?.id === point.id && pendingDelete.type === 'point'
                                        ? (isFrench ? 'Confirmer' : 'Confirm')
                                        : (isFrench ? 'Supprimer' : 'Delete')}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Lines */}
                    <div className="border border-gray-200 rounded p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700">{isFrench ? 'Lignes' : 'Lines'}</span>
                            <button
                                type="button"
                                onClick={addLine}
                                className="text-xs text-indigo-700 hover:text-indigo-800"
                            >
                                {isFrench ? '+ Ajouter une ligne' : '+ Add line'}
                            </button>
                        </div>
                        {payload.lines.length === 0 && (
                            <div className="text-[11px] text-gray-500">{isFrench ? 'Aucune ligne' : 'No lines yet'}</div>
                        )}
                        {payload.lines.map((line) => (
                            <div key={line.id} className="border border-gray-100 rounded p-2 space-y-2 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                    <select
                                        value={line.kind}
                                        onChange={(e) => updateLine(line.id, { kind: e.target.value as GraphPayload['lines'][0]['kind'] })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                                    >
                                        <option value="segment">{isFrench ? 'Segment' : 'Segment'}</option>
                                        <option value="line">{isFrench ? 'Droite' : 'Line'}</option>
                                        <option value="ray">{isFrench ? 'Demi-droite' : 'Ray'}</option>
                                    </select>
                                    <label className="text-[11px] text-gray-500">{isFrench ? 'Début' : 'Start'}</label>
                                    {renderAnchorEditor(line.start, (next) => updateLine(line.id, { start: next }))}
                                    <label className="text-[11px] text-gray-500">{isFrench ? 'Fin' : 'End'}</label>
                                    {renderAnchorEditor(line.end, (next) => updateLine(line.id, { end: next }))}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <label className="flex items-center gap-1 text-[11px] text-gray-600" title={isFrench ? 'Afficher le label' : 'Show label'}>
                                        <input
                                            type="checkbox"
                                            checked={line.showLabel !== false}
                                            onChange={(e) => updateLine(line.id, { showLabel: e.target.checked })}
                                        />
                                    </label>
                                    <input
                                        type="text"
                                        value={line.label || ''}
                                        onChange={(e) => updateLine(line.id, { label: e.target.value })}
                                        placeholder={isFrench ? 'Label' : 'Label'}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-16"
                                    />
                                    <label className="flex items-center gap-1 text-[11px] text-gray-600" title="LaTeX">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(line.labelIsMath)}
                                            onChange={(e) => updateLine(line.id, { labelIsMath: e.target.checked })}
                                        />
                                        $
                                    </label>
                                    <input
                                        type="color"
                                        value={line.style?.color || '#111827'}
                                        onChange={(e) => updateLine(line.id, { style: { ...line.style, color: e.target.value } })}
                                    />
                                    <input
                                        type="number"
                                        value={line.style?.width ?? 1.5}
                                        onChange={(e) => updateLine(line.id, { style: { ...line.style, width: Number(e.target.value) } })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-14"
                                    />
                                    <label className="flex items-center gap-1 text-[11px] text-gray-600">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(line.style?.dashed)}
                                            onChange={(e) => updateLine(line.id, { style: { ...line.style, dashed: e.target.checked } })}
                                        />
                                        {isFrench ? 'Pointillé' : 'Dashed'}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteClick('line', line.id, () => removeLine(line.id))}
                                        className={`text-[11px] ${
                                            pendingDelete?.id === line.id && pendingDelete.type === 'line'
                                                ? 'text-red-800'
                                                : 'text-red-600'
                                        }`}
                                    >
                                        {pendingDelete?.id === line.id && pendingDelete.type === 'line'
                                            ? (isFrench ? 'Confirmer' : 'Confirm')
                                            : (isFrench ? 'Supprimer' : 'Delete')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Curves */}
                    <div className="border border-gray-200 rounded p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700">{isFrench ? 'Courbes' : 'Curves'}</span>
                            <button
                                type="button"
                                onClick={addCurve}
                                className="text-xs text-indigo-700 hover:text-indigo-800"
                            >
                                {isFrench ? '+ Ajouter une courbe' : '+ Add curve'}
                            </button>
                        </div>
                        {payload.curves.length === 0 && (
                            <div className="text-[11px] text-gray-500">{isFrench ? 'Aucune courbe' : 'No curves yet'}</div>
                        )}
                        {payload.curves.map((curve) => (
                            <div key={curve.id} className="border border-gray-100 rounded p-2 space-y-2 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                    <label className="text-[11px] text-gray-500">{isFrench ? 'Début' : 'Start'}</label>
                                    {renderAnchorEditor(curve.start, (next) => updateCurve(curve.id, { start: next }))}
                                    <label className="text-[11px] text-gray-500">{isFrench ? 'Fin' : 'End'}</label>
                                    {renderAnchorEditor(curve.end, (next) => updateCurve(curve.id, { end: next }))}
                                    <label className="text-[11px] text-gray-500">{isFrench ? 'Courbure' : 'Curvature'}</label>
                                    <input
                                        type="number"
                                        value={curve.curvature ?? 0}
                                        onChange={(e) => updateCurve(curve.id, { curvature: Number(e.target.value) })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                                    />
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <label className="flex items-center gap-1 text-[11px] text-gray-600" title={isFrench ? 'Afficher le label' : 'Show label'}>
                                        <input
                                            type="checkbox"
                                            checked={curve.showLabel !== false}
                                            onChange={(e) => updateCurve(curve.id, { showLabel: e.target.checked })}
                                        />
                                    </label>
                                    <input
                                        type="text"
                                        value={curve.label || ''}
                                        onChange={(e) => updateCurve(curve.id, { label: e.target.value })}
                                        placeholder={isFrench ? 'Label' : 'Label'}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-16"
                                    />
                                    <label className="flex items-center gap-1 text-[11px] text-gray-600" title="LaTeX">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(curve.labelIsMath)}
                                            onChange={(e) => updateCurve(curve.id, { labelIsMath: e.target.checked })}
                                        />
                                        $
                                    </label>
                                    <input
                                        type="color"
                                        value={curve.style?.color || '#2563eb'}
                                        onChange={(e) => updateCurve(curve.id, { style: { ...curve.style, color: e.target.value } })}
                                    />
                                    <input
                                        type="number"
                                        value={curve.style?.width ?? 1.5}
                                        onChange={(e) => updateCurve(curve.id, { style: { ...curve.style, width: Number(e.target.value) } })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-14"
                                    />
                                    <label className="flex items-center gap-1 text-[11px] text-gray-600">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(curve.style?.dashed)}
                                            onChange={(e) => updateCurve(curve.id, { style: { ...curve.style, dashed: e.target.checked } })}
                                        />
                                        {isFrench ? 'Pointillé' : 'Dashed'}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteClick('curve', curve.id, () => removeCurve(curve.id))}
                                        className={`text-[11px] ${
                                            pendingDelete?.id === curve.id && pendingDelete.type === 'curve'
                                                ? 'text-red-800'
                                                : 'text-red-600'
                                        }`}
                                    >
                                        {pendingDelete?.id === curve.id && pendingDelete.type === 'curve'
                                            ? (isFrench ? 'Confirmer' : 'Confirm')
                                            : (isFrench ? 'Supprimer' : 'Delete')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Functions */}
                    <div className="border border-gray-200 rounded p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700">{isFrench ? 'Fonctions' : 'Functions'}</span>
                            <button
                                type="button"
                                onClick={addFunction}
                                className="text-xs text-indigo-700 hover:text-indigo-800"
                            >
                                {isFrench ? '+ Ajouter une fonction' : '+ Add function'}
                            </button>
                        </div>
                        {payload.functions.length === 0 && (
                            <div className="text-[11px] text-gray-500">{isFrench ? 'Aucune fonction' : 'No functions yet'}</div>
                        )}
                        {payload.functions.map((fn) => (
                            <div key={fn.id} className="border border-gray-100 rounded p-2 space-y-2 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                    <input
                                        type="text"
                                        value={fn.expression}
                                        onChange={(e) => updateFunction(fn.id, { expression: e.target.value })}
                                        placeholder={isFrench ? 'Ex: sin(x)' : 'Ex: sin(x)'}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs flex-1"
                                    />
                                    <input
                                        type="color"
                                        value={fn.style?.color || '#7c3aed'}
                                        onChange={(e) => updateFunction(fn.id, { style: { ...fn.style, color: e.target.value } })}
                                    />
                                    <input
                                        type="number"
                                        value={fn.style?.width ?? 1.5}
                                        onChange={(e) => updateFunction(fn.id, { style: { ...fn.style, width: Number(e.target.value) } })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-14"
                                    />
                                    <label className="flex items-center gap-1 text-[11px] text-gray-600">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(fn.style?.dashed)}
                                            onChange={(e) => updateFunction(fn.id, { style: { ...fn.style, dashed: e.target.checked } })}
                                        />
                                        {isFrench ? 'Pointillé' : 'Dashed'}
                                    </label>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <label className="flex items-center gap-1 text-[11px] text-gray-600" title={isFrench ? 'Afficher le label' : 'Show label'}>
                                        <input
                                            type="checkbox"
                                            checked={fn.showLabel !== false}
                                            onChange={(e) => updateFunction(fn.id, { showLabel: e.target.checked })}
                                        />
                                    </label>
                                    <input
                                        type="text"
                                        value={fn.label || ''}
                                        onChange={(e) => updateFunction(fn.id, { label: e.target.value })}
                                        placeholder={isFrench ? 'Label' : 'Label'}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-16"
                                    />
                                    <label className="flex items-center gap-1 text-[11px] text-gray-600" title="LaTeX">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(fn.labelIsMath)}
                                            onChange={(e) => updateFunction(fn.id, { labelIsMath: e.target.checked })}
                                        />
                                        $
                                    </label>
                                    <label className="text-[11px] text-gray-500">{isFrench ? 'Domaine' : 'Domain'}</label>
                                    <input
                                        type="number"
                                        value={fn.domain?.min ?? payload.axes.xMin}
                                        onChange={(e) => updateFunction(fn.id, { domain: { ...fn.domain, min: Number(e.target.value) } })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                                    />
                                    <input
                                        type="number"
                                        value={fn.domain?.max ?? payload.axes.xMax}
                                        onChange={(e) => updateFunction(fn.id, { domain: { ...fn.domain, max: Number(e.target.value) } })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteClick('function', fn.id, () => removeFunction(fn.id))}
                                        className={`text-[11px] ${
                                            pendingDelete?.id === fn.id && pendingDelete.type === 'function'
                                                ? 'text-red-800'
                                                : 'text-red-600'
                                        }`}
                                    >
                                        {pendingDelete?.id === fn.id && pendingDelete.type === 'function'
                                            ? (isFrench ? 'Confirmer' : 'Confirm')
                                            : (isFrench ? 'Supprimer' : 'Delete')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Areas */}
                    <div className="border border-gray-200 rounded p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700">{isFrench ? 'Surfaces' : 'Areas'}</span>
                            <button
                                type="button"
                                onClick={addArea}
                                className="text-xs text-indigo-700 hover:text-indigo-800"
                            >
                                {isFrench ? '+ Ajouter une surface' : '+ Add area'}
                            </button>
                        </div>
                        {payload.areas.length === 0 && (
                            <div className="text-[11px] text-gray-500">{isFrench ? 'Aucune surface' : 'No areas yet'}</div>
                        )}
                        {payload.areas.map((area) => (
                            <div key={area.id} className="border border-gray-100 rounded p-2 space-y-2 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                    <select
                                        value={area.mode}
                                        onChange={(e) => updateArea(area.id, { mode: e.target.value as GraphPayload['areas'][0]['mode'] })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                                    >
                                        <option value="polygon">{isFrench ? 'Polygone' : 'Polygon'}</option>
                                        <option value="under-function">{isFrench ? 'Sous fonction' : 'Under function'}</option>
                                        <option value="between-functions">{isFrench ? 'Entre fonctions' : 'Between functions'}</option>
                                        <option value="between-line-and-function">{isFrench ? 'Entre ligne et fonction' : 'Between line and function'}</option>
                                    </select>
                                    <label className="flex items-center gap-1 text-[11px] text-gray-600" title={isFrench ? 'Afficher le label' : 'Show label'}>
                                        <input
                                            type="checkbox"
                                            checked={area.showLabel !== false}
                                            onChange={(e) => updateArea(area.id, { showLabel: e.target.checked })}
                                        />
                                    </label>
                                    <input
                                        type="text"
                                        value={area.label || ''}
                                        onChange={(e) => updateArea(area.id, { label: e.target.value })}
                                        placeholder={isFrench ? 'Label' : 'Label'}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-16"
                                    />
                                    <label className="flex items-center gap-1 text-[11px] text-gray-600" title="LaTeX">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(area.labelIsMath)}
                                            onChange={(e) => updateArea(area.id, { labelIsMath: e.target.checked })}
                                        />
                                        $
                                    </label>
                                    <input
                                        type="color"
                                        value={area.fill?.color || '#6366f1'}
                                        onChange={(e) => updateArea(area.id, { fill: { ...area.fill, color: e.target.value } })}
                                    />
                                    <input
                                        type="number"
                                        value={area.fill?.opacity ?? 0.2}
                                        onChange={(e) => updateArea(area.id, { fill: { ...area.fill, opacity: Number(e.target.value) } })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-14"
                                        step="0.1"
                                        title={isFrench ? 'Opacité' : 'Opacity'}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteClick('area', area.id, () => removeArea(area.id))}
                                        className={`text-[11px] ${
                                            pendingDelete?.id === area.id && pendingDelete.type === 'area'
                                                ? 'text-red-800'
                                                : 'text-red-600'
                                        }`}
                                    >
                                        {pendingDelete?.id === area.id && pendingDelete.type === 'area'
                                            ? (isFrench ? 'Confirmer' : 'Confirm')
                                            : (isFrench ? 'Supprimer' : 'Delete')}
                                    </button>
                                </div>
                                {area.mode === 'polygon' && (
                                    <div className="space-y-2">
                                        {(area.points || []).map((point, index) => (
                                            <div key={`${area.id}-point-${index}`} className="flex items-center gap-2">
                                                <span className="text-[11px] text-gray-500">P{index + 1}</span>
                                                {renderAnchorEditor(point, (next) => {
                                                    const nextPoints = [...(area.points || [])]
                                                    nextPoints[index] = next
                                                    updateArea(area.id, { points: nextPoints })
                                                })}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const nextPoints = (area.points || []).filter((_, i) => i !== index)
                                                        updateArea(area.id, { points: nextPoints })
                                                    }}
                                                    className="text-[11px] text-red-600"
                                                >
                                                    {isFrench ? 'Retirer' : 'Remove'}
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => updateArea(area.id, { points: [...(area.points || []), { type: 'coord', x: 0, y: 0 }] })}
                                            className="text-[11px] text-indigo-700"
                                        >
                                            {isFrench ? '+ Ajouter un point' : '+ Add point'}
                                        </button>
                                    </div>
                                )}
                                {(area.mode === 'under-function' || area.mode === 'between-functions') && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <select
                                            value={area.functionId || ''}
                                            onChange={(e) => updateArea(area.id, { functionId: e.target.value })}
                                            className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                                        >
                                            <option value="">{isFrench ? 'Fonction' : 'Function'}</option>
                                            {payload.functions.map((fn) => (
                                                <option key={fn.id} value={fn.id}>
                                                    {fn.expression || fn.id.slice(0, 4)}
                                                </option>
                                            ))}
                                        </select>
                                        {area.mode === 'between-functions' && (
                                            <select
                                                value={area.functionId2 || ''}
                                                onChange={(e) => updateArea(area.id, { functionId2: e.target.value })}
                                                className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                                            >
                                                <option value="">{isFrench ? 'Fonction 2' : 'Function 2'}</option>
                                                {payload.functions.map((fn) => (
                                                    <option key={fn.id} value={fn.id}>
                                                        {fn.expression || fn.id.slice(0, 4)}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                        <input
                                            type="number"
                                            value={area.domain?.min ?? payload.axes.xMin}
                                            onChange={(e) => updateArea(area.id, { domain: { ...area.domain, min: Number(e.target.value) } })}
                                            className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                                        />
                                        <input
                                            type="number"
                                            value={area.domain?.max ?? payload.axes.xMax}
                                            onChange={(e) => updateArea(area.id, { domain: { ...area.domain, max: Number(e.target.value) } })}
                                            className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                                        />
                                    </div>
                                )}
                                {area.mode === 'between-line-and-function' && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <select
                                            value={area.lineId || ''}
                                            onChange={(e) => updateArea(area.id, { lineId: e.target.value })}
                                            className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                                        >
                                            <option value="">{isFrench ? 'Ligne' : 'Line'}</option>
                                            {payload.lines.map((line) => (
                                                <option key={line.id} value={line.id}>
                                                    {line.label || `${line.kind} ${line.id.slice(0, 4)}`}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            value={area.functionId || ''}
                                            onChange={(e) => updateArea(area.id, { functionId: e.target.value })}
                                            className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                                        >
                                            <option value="">{isFrench ? 'Fonction' : 'Function'}</option>
                                            {payload.functions.map((fn) => (
                                                <option key={fn.id} value={fn.id}>
                                                    {fn.expression || fn.id.slice(0, 4)}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            value={area.domain?.min ?? payload.axes.xMin}
                                            onChange={(e) => updateArea(area.id, { domain: { ...area.domain, min: Number(e.target.value) } })}
                                            className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                                            title={isFrench ? 'x min' : 'x min'}
                                        />
                                        <input
                                            type="number"
                                            value={area.domain?.max ?? payload.axes.xMax}
                                            onChange={(e) => updateArea(area.id, { domain: { ...area.domain, max: Number(e.target.value) } })}
                                            className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                                            title={isFrench ? 'x max' : 'x max'}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Texts */}
                    <div className="border border-gray-200 rounded p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700">{isFrench ? 'Textes' : 'Texts'}</span>
                            <button
                                type="button"
                                onClick={addText}
                                className="text-xs text-indigo-700 hover:text-indigo-800"
                            >
                                {isFrench ? '+ Ajouter un texte' : '+ Add text'}
                            </button>
                        </div>
                        {payload.texts.length === 0 && (
                            <div className="text-[11px] text-gray-500">{isFrench ? 'Aucun texte' : 'No texts yet'}</div>
                        )}
                        {payload.texts.map((text) => (
                            <div key={text.id} className="flex flex-wrap items-center gap-2 text-xs">
                                <input
                                    type="text"
                                    value={text.text}
                                    onChange={(e) => updateText(text.id, { text: e.target.value })}
                                    className="border border-gray-200 rounded px-1 py-0.5 text-xs w-40"
                                />
                                <input
                                    type="number"
                                    value={text.x}
                                    onChange={(e) => updateText(text.id, { x: Number(e.target.value) })}
                                    className="border border-gray-200 rounded px-1 py-0.5 text-xs w-16"
                                />
                                <input
                                    type="number"
                                    value={text.y}
                                    onChange={(e) => updateText(text.id, { y: Number(e.target.value) })}
                                    className="border border-gray-200 rounded px-1 py-0.5 text-xs w-16"
                                />
                                <label className="flex items-center gap-1 text-[11px] text-gray-600">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(text.isMath)}
                                        onChange={(e) => updateText(text.id, { isMath: e.target.checked })}
                                    />
                                    {isFrench ? 'Formule' : 'Math'}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteClick('text', text.id, () => removeText(text.id))}
                                    className={`text-[11px] ${
                                        pendingDelete?.id === text.id && pendingDelete.type === 'text'
                                            ? 'text-red-800'
                                            : 'text-red-600'
                                    }`}
                                >
                                    {pendingDelete?.id === text.id && pendingDelete.type === 'text'
                                        ? (isFrench ? 'Confirmer' : 'Confirm')
                                        : (isFrench ? 'Supprimer' : 'Delete')}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Preview Panel */}
                <div className="w-72">
                    <div className="text-[11px] text-gray-500 mb-1">
                        {isFrench ? 'Aperçu' : 'Preview'}
                    </div>
                    <div ref={previewRef} className="border border-gray-200 rounded p-2 bg-white" />
                    <div className="mt-2 text-[11px] text-gray-500">
                        {isFrench
                            ? 'Expressions acceptées : sin(x), cos(x), x^2, pi, e'
                            : 'Accepted expressions: sin(x), cos(x), x^2, pi, e'}
                    </div>
                </div>
            </div>
        </div>
    )
}
