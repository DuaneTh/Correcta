'use client'

import React from 'react'
import { Line } from 'react-konva'
import { GraphFunction, GraphAxes } from '@/types/exams'
import { graphToPixel } from '../../coordinate-utils'
import { sampleFunction } from '@/components/exams/graph-utils'

interface EditableFunctionProps {
    func: GraphFunction
    axes: GraphAxes
    width: number
    height: number
    isSelected: boolean
    onUpdate: (func: GraphFunction) => void
}

/**
 * Function curve rendered as Konva Line.
 * Samples expression at 200 points and renders the curve.
 */
export const EditableFunction = React.memo<EditableFunctionProps>(({
    func,
    axes,
    width,
    height,
    isSelected,
    onUpdate,
}) => {
    // Sample the function using existing graph-utils logic
    const samples = sampleFunction(func, axes)

    if (samples.length === 0) {
        return null
    }

    // Convert graph coordinates to pixel coordinates
    const points: number[] = []
    samples.forEach((coord) => {
        const pixel = graphToPixel(coord, axes, width, height)
        points.push(pixel.x, pixel.y)
    })

    const color = func.style?.color || '#111827'
    const strokeWidth = func.style?.width ?? 1.5
    const dashed = func.style?.dashed ?? false

    return (
        <Line
            points={points}
            stroke={color}
            strokeWidth={strokeWidth}
            dash={dashed ? [6, 4] : undefined}
            opacity={func.style?.opacity ?? 1}
            listening={false}
        />
    )
})

EditableFunction.displayName = 'EditableFunction'
