'use client'

import React, { useCallback, useRef } from 'react'
import { Stage, Layer, Rect } from 'react-konva'
import { GraphPayload } from '../types'
import { CanvasGrid } from './CanvasGrid'
import { CanvasAxes } from './CanvasAxes'
import {
    EditableArea,
    EditableFunction,
    EditableLine,
    EditableCurve,
    EditablePoint,
    EditableText,
} from './shapes'

interface GraphCanvasProps {
    graph: GraphPayload
    width: number
    height: number
    onUpdate: (graph: GraphPayload) => void
    selectedId?: string | null
    onSelect?: (id: string | null) => void
}

/**
 * Main Konva Stage that renders all graph elements.
 * Renders elements in back-to-front order: background, grid, axes, areas, functions, lines, curves, points, texts.
 */
export const GraphCanvas = React.memo<GraphCanvasProps>(({
    graph,
    width,
    height,
    onUpdate,
    selectedId,
    onSelect,
}) => {
    // Use refs to avoid stale closure issues
    const graphRef = useRef(graph)
    const onUpdateRef = useRef(onUpdate)
    graphRef.current = graph
    onUpdateRef.current = onUpdate

    const handleBackgroundClick = () => {
        if (onSelect) {
            onSelect(null)
        }
    }

    // Update handlers using refs to always get latest graph
    const handleAreaUpdate = useCallback((updatedArea: typeof graph.areas[0]) => {
        const currentGraph = graphRef.current
        onUpdateRef.current({
            ...currentGraph,
            areas: currentGraph.areas.map((a) => (a.id === updatedArea.id ? updatedArea : a)),
        })
    }, [])

    const handleFunctionUpdate = useCallback((updatedFunc: typeof graph.functions[0]) => {
        const currentGraph = graphRef.current
        onUpdateRef.current({
            ...currentGraph,
            functions: currentGraph.functions.map((f) => (f.id === updatedFunc.id ? updatedFunc : f)),
        })
    }, [])

    const handleLineUpdate = useCallback((updatedLine: typeof graph.lines[0]) => {
        const currentGraph = graphRef.current
        onUpdateRef.current({
            ...currentGraph,
            lines: currentGraph.lines.map((l) => (l.id === updatedLine.id ? updatedLine : l)),
        })
    }, [])

    const handleCurveUpdate = useCallback((updatedCurve: typeof graph.curves[0]) => {
        const currentGraph = graphRef.current
        onUpdateRef.current({
            ...currentGraph,
            curves: currentGraph.curves.map((c) => (c.id === updatedCurve.id ? updatedCurve : c)),
        })
    }, [])

    const handlePointUpdate = useCallback((updatedPoint: typeof graph.points[0]) => {
        const currentGraph = graphRef.current
        onUpdateRef.current({
            ...currentGraph,
            points: currentGraph.points.map((p) => (p.id === updatedPoint.id ? updatedPoint : p)),
        })
    }, [])

    const handleTextUpdate = useCallback((updatedText: typeof graph.texts[0]) => {
        const currentGraph = graphRef.current
        onUpdateRef.current({
            ...currentGraph,
            texts: currentGraph.texts.map((t) => (t.id === updatedText.id ? updatedText : t)),
        })
    }, [])

    return (
        <Stage width={width} height={height}>
            <Layer>
                {/* Background */}
                <Rect
                    x={0}
                    y={0}
                    width={width}
                    height={height}
                    fill={graph.background || 'white'}
                    onClick={handleBackgroundClick}
                    onTap={handleBackgroundClick}
                />

                {/* Grid */}
                <CanvasGrid axes={graph.axes} width={width} height={height} />

                {/* Axes */}
                <CanvasAxes axes={graph.axes} width={width} height={height} />

                {/* Areas (back layer) */}
                {graph.areas.map((area) => (
                    <EditableArea
                        key={area.id}
                        area={area}
                        functions={graph.functions}
                        lines={graph.lines}
                        axes={graph.axes}
                        width={width}
                        height={height}
                        isSelected={selectedId === area.id}
                        onUpdate={handleAreaUpdate}
                        onSelect={onSelect}
                    />
                ))}

                {/* Functions */}
                {graph.functions.map((func) => (
                    <EditableFunction
                        key={func.id}
                        func={func}
                        axes={graph.axes}
                        width={width}
                        height={height}
                        isSelected={selectedId === func.id}
                        onUpdate={handleFunctionUpdate}
                        onSelect={onSelect}
                    />
                ))}

                {/* Lines */}
                {graph.lines.map((line) => (
                    <EditableLine
                        key={line.id}
                        line={line}
                        axes={graph.axes}
                        width={width}
                        height={height}
                        isSelected={selectedId === line.id}
                        onUpdate={handleLineUpdate}
                        onSelect={onSelect}
                        lines={graph.lines}
                        curves={graph.curves}
                        functions={graph.functions}
                    />
                ))}

                {/* Curves */}
                {graph.curves.map((curve) => (
                    <EditableCurve
                        key={curve.id}
                        curve={curve}
                        axes={graph.axes}
                        width={width}
                        height={height}
                        isSelected={selectedId === curve.id}
                        onUpdate={handleCurveUpdate}
                        onSelect={onSelect}
                    />
                ))}

                {/* Points */}
                {graph.points.map((point) => (
                    <EditablePoint
                        key={point.id}
                        point={point}
                        axes={graph.axes}
                        width={width}
                        height={height}
                        isSelected={selectedId === point.id}
                        onUpdate={handlePointUpdate}
                        onSelect={onSelect}
                        lines={graph.lines}
                        curves={graph.curves}
                        functions={graph.functions}
                    />
                ))}

                {/* Texts (front layer) */}
                {graph.texts.map((text) => (
                    <EditableText
                        key={text.id}
                        text={text}
                        axes={graph.axes}
                        width={width}
                        height={height}
                        isSelected={selectedId === text.id}
                        onUpdate={handleTextUpdate}
                        onSelect={onSelect}
                    />
                ))}

                {/* Area boundary buttons overlay (rendered last so they appear above all shapes) */}
                {graph.areas.map((area) => (
                    <EditableArea
                        key={`${area.id}-overlay`}
                        area={area}
                        functions={graph.functions}
                        lines={graph.lines}
                        axes={graph.axes}
                        width={width}
                        height={height}
                        isSelected={selectedId === area.id}
                        onUpdate={handleAreaUpdate}
                        onSelect={onSelect}
                        renderOverlayOnly
                    />
                ))}
            </Layer>
        </Stage>
    )
})

GraphCanvas.displayName = 'GraphCanvas'
