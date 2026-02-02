'use client'

import React, { useCallback } from 'react'
import { Text as KonvaText } from 'react-konva'
import { GraphText, GraphAxes } from '@/types/exams'
import { graphToPixel, pixelToGraph, snapToGrid } from '../../coordinate-utils'

interface EditableTextProps {
    text: GraphText
    axes: GraphAxes
    width: number
    height: number
    isSelected: boolean
    onUpdate: (text: GraphText) => void
}

/**
 * Draggable text label on Konva canvas.
 */
export const EditableText = React.memo<EditableTextProps>(({
    text,
    axes,
    width,
    height,
    isSelected,
    onUpdate,
}) => {
    const pixel = graphToPixel({ x: text.x, y: text.y }, axes, width, height)

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
            ...text,
            x: graphCoord.x,
            y: graphCoord.y,
        })
    }, [text, axes, width, height, onUpdate])

    return (
        <KonvaText
            x={pixel.x}
            y={pixel.y}
            text={text.text}
            fontSize={12}
            fill="#111827"
            offsetX={0}
            offsetY={6}
            draggable
            onDragEnd={handleDragEnd}
        />
    )
})

EditableText.displayName = 'EditableText'
