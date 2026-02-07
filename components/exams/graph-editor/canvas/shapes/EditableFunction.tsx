'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { Line, Group, Circle } from 'react-konva'
import { GraphFunction, GraphAxes } from '@/types/exams'
import { graphToPixel, pixelToGraph, snapToGrid } from '../../coordinate-utils'
import { sampleFunction, compileExpression } from '@/components/exams/graph-utils'
import { CanvasLabel } from '../CanvasLabel'

interface EditableFunctionProps {
    func: GraphFunction
    axes: GraphAxes
    width: number
    height: number
    isSelected: boolean
    onUpdate: (func: GraphFunction) => void
    onSelect?: (id: string) => void
}

// Scale factor: how many graph units the control point moves per unit of scaleY
const SCALE_FACTOR = 2

// Convert raw linear scale to non-linear scaleY (for drag end)
const applyScaleMapping = (rawScaleY: number): number => {
    const sign = rawScaleY >= 0 ? 1 : -1
    return sign * Math.pow(Math.abs(rawScaleY), 1.5)
}

// Convert scaleY to linear position (for control point display)
const inverseScaleMapping = (scaleY: number): number => {
    const sign = scaleY >= 0 ? 1 : -1
    return sign * Math.pow(Math.abs(scaleY), 2 / 3)
}

/**
 * Function curve rendered as Konva Line.
 * Samples expression at N points and renders the curve.
 * Functions can be dragged to translate them (modifies offsetX/offsetY).
 * When selected, shows a scale control point to adjust the opening (scaleY).
 * Displays label at midpoint of visible domain when showLabel is true.
 */
