'use client'

import React from 'react'
import { Line, Text as KonvaText } from 'react-konva'
import { GraphAxes } from '@/types/exams'
import { graphToPixel } from '../coordinate-utils'

interface CanvasAxesProps {
    axes: GraphAxes
    width: number
    height: number
}

/**
 * Renders X and Y axis lines, tick marks, and numeric labels.
 */
export const CanvasAxes = React.memo<CanvasAxesProps>(({ axes, width, height }) => {
    const xStep = Math.max(0.1, axes.xStep ?? axes.gridStep ?? 1)
    const yStep = Math.max(0.1, axes.yStep ?? axes.gridStep ?? 1)

    // Determine if axes pass through canvas
    const showXAxis = axes.yMin <= 0 && axes.yMax >= 0
    const showYAxis = axes.xMin <= 0 && axes.xMax >= 0

    const xAxisPixel = showXAxis ? graphToPixel({ x: 0, y: 0 }, axes, width, height) : null
    const yAxisPixel = showYAxis ? graphToPixel({ x: 0, y: 0 }, axes, width, height) : null

    // Generate tick positions
    const xTicks: { value: number; pixel: number }[] = []
    if (showXAxis && xAxisPixel) {
        const xStart = Math.ceil(axes.xMin / xStep) * xStep
        const xEnd = Math.floor(axes.xMax / xStep) * xStep
        for (let x = xStart; x <= xEnd; x += xStep) {
            if (Math.abs(x) < 1e-10) continue // Skip origin
            const pixel = graphToPixel({ x, y: 0 }, axes, width, height)
            xTicks.push({ value: x, pixel: pixel.x })
        }
    }

    const yTicks: { value: number; pixel: number }[] = []
    if (showYAxis && yAxisPixel) {
        const yStart = Math.ceil(axes.yMin / yStep) * yStep
        const yEnd = Math.floor(axes.yMax / yStep) * yStep
        for (let y = yStart; y <= yEnd; y += yStep) {
            if (Math.abs(y) < 1e-10) continue // Skip origin
            const pixel = graphToPixel({ x: 0, y }, axes, width, height)
            yTicks.push({ value: y, pixel: pixel.y })
        }
    }

    return (
        <>
            {/* Y-axis line */}
            {showYAxis && yAxisPixel && (
                <Line
                    points={[yAxisPixel.x, 0, yAxisPixel.x, height]}
                    stroke="#374151"
                    strokeWidth={1.5}
                    listening={false}
                />
            )}

            {/* X-axis line */}
            {showXAxis && xAxisPixel && (
                <Line
                    points={[0, xAxisPixel.y, width, xAxisPixel.y]}
                    stroke="#374151"
                    strokeWidth={1.5}
                    listening={false}
                />
            )}

            {/* X-axis tick marks and labels */}
            {showXAxis && xAxisPixel && xTicks.map((tick, index) => (
                <React.Fragment key={`x-tick-${index}`}>
                    <Line
                        points={[tick.pixel, xAxisPixel.y - 4, tick.pixel, xAxisPixel.y + 4]}
                        stroke="#374151"
                        strokeWidth={1.5}
                        listening={false}
                    />
                    <KonvaText
                        x={tick.pixel}
                        y={xAxisPixel.y + 6}
                        text={tick.value.toString()}
                        fontSize={10}
                        fill="#6b7280"
                        align="center"
                        offsetX={10}
                        listening={false}
                    />
                </React.Fragment>
            ))}

            {/* Y-axis tick marks and labels */}
            {showYAxis && yAxisPixel && yTicks.map((tick, index) => (
                <React.Fragment key={`y-tick-${index}`}>
                    <Line
                        points={[yAxisPixel.x - 4, tick.pixel, yAxisPixel.x + 4, tick.pixel]}
                        stroke="#374151"
                        strokeWidth={1.5}
                        listening={false}
                    />
                    <KonvaText
                        x={yAxisPixel.x - 6}
                        y={tick.pixel}
                        text={tick.value.toString()}
                        fontSize={10}
                        fill="#6b7280"
                        align="right"
                        offsetY={5}
                        listening={false}
                    />
                </React.Fragment>
            ))}
        </>
    )
})

CanvasAxes.displayName = 'CanvasAxes'
