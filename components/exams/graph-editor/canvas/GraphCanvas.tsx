'use client'

import React from 'react'
import { Stage, Layer, Rect } from 'react-konva'
import { GraphPayload } from '../types'
import { CanvasGrid } from './CanvasGrid'
import { CanvasAxes } from './CanvasAxes'

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

                {/* TODO: Render areas, functions, lines, curves, points, texts (Task 2) */}
            </Layer>
        </Stage>
    )
})

GraphCanvas.displayName = 'GraphCanvas'
