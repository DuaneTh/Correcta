'use client'

import React from 'react'
import { Line, Layer } from 'react-konva'
import { GraphAxes } from '@/types/exams'
import { graphToPixel } from '../coordinate-utils'

interface CanvasGridProps {
    axes: GraphAxes
    width: number
    height: number
}

/**
 * Renders grid lines on the Konva canvas.
 * Only renders when axes.showGrid is true.
 */
export const CanvasGrid = React.memo<CanvasGridProps>(({ axes, width, height }) => {
    if (!axes.showGrid) return null

    const xStep = Math.max(0.1, axes.xStep ?? axes.gridStep ?? 1)
    const yStep = Math.max(0.1, axes.yStep ?? axes.gridStep ?? 1)

    const xStart = Math.ceil(axes.xMin / xStep) * xStep
    const xEnd = Math.floor(axes.xMax / xStep) * xStep
    const yStart = Math.ceil(axes.yMin / yStep) * yStep
    const yEnd = Math.floor(axes.yMax / yStep) * yStep

    const verticalLines: number[][] = []
    for (let x = xStart; x <= xEnd; x += xStep) {
        const pixel = graphToPixel({ x, y: axes.yMin }, axes, width, height)
        verticalLines.push([pixel.x, 0, pixel.x, height])
    }

    const horizontalLines: number[][] = []
    for (let y = yStart; y <= yEnd; y += yStep) {
        const pixel = graphToPixel({ x: axes.xMin, y }, axes, width, height)
        horizontalLines.push([0, pixel.y, width, pixel.y])
    }

    return (
        <>
            {verticalLines.map((points, index) => (
                <Line
                    key={`v-${index}`}
                    points={points}
                    stroke="#e5e7eb"
                    strokeWidth={0.5}
                    listening={false}
                />
            ))}
            {horizontalLines.map((points, index) => (
                <Line
                    key={`h-${index}`}
                    points={points}
                    stroke="#e5e7eb"
                    strokeWidth={0.5}
                    listening={false}
                />
            ))}
        </>
    )
})

CanvasGrid.displayName = 'CanvasGrid'
