'use client'

import React, { useCallback } from 'react'
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
    const handleBackgroundClick = () => {
        if (onSelect) {
            onSelect(null)
        }
    }

    // Update handlers for each element type
    const handleAreaUpdate = useCallback((updatedArea: typeof graph.areas[0]) => {
        onUpdate({
            ...graph,
            areas: graph.areas.map((a) => (a.id === updatedArea.id ? updatedArea : a)),
        })
    }, [graph, onUpdate])

    const handleFunctionUpdate = useCallback((updatedFunc: typeof graph.functions[0]) => {
        onUpdate({
            ...graph,
            functions: graph.functions.map((f) => (f.id === updatedFunc.id ? updatedFunc : f)),
        })
    }, [graph, onUpdate])

    const handleLineUpdate = useCallback((updatedLine: typeof graph.lines[0]) => {
        onUpdate({
            ...graph,
            lines: graph.lines.map((l) => (l.id === updatedLine.id ? updatedLine : l)),
        })
    }, [graph, onUpdate])

    const handleCurveUpdate = useCallback((updatedCurve: typeof graph.curves[0]) => {
        onUpdate({
            ...graph,
            curves: graph.curves.map((c) => (c.id === updatedCurve.id ? updatedCurve : c)),
        })
    }, [graph, onUpdate])

    const handlePointUpdate = useCallback((updatedPoint: typeof graph.points[0]) => {
        onUpdate({
            ...graph,
            points: graph.points.map((p) => (p.id === updatedPoint.id ? updatedPoint : p)),
        })
    }, [graph, onUpdate])

    const handleTextUpdate = useCallback((updatedText: typeof graph.texts[0]) => {
        onUpdate({
            ...graph,
            texts: graph.texts.map((t) => (t.id === updatedText.id ? updatedText : t)),
        })
    }, [graph, onUpdate])

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
                        axes={graph.axes}
                        width={width}
                        height={height}
                        isSelected={selectedId === area.id}
                        onUpdate={handleAreaUpdate}
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
                    />
                ))}
            </Layer>
        </Stage>
    )
})

GraphCanvas.displayName = 'GraphCanvas'
