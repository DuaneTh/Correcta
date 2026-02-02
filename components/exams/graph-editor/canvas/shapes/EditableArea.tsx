'use client'

import React from 'react'
import { Line } from 'react-konva'
import { GraphArea, GraphAxes, GraphAnchor, GraphFunction } from '@/types/exams'
import { graphToPixel } from '../../coordinate-utils'
import { sampleFunction } from '@/components/exams/graph-utils'

interface EditableAreaProps {
    area: GraphArea
    functions: GraphFunction[]
    axes: GraphAxes
    width: number
    height: number
    isSelected: boolean
    onUpdate: (area: GraphArea) => void
}

/**
 * Filled polygon area rendered as closed Konva Line.
 * Supports polygon, under-function, and between-functions modes.
 */
export const EditableArea = React.memo<EditableAreaProps>(({
    area,
    functions,
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

    let outline: { x: number; y: number }[] = []

    if (area.mode === 'polygon') {
        outline = (area.points || []).map((anchor) => getAnchorCoord(anchor))
    } else if (area.mode === 'under-function' && area.functionId) {
        const func = functions.find((f) => f.id === area.functionId)
        if (!func) return null

        const samples = sampleFunction(func, axes)
        if (samples.length === 0) return null

        const minX = typeof area.domain?.min === 'number' ? area.domain.min : samples[0].x
        const maxX = typeof area.domain?.max === 'number' ? area.domain.max : samples[samples.length - 1].x
        const filtered = samples.filter((pt) => pt.x >= minX && pt.x <= maxX)

        if (filtered.length === 0) return null

        const baseY = 0
        outline = [
            { x: filtered[0].x, y: baseY },
            ...filtered,
            { x: filtered[filtered.length - 1].x, y: baseY },
        ]
    } else if (area.mode === 'between-functions' && area.functionId && area.functionId2) {
        const func1 = functions.find((f) => f.id === area.functionId)
        const func2 = functions.find((f) => f.id === area.functionId2)
        if (!func1 || !func2) return null

        const samples1 = sampleFunction(func1, axes)
        const samples2 = sampleFunction(func2, axes)
        if (samples1.length === 0 || samples2.length === 0) return null

        const minX = typeof area.domain?.min === 'number' ? area.domain.min : Math.max(samples1[0].x, samples2[0].x)
        const maxX = typeof area.domain?.max === 'number' ? area.domain.max : Math.min(samples1[samples1.length - 1].x, samples2[samples2.length - 1].x)

        const filtered1 = samples1.filter((pt) => pt.x >= minX && pt.x <= maxX)
        const filtered2 = samples2.filter((pt) => pt.x >= minX && pt.x <= maxX).reverse()

        if (filtered1.length === 0 || filtered2.length === 0) return null

        outline = [...filtered1, ...filtered2]
    }

    if (outline.length < 3) return null

    // Convert to pixel coordinates
    const points: number[] = []
    outline.forEach((coord) => {
        const pixel = graphToPixel(coord, axes, width, height)
        points.push(pixel.x, pixel.y)
    })

    const fillColor = area.fill?.color || '#6366f1'
    const fillOpacity = typeof area.fill?.opacity === 'number' ? area.fill.opacity : 0.18

    return (
        <Line
            points={points}
            closed
            fill={fillColor}
            opacity={fillOpacity}
            listening={false}
        />
    )
})

EditableArea.displayName = 'EditableArea'
