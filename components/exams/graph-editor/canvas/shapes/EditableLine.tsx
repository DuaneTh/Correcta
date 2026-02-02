'use client'

import React, { useCallback } from 'react'
import { Line, Circle, Group } from 'react-konva'
import { GraphLine, GraphAxes, GraphAnchor } from '@/types/exams'
import { graphToPixel, pixelToGraph, snapToGrid } from '../../coordinate-utils'

interface EditableLineProps {
    line: GraphLine
    axes: GraphAxes
    width: number
    height: number
    isSelected: boolean
    onUpdate: (line: GraphLine) => void
}

/**
 * Draggable line with moveable endpoints for coordinate anchors.
 * Supports line, ray, and segment kinds.
 */
export const EditableLine = React.memo<EditableLineProps>(({
    line,
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
        // For point anchors, we'd need to resolve from payload
        // For simplicity in V1, assume coord anchors
        return { x: 0, y: 0 }
    }

    const startCoord = getAnchorCoord(line.start)
    const endCoord = getAnchorCoord(line.end)

    const startPixel = graphToPixel(startCoord, axes, width, height)
    const endPixel = graphToPixel(endCoord, axes, width, height)

    // For infinite lines/rays, extend to canvas boundaries
    let renderStart = startPixel
    let renderEnd = endPixel

    if (line.kind === 'line') {
        // Extend both directions
        const dx = endPixel.x - startPixel.x
        const dy = endPixel.y - startPixel.y
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const scale = Math.max(width, height) * 2
        renderStart = { x: startPixel.x - (dx / len) * scale, y: startPixel.y - (dy / len) * scale }
        renderEnd = { x: endPixel.x + (dx / len) * scale, y: endPixel.y + (dy / len) * scale }
    } else if (line.kind === 'ray') {
        // Extend from start through end
        const dx = endPixel.x - startPixel.x
        const dy = endPixel.y - startPixel.y
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const scale = Math.max(width, height) * 2
        renderEnd = { x: startPixel.x + (dx / len) * scale, y: startPixel.y + (dy / len) * scale }
    }

    const handleStartDragEnd = useCallback((e: any) => {
        if (line.start.type !== 'coord') return

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
            ...line,
            start: { type: 'coord', x: graphCoord.x, y: graphCoord.y },
        })
    }, [line, axes, width, height, onUpdate])

    const handleEndDragEnd = useCallback((e: any) => {
        if (line.end.type !== 'coord') return

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
            ...line,
            end: { type: 'coord', x: graphCoord.x, y: graphCoord.y },
        })
    }, [line, axes, width, height, onUpdate])

    const color = line.style?.color || '#111827'
    const strokeWidth = line.style?.width ?? 1.5
    const dashed = line.style?.dashed ?? false

    return (
        <Group>
            <Line
                points={[renderStart.x, renderStart.y, renderEnd.x, renderEnd.y]}
                stroke={color}
                strokeWidth={strokeWidth}
                dash={dashed ? [6, 4] : undefined}
                opacity={line.style?.opacity ?? 1}
                listening={false}
            />
            {/* Start handle (only for coord anchors) */}
            {line.start.type === 'coord' && (
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
            {/* End handle (only for coord anchors) */}
            {line.end.type === 'coord' && (
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
        </Group>
    )
})

EditableLine.displayName = 'EditableLine'
