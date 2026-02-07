'use client'

import React, { useCallback } from 'react'
import { Text as KonvaText, Group, Rect } from 'react-konva'
import { GraphText, GraphAxes } from '@/types/exams'
import { graphToPixel, pixelToGraph, snapToGrid } from '../../coordinate-utils'

interface EditableTextProps {
    text: GraphText
    axes: GraphAxes
    width: number
    height: number
    isSelected: boolean
    onUpdate: (text: GraphText) => void
    onSelect?: (id: string) => void
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
    onSelect,
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

    const handleClick = useCallback(() => {
        if (onSelect) {
            onSelect(text.id)
        }
    }, [text.id, onSelect])

    // Estimate text dimensions for selection highlight
    const textWidth = text.text.length * 7
    const textHeight = 14

    return (
        <Group
            x={pixel.x}
            y={pixel.y}
            draggable
            onDragEnd={handleDragEnd}
            onClick={handleClick}
            onTap={handleClick}
        >
            {/* Selection highlight */}
            {isSelected && (
                <Rect
                    x={-2}
                    y={-8}
                    width={textWidth + 4}
                    height={textHeight + 4}
                    stroke="#3b82f6"
                    strokeWidth={1}
                    fill="transparent"
                    cornerRadius={2}
                    listening={false}
                />
            )}
            <KonvaText
                text={text.text}
                fontSize={12}
                fill={isSelected ? '#3b82f6' : '#111827'}
                offsetX={0}
                offsetY={6}
            />
        </Group>
    )
})

EditableText.displayName = 'EditableText'
