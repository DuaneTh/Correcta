'use client'

import React, { useCallback, useState, useMemo } from 'react'
import { Circle, Group, Line } from 'react-konva'
import { GraphPoint, GraphAxes, GraphLine, GraphCurve, GraphFunction } from '@/types/exams'
import { graphToPixel, pixelToGraph, snapToGrid } from '../../coordinate-utils'
import { CanvasLabel } from '../CanvasLabel'
import { findNearestSnapTarget, SnapTarget, SNAP_THRESHOLDS } from '../../snapping-utils'

interface EditablePointProps {
    point: GraphPoint
    axes: GraphAxes
    width: number
    height: number
    isSelected: boolean
    onUpdate: (point: GraphPoint) => void
    onSelect?: (id: string) => void
    // Optional: for snapping feature
    lines?: GraphLine[]
    curves?: GraphCurve[]
    functions?: GraphFunction[]
    onSnapPreview?: (target: SnapTarget | null) => void
}

/**
 * Draggable point on Konva canvas.
 * Snaps to grid when enabled.
 * Snaps to nearby lines, curves, and functions during drag.
 * Displays label when showLabel is true.
 */
export const EditablePoint = React.memo<EditablePointProps>(({
    point,
    axes,
    width,
    height,
    isSelected,
    onUpdate,
    onSelect,
    lines = [],
    curves = [],
    functions = [],
    onSnapPreview,
}) => {
    const [snapPreview, setSnapPreview] = useState<SnapTarget | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    const pixel = graphToPixel({ x: point.x, y: point.y }, axes, width, height)
    const baseRadius = Math.max(2, point.size ?? 4)
    const radius = isSelected ? baseRadius + 2 : baseRadius
    const color = isSelected ? '#3b82f6' : (point.color || '#111827')
    const filled = point.filled !== false

    // Determine if label should be shown (default to true if label exists)
    const shouldShowLabel = point.showLabel !== false && Boolean(point.label)

    // Build snap payload
    const snapPayload = useMemo(() => ({
        lines,
        curves,
        functions,
    }), [lines, curves, functions])

    const handleDragStart = useCallback(() => {
        setIsDragging(true)
    }, [])

    const handleDragMove = useCallback((e: any) => {
        const newPixel = { x: e.target.x(), y: e.target.y() }
        const graphCoord = pixelToGraph(newPixel, axes, width, height)

        // Check for snap targets
        const target = findNearestSnapTarget(graphCoord, snapPayload, SNAP_THRESHOLDS)
        setSnapPreview(target)
        onSnapPreview?.(target)
    }, [axes, width, height, snapPayload, onSnapPreview])

    const handleDragEnd = useCallback((e: any) => {
        setIsDragging(false)
        const newPixel = { x: e.target.x(), y: e.target.y() }
        let graphCoord = pixelToGraph(newPixel, axes, width, height)

        // Check for snap target first
        const target = findNearestSnapTarget(graphCoord, snapPayload, SNAP_THRESHOLDS)

        if (target) {
            // Snap to the target element
            onUpdate({
                ...point,
                x: target.coord.x,
                y: target.coord.y,
                anchor: target.anchor,
            })
        } else {
            // No snap - use grid snapping if enabled
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
                anchor: { type: 'coord' },
            })
        }

        setSnapPreview(null)
        onSnapPreview?.(null)
    }, [point, axes, width, height, onUpdate, snapPayload, onSnapPreview])

    const handleClick = useCallback(() => {
        if (onSelect) {
            onSelect(point.id)
        }
    }, [point.id, onSelect])

    // Calculate snap preview indicator position
    const snapIndicatorPixel = useMemo(() => {
        if (!snapPreview) return null
        return graphToPixel(snapPreview.coord, axes, width, height)
    }, [snapPreview, axes, width, height])

    // Determine if point is currently anchored (show indicator)
    const isAnchored = point.anchor && point.anchor.type !== 'coord'

    return (
        <>
            <Group
                x={pixel.x}
                y={pixel.y}
                draggable
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
                onClick={handleClick}
                onTap={handleClick}
            >
                {/* Selection ring */}
                {isSelected && (
                    <Circle
                        radius={radius + 4}
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="transparent"
                        opacity={0.5}
                        listening={false}
                    />
                )}
                {/* Anchor indicator (when point is snapped to element) */}
                {isAnchored && !isDragging && (
                    <Circle
                        radius={radius + 6}
                        stroke="#10b981"
                        strokeWidth={1.5}
                        fill="transparent"
                        dash={[3, 3]}
                        opacity={0.7}
                        listening={false}
                    />
                )}
                <Circle
                    radius={radius}
                    stroke={color}
                    strokeWidth={isSelected ? 2 : 1.5}
                    fill={filled ? color : 'white'}
                />
                {shouldShowLabel && point.label && (
                    <CanvasLabel
                        x={0}
                        y={0}
                        label={point.label}
                        isMath={point.labelIsMath}
                        fontSize={point.labelSize ?? 12}
                        color="#111827"
                        offsetX={8}
                        offsetY={-8}
                    />
                )}
            </Group>
            {/* Snap preview indicator (shown during drag when near a target) */}
            {isDragging && snapIndicatorPixel && (
                <>
                    {/* Crosshair at snap position */}
                    <Line
                        points={[
                            snapIndicatorPixel.x - 8, snapIndicatorPixel.y,
                            snapIndicatorPixel.x + 8, snapIndicatorPixel.y,
                        ]}
                        stroke="#10b981"
                        strokeWidth={2}
                        listening={false}
                    />
                    <Line
                        points={[
                            snapIndicatorPixel.x, snapIndicatorPixel.y - 8,
                            snapIndicatorPixel.x, snapIndicatorPixel.y + 8,
                        ]}
                        stroke="#10b981"
                        strokeWidth={2}
                        listening={false}
                    />
                    {/* Circle at snap position */}
                    <Circle
                        x={snapIndicatorPixel.x}
                        y={snapIndicatorPixel.y}
                        radius={5}
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="transparent"
                        listening={false}
                    />
                </>
            )}
        </>
    )
})

EditablePoint.displayName = 'EditablePoint'
