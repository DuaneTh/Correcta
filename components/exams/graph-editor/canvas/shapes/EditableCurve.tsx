'use client'

import React, { useCallback, useState, useMemo } from 'react'
import { Line, Circle, Group } from 'react-konva'
import { GraphCurve, GraphAxes, GraphAnchor } from '@/types/exams'
import { graphToPixel, pixelToGraph, snapToGrid } from '../../coordinate-utils'
import { CanvasLabel } from '../CanvasLabel'

interface EditableCurveProps {
    curve: GraphCurve
    axes: GraphAxes
    width: number
    height: number
    isSelected: boolean
    onUpdate: (curve: GraphCurve) => void
    onSelect?: (id: string) => void
}

/**
 * Quadratic bezier curve rendered as Konva Line.
 * Draggable endpoints and control point for curvature adjustment.
 * Real-time preview during drag.
 * Displays label at t=0.5 when showLabel is true.
 */
export const EditableCurve = React.memo<EditableCurveProps>(({
    curve,
    axes,
    width,
    height,
    isSelected,
    onUpdate,
    onSelect,
}) => {
    // Track preview positions during drag for real-time feedback
    const [previewStart, setPreviewStart] = useState<{ x: number; y: number } | null>(null)
    const [previewEnd, setPreviewEnd] = useState<{ x: number; y: number } | null>(null)
    const [previewCurvature, setPreviewCurvature] = useState<number | null>(null)

    const getAnchorCoord = (anchor: GraphAnchor): { x: number; y: number } => {
        if (anchor.type === 'coord') {
            return { x: anchor.x, y: anchor.y }
        }
        return { x: 0, y: 0 }
    }

    // Use preview coordinates if dragging, otherwise use actual coordinates
    const startCoord = previewStart ?? getAnchorCoord(curve.start)
    const endCoord = previewEnd ?? getAnchorCoord(curve.end)
    const curvature = previewCurvature ?? (curve.curvature ?? 0)

    const startPixel = graphToPixel(startCoord, axes, width, height)
    const endPixel = graphToPixel(endCoord, axes, width, height)

    // Determine if label should be shown (default to true if label exists)
    const shouldShowLabel = curve.showLabel !== false && Boolean(curve.label)

    // Calculate control point position
    const controlCoord = useMemo(() => {
        const midX = (startCoord.x + endCoord.x) / 2
        const midY = (startCoord.y + endCoord.y) / 2
        const dx = endCoord.x - startCoord.x
        const dy = endCoord.y - startCoord.y
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const normalX = -dy / len
        const normalY = dx / len
        return {
            x: midX + normalX * curvature,
            y: midY + normalY * curvature,
        }
    }, [startCoord, endCoord, curvature])

    const controlPixel = graphToPixel(controlCoord, axes, width, height)

    // Calculate label position at t=0.5 of the bezier curve (or custom position)
    const labelPixel = useMemo(() => {
        if (curve.labelPos) {
            return graphToPixel(curve.labelPos, axes, width, height)
        }
        // Default: point at t=0.5 on the bezier curve
        const t = 0.5
        const u = 1 - t
        return {
            x: u * u * startPixel.x + 2 * u * t * controlPixel.x + t * t * endPixel.x,
            y: u * u * startPixel.y + 2 * u * t * controlPixel.y + t * t * endPixel.y,
        }
    }, [curve.labelPos, startPixel, controlPixel, endPixel, axes, width, height])

    // Sample the quadratic curve
    const points = useMemo(() => {
        const result: number[] = []
        const samples = 50
        for (let i = 0; i <= samples; i++) {
            const t = i / samples
            const u = 1 - t
            const x = u * u * startPixel.x + 2 * u * t * controlPixel.x + t * t * endPixel.x
            const y = u * u * startPixel.y + 2 * u * t * controlPixel.y + t * t * endPixel.y
            result.push(x, y)
        }
        return result
    }, [startPixel, controlPixel, endPixel])

    const handleGroupDragEnd = useCallback((e: any) => {
        if (curve.start.type !== 'coord' || curve.end.type !== 'coord') return

        const group = e.target
        const deltaX = group.x()
        const deltaY = group.y()

        group.x(0)
        group.y(0)

        const origStart = getAnchorCoord(curve.start)
        const origEnd = getAnchorCoord(curve.end)
        const origStartPixel = graphToPixel(origStart, axes, width, height)
        const origEndPixel = graphToPixel(origEnd, axes, width, height)

        const newStartPixel = { x: origStartPixel.x + deltaX, y: origStartPixel.y + deltaY }
        const newEndPixel = { x: origEndPixel.x + deltaX, y: origEndPixel.y + deltaY }

        let newStartCoord = pixelToGraph(newStartPixel, axes, width, height)
        let newEndCoord = pixelToGraph(newEndPixel, axes, width, height)

        // Snap to grid if Shift is held
        const shiftHeld = e.evt?.shiftKey ?? false
        if (shiftHeld) {
            newStartCoord = { x: snapToGrid(newStartCoord.x, 1), y: snapToGrid(newStartCoord.y, 1) }
            newEndCoord = { x: snapToGrid(newEndCoord.x, 1), y: snapToGrid(newEndCoord.y, 1) }
        }

        onUpdate({
            ...curve,
            start: { type: 'coord', x: newStartCoord.x, y: newStartCoord.y },
            end: { type: 'coord', x: newEndCoord.x, y: newEndCoord.y },
        })
    }, [curve, axes, width, height, onUpdate])

    // Prevent handle drag from triggering Group drag
    const handleHandleDragStart = useCallback((e: any) => {
        e.cancelBubble = true
    }, [])

    // Helper to optionally snap coordinates to grid when Shift is held
    const applySnap = useCallback((coord: { x: number; y: number }, e: any) => {
        const shiftHeld = e.evt?.shiftKey ?? false
        if (shiftHeld) {
            return {
                x: snapToGrid(coord.x, 1),
                y: snapToGrid(coord.y, 1),
            }
        }
        return coord
    }, [])

    const handleStartDragMove = useCallback((e: any) => {
        e.cancelBubble = true
        const newPixel = { x: e.target.x(), y: e.target.y() }
        const graphCoord = applySnap(pixelToGraph(newPixel, axes, width, height), e)
        setPreviewStart(graphCoord)
    }, [axes, width, height, applySnap])

    const handleStartDragEnd = useCallback((e: any) => {
        e.cancelBubble = true
        if (curve.start.type !== 'coord') return

        const newPixel = { x: e.target.x(), y: e.target.y() }
        const graphCoord = applySnap(pixelToGraph(newPixel, axes, width, height), e)

        setPreviewStart(null)
        onUpdate({
            ...curve,
            start: { type: 'coord', x: graphCoord.x, y: graphCoord.y },
        })
    }, [curve, axes, width, height, onUpdate, applySnap])

    const handleEndDragMove = useCallback((e: any) => {
        e.cancelBubble = true
        const newPixel = { x: e.target.x(), y: e.target.y() }
        const graphCoord = applySnap(pixelToGraph(newPixel, axes, width, height), e)
        setPreviewEnd(graphCoord)
    }, [axes, width, height, applySnap])

    const handleEndDragEnd = useCallback((e: any) => {
        e.cancelBubble = true
        if (curve.end.type !== 'coord') return

        const newPixel = { x: e.target.x(), y: e.target.y() }
        const graphCoord = applySnap(pixelToGraph(newPixel, axes, width, height), e)

        setPreviewEnd(null)
        onUpdate({
            ...curve,
            end: { type: 'coord', x: graphCoord.x, y: graphCoord.y },
        })
    }, [curve, axes, width, height, onUpdate, applySnap])

    // Calculate curvature from pixel position
    const calculateCurvatureFromPixel = useCallback((pixelX: number, pixelY: number) => {
        const newGraphCoord = pixelToGraph({ x: pixelX, y: pixelY }, axes, width, height)
        const currentStart = previewStart ?? getAnchorCoord(curve.start)
        const currentEnd = previewEnd ?? getAnchorCoord(curve.end)

        const midX = (currentStart.x + currentEnd.x) / 2
        const midY = (currentStart.y + currentEnd.y) / 2
        const dx = currentEnd.x - currentStart.x
        const dy = currentEnd.y - currentStart.y
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const normalX = -dy / len
        const normalY = dx / len

        const offsetX = newGraphCoord.x - midX
        const offsetY = newGraphCoord.y - midY
        return offsetX * normalX + offsetY * normalY
    }, [curve.start, curve.end, previewStart, previewEnd, axes, width, height])

    const handleControlDragMove = useCallback((e: any) => {
        e.cancelBubble = true
        const newCurvature = calculateCurvatureFromPixel(e.target.x(), e.target.y())
        setPreviewCurvature(newCurvature)
    }, [calculateCurvatureFromPixel])

    const handleControlDragEnd = useCallback((e: any) => {
        e.cancelBubble = true
        const newCurvature = calculateCurvatureFromPixel(e.target.x(), e.target.y())

        setPreviewCurvature(null)
        onUpdate({
            ...curve,
            curvature: newCurvature,
        })
    }, [curve, calculateCurvatureFromPixel, onUpdate])

    const handleClick = useCallback(() => {
        if (onSelect) {
            onSelect(curve.id)
        }
    }, [curve.id, onSelect])

    const color = curve.style?.color || '#111827'
    const strokeWidth = curve.style?.width ?? 1.5
    const dashed = curve.style?.dashed ?? false
    const canDragWhole = curve.start.type === 'coord' && curve.end.type === 'coord'

    return (
        <Group
            draggable={canDragWhole}
            onDragEnd={handleGroupDragEnd}
            onClick={handleClick}
            onTap={handleClick}
        >
            {/* Hit area - wider invisible stroke for easier clicking */}
            <Line
                points={points}
                stroke="#000000"
                strokeWidth={Math.max(strokeWidth + 15, 20)}
                opacity={0.001}
            />
            {/* Visible curve */}
            <Line
                points={points}
                stroke={isSelected ? '#3b82f6' : color}
                strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
                dash={dashed ? [6, 4] : undefined}
                opacity={curve.style?.opacity ?? 1}
                listening={false}
            />
            {/* Start handle (only when selected) */}
            {isSelected && curve.start.type === 'coord' && (
                <Circle
                    x={startPixel.x}
                    y={startPixel.y}
                    radius={6}
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth={2}
                    draggable
                    onDragStart={handleHandleDragStart}
                    onDragMove={handleStartDragMove}
                    onDragEnd={handleStartDragEnd}
                />
            )}
            {/* End handle (only when selected) */}
            {isSelected && curve.end.type === 'coord' && (
                <Circle
                    x={endPixel.x}
                    y={endPixel.y}
                    radius={6}
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth={2}
                    draggable
                    onDragStart={handleHandleDragStart}
                    onDragMove={handleEndDragMove}
                    onDragEnd={handleEndDragEnd}
                />
            )}
            {/* Control point handle (only when selected) */}
            {isSelected && (
                <Circle
                    x={controlPixel.x}
                    y={controlPixel.y}
                    radius={5}
                    fill="#10b981"
                    stroke="white"
                    strokeWidth={1}
                    draggable
                    onDragStart={handleHandleDragStart}
                    onDragMove={handleControlDragMove}
                    onDragEnd={handleControlDragEnd}
                />
            )}
            {/* Label at t=0.5 of curve */}
            {shouldShowLabel && curve.label && (
                <CanvasLabel
                    x={labelPixel.x}
                    y={labelPixel.y}
                    label={curve.label}
                    isMath={curve.labelIsMath}
                    fontSize={12}
                    color="#111827"
                    offsetX={0}
                    offsetY={-12}
                />
            )}
        </Group>
    )
})

EditableCurve.displayName = 'EditableCurve'