export const EditableFunction = React.memo<EditableFunctionProps>(({
    func,
    axes,
    width,
    height,
    isSelected,
    onUpdate,
    onSelect,
}) => {
    // Track temporary scaleY during drag for real-time preview
    const [previewScaleY, setPreviewScaleY] = useState<number | null>(null)

    // Use preview scale if dragging, otherwise use actual scale
    const effectiveScaleY = previewScaleY !== null ? previewScaleY : (func.scaleY ?? 1)

    // Create a temporary function with the effective scaleY for sampling
    const effectiveFunc = useMemo(() => ({
        ...func,
        scaleY: effectiveScaleY,
    }), [func, effectiveScaleY])

    // Sample the function using existing graph-utils logic
    const samples = sampleFunction(effectiveFunc, axes)

    // Determine if label should be shown (default to true if label exists)
    const shouldShowLabel = func.showLabel !== false && Boolean(func.label)

    // Calculate label position at midpoint of visible domain (or custom position)
    const labelPixel = useMemo(() => {
        if (func.labelPos) {
            return graphToPixel(func.labelPos, axes, width, height)
        }
        // Default: midpoint of the domain
        const offsetX = func.offsetX ?? 0
        const offsetY = func.offsetY ?? 0
        const scaleY = effectiveScaleY
        const minX = typeof func.domain?.min === 'number' ? func.domain.min : axes.xMin
        const maxX = typeof func.domain?.max === 'number' ? func.domain.max : axes.xMax
        const midX = (minX + maxX) / 2

        const evaluator = compileExpression(func.expression)
        if (!evaluator) return { x: 0, y: 0 }

        const y = scaleY * evaluator(midX - offsetX) + offsetY
        if (!Number.isFinite(y)) return { x: 0, y: 0 }

        return graphToPixel({ x: midX, y }, axes, width, height)
    }, [func.labelPos, func.expression, func.domain, func.offsetX, func.offsetY, effectiveScaleY, axes, width, height])

    const handleClick = useCallback(() => {
        if (onSelect) {
            onSelect(func.id)
        }
    }, [func.id, onSelect])

    const handleDragEnd = useCallback((e: any) => {
        const group = e.target
        const deltaXPixels = group.x()
        const deltaYPixels = group.y()

        // Reset group position (visual feedback is handled by Konva during drag)
        group.x(0)
        group.y(0)

        // Convert pixel delta to graph units
        const graphDeltaX = deltaXPixels * (axes.xMax - axes.xMin) / width
        // Y is inverted: positive pixel delta (down) = negative graph delta
        const graphDeltaY = -deltaYPixels * (axes.yMax - axes.yMin) / height

        // Update the function's offset
        const currentOffsetX = func.offsetX ?? 0
        const currentOffsetY = func.offsetY ?? 0

        let newOffsetX = currentOffsetX + graphDeltaX
        let newOffsetY = currentOffsetY + graphDeltaY

        // Snap to grid if Shift is held
        const shiftHeld = e.evt?.shiftKey ?? false
        if (shiftHeld) {
            newOffsetX = snapToGrid(newOffsetX, 1)
            newOffsetY = snapToGrid(newOffsetY, 1)
        }

        onUpdate({
            ...func,
            offsetX: newOffsetX,
            offsetY: newOffsetY,
        })
    }, [func, axes, width, height, onUpdate])

    // Calculate scale control point position
    // Place it centered above the vertex (at x = offsetX)
    const scaleControlPoint = useMemo(() => {
        const offsetX = func.offsetX ?? 0
        const offsetY = func.offsetY ?? 0

        // Control point centered at x = offsetX (directly above/below the vertex)
        const controlX = offsetX

        // Use effective scaleY for position (includes preview during drag)
        const linearScaleY = inverseScaleMapping(effectiveScaleY)
        // Position above vertex: positive scaleY = point above, negative = point below
        const controlY = offsetY + linearScaleY * SCALE_FACTOR

        return { x: controlX, y: controlY }
    }, [func.offsetX, func.offsetY, effectiveScaleY])

    // Calculate scaleY from a Y pixel position
    const calculateScaleYFromPixel = useCallback((pixelY: number) => {
        const offsetY = func.offsetY ?? 0
        const graphY = pixelToGraph({ x: 0, y: pixelY }, axes, width, height).y
        const rawScaleY = (graphY - offsetY) / SCALE_FACTOR
        return applyScaleMapping(rawScaleY)
    }, [func.offsetY, axes, width, height])

    const handleScaleControlDragStart = useCallback((e: any) => {
        // Prevent the Group from also being dragged
        e.cancelBubble = true
    }, [])

    const handleScaleControlDragMove = useCallback((e: any) => {
        // Prevent the Group from also being dragged
        e.cancelBubble = true

        // Constrain X to stay on the vertical axis through the vertex
        const offsetX = func.offsetX ?? 0
        const vertexPixel = graphToPixel({ x: offsetX, y: 0 }, axes, width, height)
        e.target.x(vertexPixel.x)

        // Calculate and preview the new scaleY
        const newScaleY = calculateScaleYFromPixel(e.target.y())
        setPreviewScaleY(newScaleY)
    }, [func.offsetX, axes, width, height, calculateScaleYFromPixel])

    const handleScaleControlDragEnd = useCallback((e: any) => {
        // Prevent the Group from also being dragged
        e.cancelBubble = true

        // Calculate final scaleY and update
        const newScaleY = calculateScaleYFromPixel(e.target.y())

        // Clear preview and commit the change
        setPreviewScaleY(null)
        onUpdate({
            ...func,
            scaleY: newScaleY,
        })
    }, [func, calculateScaleYFromPixel, onUpdate])

    if (samples.length === 0) {
        return null
    }

    // Convert graph coordinates to pixel coordinates
    // Visual feedback during drag is handled automatically by Konva Group
    const points: number[] = []
    samples.forEach((coord) => {
        const pixel = graphToPixel(coord, axes, width, height)
        points.push(pixel.x, pixel.y)
    })

    const color = isSelected ? '#3b82f6' : (func.style?.color || '#111827')
    const strokeWidth = func.style?.width ?? 1.5
    const dashed = func.style?.dashed ?? false

    // Calculate pixel position for scale control
    const scaleControlPixel = scaleControlPoint
        ? graphToPixel(scaleControlPoint, axes, width, height)
        : null

    return (
        <Group
            draggable
            onDragEnd={handleDragEnd}
            onClick={handleClick}
            onTap={handleClick}
        >
            {/* Hit area for clicking/dragging - use very low opacity */}
            <Line
                points={points}
                stroke="#000000"
                strokeWidth={Math.max(strokeWidth + 15, 20)}
                opacity={0.001}
            />
            {/* Visible function curve */}
            <Line
                points={points}
                stroke={color}
                strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
                dash={dashed ? [6, 4] : undefined}
                opacity={func.style?.opacity ?? 1}
                listening={false}
            />
            {/* Scale control handle (only when selected) */}
            {isSelected && scaleControlPixel && (
                <Circle
                    x={scaleControlPixel.x}
                    y={scaleControlPixel.y}
                    radius={6}
                    fill="#10b981"
                    stroke="white"
                    strokeWidth={2}
                    draggable
                    onDragStart={handleScaleControlDragStart}
                    onDragMove={handleScaleControlDragMove}
                    onDragEnd={handleScaleControlDragEnd}
                />
            )}
            {/* Label at midpoint of domain */}
            {shouldShowLabel && func.label && labelPixel.x !== 0 && (
                <CanvasLabel
                    x={labelPixel.x}
                    y={labelPixel.y}
                    label={func.label}
                    isMath={func.labelIsMath}
                    fontSize={12}
                    color="#111827"
                    offsetX={4}
                    offsetY={-12}
                />
            )}
        </Group>
    )
})

EditableFunction.displayName = 'EditableFunction'
