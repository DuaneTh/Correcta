'use client'

import React, { useCallback } from 'react'
import { Circle, Text as KonvaText, Group } from 'react-konva'
import { GraphPoint, GraphAxes } from '@/types/exams'
import { graphToPixel, pixelToGraph, snapToGrid } from '../../coordinate-utils'

interface EditablePointProps {
    point: GraphPoint
    axes: GraphAxes
    width: number
    height: number
    isSelected: boolean
    onUpdate: (point: GraphPoint) => void
}

/**
 * Draggable point on Konva canvas.
 * Snaps to grid when enabled.
 */
export const EditablePoint = React.memo<EditablePointProps>(({
    point,
    axes,
    width,
    height,
    isSelected,
    onUpdate,
}) => {
    const pixel = graphToPixel({ x: point.x, y: point.y }, axes, width, height)
    const radius = Math.max(2, point.size ?? 4)
    const color = point.color || '#111827'
    const filled = point.filled !== false

    const handleDragEnd = useCallback((e: any) => {
        const newPixel = { x: e.target.x(), y: e.target.y() }
        let graphCoord = pixelToGraph(newPixel, axes, width, height)

        // Apply grid snapping if grid is enabled
        if (axes.showGrid) {
            const gridStep = axes.xStep ?? axes.gridStep ?? 1
            graphCoord = {
                x: snapToGrid(graphCoord.x, gridStep),
                y: snapToGrid(graphCoord.y, gridStep),
            }
        }

        onUpdate({
            ...point,
            x: graphCoord.x,
            y: graphCoord.y,
        })
    }, [point, axes, width, height, onUpdate])

    return (
        <Group
            x={pixel.x}
            y={pixel.y}
            draggable
            onDragEnd={handleDragEnd}
        >
            <Circle
                radius={radius}
                stroke={color}
                strokeWidth={1.5}
                fill={filled ? color : 'white'}
            />
            {point.showLabel && point.label && (
                <KonvaText
                    x={8}
                    y={-8}
                    text={point.label}
                    fontSize={point.labelSize ?? 12}
                    fill="#111827"
                    listening={false}
                />
            )}
        </Group>
    )
})

EditablePoint.displayName = 'EditablePoint'
