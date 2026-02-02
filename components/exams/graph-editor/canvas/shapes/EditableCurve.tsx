'use client'

import React, { useCallback } from 'react'
import { Line, Circle, Group } from 'react-konva'
import { GraphCurve, GraphAxes, GraphAnchor } from '@/types/exams'
import { graphToPixel, pixelToGraph, snapToGrid } from '../../coordinate-utils'

interface EditableCurveProps {
    curve: GraphCurve
    axes: GraphAxes
    width: number
    height: number
    isSelected: boolean
    onUpdate: (curve: GraphCurve) => void
}

/**
 * Quadratic bezier curve rendered as Konva Line.
 * Draggable endpoints and control point for curvature adjustment.
 */
export const EditableCurve = React.memo<EditableCurveProps>(({
    curve,
    axes,
    width,
    height,
    isSelected,
    onUpdate,
}) => {
    const getAnchorCoord = (anchor: GraphAnchor): { x: number; y: number } => {
        if (anchor.type === 'coord') {
            return { x: anchor.x, y: anchor.y }
        }
        return { x: 0, y: 0 }
    }

    const startCoord = getAnchorCoord(curve.start)
    const endCoord = getAnchorCoord(curve.end)

    const startPixel = graphToPixel(startCoord, axes, width, height)
    const endPixel = graphToPixel(endCoord, axes, width, height)

    // Calculate control point position
    const midX = (startCoord.x + endCoord.x) / 2
    const midY = (startCoord.y + endCoord.y) / 2
    const dx = endCoord.x - startCoord.x
    const dy = endCoord.y - startCoord.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const normalX = -dy / len
    const normalY = dx / len
    const curvature = curve.curvature ?? 0
    const controlCoord = {
        x: midX + normalX * curvature,
        y: midY + normalY * curvature,
    }
    const controlPixel = graphToPixel(controlCoord, axes, width, height)

    // Sample the quadratic curve
    const samples = 50
    const points: number[] = []
    for (let i = 0; i <= samples; i++) {
        const t = i / samples
        const u = 1 - t
        const x = u * u * startPixel.x + 2 * u * t * controlPixel.x + t * t * endPixel.x
        const y = u * u * startPixel.y + 2 * u * t * controlPixel.y + t * t * endPixel.y
        points.push(x, y)
    }

    const handleStartDragEnd = useCallback((e: any) => {
        if (curve.start.type !== 'coord') return

        const newPixel = { x: e.target.x(), y: e.target.y() }
        let graphCoord = pixelToGraph(newPixel, axes, width, height)

        if (axes.showGrid) {
            const gridStep = axes.xStep ?? axes.gridStep ?? 1
            graphCoord = {
                x: snapToGrid(graphCoord.x, gridStep),
                y: snapToGrid(graphCoord.y, gridStep),
            }
        }

        onUpdate({
            ...curve,
            start: { type: 'coord', x: graphCoord.x, y: graphCoord.y },
        })
    }, [curve, axes, width, height, onUpdate])

    const handleEndDragEnd = useCallback((e: any) => {
        if (curve.end.type !== 'coord') return

        const newPixel = { x: e.target.x(), y: e.target.y() }
        let graphCoord = pixelToGraph(newPixel, axes, width, height)

        if (axes.showGrid) {
            const gridStep = axes.xStep ?? axes.gridStep ?? 1
            graphCoord = {
                x: snapToGrid(graphCoord.x, gridStep),
                y: snapToGrid(graphCoord.y, gridStep),
            }
        }

        onUpdate({
            ...curve,
            end: { type: 'coord', x: graphCoord.x, y: graphCoord.y },
        })
    }, [curve, axes, width, height, onUpdate])

    const handleControlDragEnd = useCallback((e: any) => {
        const newPixel = { x: e.target.x(), y: e.target.y() }
        const newGraphCoord = pixelToGraph(newPixel, axes, width, height)

        // Calculate new curvature from control point position
        const midX = (startCoord.x + endCoord.x) / 2
        const midY = (startCoord.y + endCoord.y) / 2
        const dx = endCoord.x - startCoord.x
        const dy = endCoord.y - startCoord.y
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const normalX = -dy / len
        const normalY = dx / len

        // Project the control point onto the normal
        const offsetX = newGraphCoord.x - midX
        const offsetY = newGraphCoord.y - midY
        const newCurvature = offsetX * normalX + offsetY * normalY

        onUpdate({
            ...curve,
            curvature: newCurvature,
        })
    }, [curve, startCoord, endCoord, axes, width, height, onUpdate])

    const color = curve.style?.color || '#111827'
    const strokeWidth = curve.style?.width ?? 1.5
    const dashed = curve.style?.dashed ?? false

    return (
        <Group>
            <Line
                points={points}
                stroke={color}
                strokeWidth={strokeWidth}
                dash={dashed ? [6, 4] : undefined}
                opacity={curve.style?.opacity ?? 1}
                listening={false}
            />
            {/* Start handle */}
            {curve.start.type === 'coord' && (
                <Circle
                    x={startPixel.x}
                    y={startPixel.y}
                    radius={5}
                    fill={isSelected ? '#3b82f6' : color}
                    stroke="white"
                    strokeWidth={1}
                    draggable
                    onDragEnd={handleStartDragEnd}
                />
            )}
            {/* End handle */}
            {curve.end.type === 'coord' && (
                <Circle
                    x={endPixel.x}
                    y={endPixel.y}
                    radius={5}
                    fill={isSelected ? '#3b82f6' : color}
                    stroke="white"
                    strokeWidth={1}
                    draggable
                    onDragEnd={handleEndDragEnd}
                />
            )}
            {/* Control point handle */}
            {isSelected && (
                <Circle
                    x={controlPixel.x}
                    y={controlPixel.y}
                    radius={4}
                    fill="#10b981"
                    stroke="white"
                    strokeWidth={1}
                    draggable
                    onDragEnd={handleControlDragEnd}
                />
            )}
        </Group>
    )
})

EditableCurve.displayName = 'EditableCurve'
