'use client'

import React, { useCallback, useState, useMemo } from 'react'
import { Line, Circle, Group } from 'react-konva'
import { GraphLine, GraphCurve, GraphFunction, GraphAxes, GraphAnchor } from '@/types/exams'
import { graphToPixel, pixelToGraph, snapToGrid } from '../../coordinate-utils'
import { CanvasLabel } from '../CanvasLabel'
import { findNearestSnapTarget, SnapTarget, SNAP_THRESHOLDS } from '../../snapping-utils'

interface EditableLineProps {
    line: GraphLine
    axes: GraphAxes
    width: number
    height: number
    isSelected: boolean
    onUpdate: (line: GraphLine) => void
    onSelect?: (id: string) => void
    lines?: GraphLine[]
    curves?: GraphCurve[]
    functions?: GraphFunction[]
}

/**
 * Draggable line with moveable endpoints for coordinate anchors.
 * Supports line, ray, and segment kinds.
 * The entire line can be dragged to move both endpoints together.
 * Real-time preview during endpoint drag.
 * Displays label at midpoint when showLabel is true.
 */
export const EditableLine = React.memo<EditableLineProps>(({
    line,
    axes,
    width,
    height,
    isSelected,
    onUpdate,
    onSelect,
    lines = [],
    curves = [],
    functions = [],
}) => {
    // Track preview positions during drag for real-time feedback
    const [previewStart, setPreviewStart] = useState<{ x: number; y: number } | null>(null)
    const [previewEnd, setPreviewEnd] = useState<{ x: number; y: number } | null>(null)
    // Track snap targets during endpoint drag
    const [startSnapPreview, setStartSnapPreview] = useState<SnapTarget | null>(null)
    const [endSnapPreview, setEndSnapPreview] = useState<SnapTarget | null>(null)

    // Filter out this line from snap candidates
    const snapPayload = useMemo(() => ({
        lines: lines.filter(l => l.id !== line.id),
        curves,
        functions,
    }), [lines, curves, functions, line.id])

    const getAnchorCoord = (anchor: GraphAnchor): { x: number; y: number } => {
        if (anchor.type === 'coord') {
            return { x: anchor.x, y: anchor.y }
        }
        return { x: 0, y: 0 }
    }

    // Use preview coordinates if dragging, otherwise use actual coordinates
    const startCoord = previewStart ?? getAnchorCoord(line.start)
    const endCoord = previewEnd ?? getAnchorCoord(line.end)

    const startPixel = graphToPixel(startCoord, axes, width, height)
    const endPixel = graphToPixel(endCoord, axes, width, height)

    // Determine if label should be shown (default to true if label exists)
    const shouldShowLabel = line.showLabel !== false && Boolean(line.label)

    // Calculate label position at midpoint of line (or custom position)
    const labelPixel = useMemo(() => {
        if (line.labelPos) {
            return graphToPixel(line.labelPos, axes, width, height)
        }
        // Default: midpoint of the segment
        return {
            x: (startPixel.x + endPixel.x) / 2,
            y: (startPixel.y + endPixel.y) / 2,
        }
    }, [line.labelPos, startPixel, endPixel, axes, width, height])

    // For infinite lines/rays, extend to canvas boundaries
    let renderStart = startPixel
    let renderEnd = endPixel

    if (line.kind === 'line') {
        const dx = endPixel.x - startPixel.x
        const dy = endPixel.y - startPixel.y
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const scale = Math.max(width, height) * 2
        renderStart = { x: startPixel.x - (dx / len) * scale, y: startPixel.y - (dy / len) * scale }
        renderEnd = { x: endPixel.x + (dx / len) * scale, y: endPixel.y + (dy / len) * scale }
    } else if (line.kind === 'ray') {
        const dx = endPixel.x - startPixel.x
        const dy = endPixel.y - startPixel.y
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const scale = Math.max(width, height) * 2
        renderEnd = { x: startPixel.x + (dx / len) * scale, y: startPixel.y + (dy / len) * scale }
    }

    const handleGroupDragEnd = useCallback((e: any) => {
        if (line.start.type !== 'coord' || line.end.type !== 'coord') return

        const group = e.target
        const deltaX = group.x()
        const deltaY = group.y()

        group.x(0)
        group.y(0)

        const origStart = getAnchorCoord(line.start)
        const origEnd = getAnchorCoord(line.end)
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
            ...line,
            start: { type: 'coord', x: newStartCoord.x, y: newStartCoord.y },
            end: { type: 'coord', x: newEndCoord.x, y: newEndCoord.y },
        })
    }, [line, axes, width, height, onUpdate])

    // Prevent endpoint drag from triggering Group drag
    const handleEndpointDragStart = useCallback((e: any) => {
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

        // Check for snap target
        const snapTarget = findNearestSnapTarget(graphCoord, snapPayload, SNAP_THRESHOLDS)
        setStartSnapPreview(snapTarget)
    }, [axes, width, height, applySnap, snapPayload])

    const handleStartDragEnd = useCallback((e: any) => {
        e.cancelBubble = true
        if (line.start.type !== 'coord') return

        const newPixel = { x: e.target.x(), y: e.target.y() }
        const graphCoord = applySnap(pixelToGraph(newPixel, axes, width, height), e)

        // Check if we should snap
        const snapTarget = findNearestSnapTarget(graphCoord, snapPayload, SNAP_THRESHOLDS)

        setPreviewStart(null)
        setStartSnapPreview(null)

        if (snapTarget) {
            // Snap to target - use coord anchor with snapped position
            onUpdate({
                ...line,
                start: { type: 'coord', x: snapTarget.coord.x, y: snapTarget.coord.y },
            })
        } else {
            onUpdate({
                ...line,
                start: { type: 'coord', x: graphCoord.x, y: graphCoord.y },
            })
        }
    }, [line, axes, width, height, onUpdate, applySnap, snapPayload])

    const handleEndDragMove = useCallback((e: any) => {
        e.cancelBubble = true
        const newPixel = { x: e.target.x(), y: e.target.y() }
        const graphCoord = applySnap(pixelToGraph(newPixel, axes, width, height), e)
        setPreviewEnd(graphCoord)

        // Check for snap target
        const snapTarget = findNearestSnapTarget(graphCoord, snapPayload, SNAP_THRESHOLDS)
        setEndSnapPreview(snapTarget)
    }, [axes, width, height, applySnap, snapPayload])

    const handleEndDragEnd = useCallback((e: any) => {
        e.cancelBubble = true
        if (line.end.type !== 'coord') return

        const newPixel = { x: e.target.x(), y: e.target.y() }
        const graphCoord = applySnap(pixelToGraph(newPixel, axes, width, height), e)

        // Check if we should snap
        const snapTarget = findNearestSnapTarget(graphCoord, snapPayload, SNAP_THRESHOLDS)

        setPreviewEnd(null)
        setEndSnapPreview(null)

        if (snapTarget) {
            // Snap to target - use coord anchor with snapped position
            onUpdate({
                ...line,
                end: { type: 'coord', x: snapTarget.coord.x, y: snapTarget.coord.y },
            })
        } else {
            onUpdate({
                ...line,
                end: { type: 'coord', x: graphCoord.x, y: graphCoord.y },
            })
        }
    }, [line, axes, width, height, onUpdate, applySnap, snapPayload])

    const handleClick = useCallback(() => {
        if (onSelect) {
            onSelect(line.id)
        }
    }, [line.id, onSelect])

    const color = line.style?.color || '#111827'
    const strokeWidth = line.style?.width ?? 1.5
    const dashed = line.style?.dashed ?? false
    const canDragWhole = line.start.type === 'coord' && line.end.type === 'coord'

    return (
        <Group
            draggable={canDragWhole}
            onDragEnd={handleGroupDragEnd}
            onClick={handleClick}
            onTap={handleClick}
        >
            {/* Hit area - wider invisible stroke for easier clicking */}
            <Line
                points={[renderStart.x, renderStart.y, renderEnd.x, renderEnd.y]}
                stroke="#000000"
                strokeWidth={Math.max(strokeWidth + 15, 20)}
                opacity={0.001}
            />
            {/* Visible line */}
            <Line
                points={[renderStart.x, renderStart.y, renderEnd.x, renderEnd.y]}
                stroke={isSelected ? '#3b82f6' : color}
                strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
                dash={dashed ? [6, 4] : undefined}
                opacity={line.style?.opacity ?? 1}
                listening={false}
            />
            {/* Start handle (only when selected and for coord anchors) */}
            {isSelected && line.start.type === 'coord' && (
                <Circle
                    x={startPixel.x}
                    y={startPixel.y}
                    radius={6}
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth={2}
                    draggable
                    onDragStart={handleEndpointDragStart}
                    onDragMove={handleStartDragMove}
                    onDragEnd={handleStartDragEnd}
                />
            )}
            {/* End handle (only when selected and for coord anchors) */}
            {isSelected && line.end.type === 'coord' && (
                <Circle
                    x={endPixel.x}
                    y={endPixel.y}
                    radius={6}
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth={2}
                    draggable
                    onDragStart={handleEndpointDragStart}
                    onDragMove={handleEndDragMove}
                    onDragEnd={handleEndDragEnd}
                />
            )}
            {/* Label at midpoint */}
            {shouldShowLabel && line.label && (
                <CanvasLabel
                    x={labelPixel.x}
                    y={labelPixel.y}
                    label={line.label}
                    isMath={line.labelIsMath}
                    fontSize={12}
                    color="#111827"
                    offsetX={0}
                    offsetY={-12}
                />
            )}
            {/* Snap preview for start endpoint */}
            {startSnapPreview && (() => {
                const snapPixel = graphToPixel(startSnapPreview.coord, axes, width, height)
                return (
                    <>
                        <Line
                            points={[snapPixel.x - 8, snapPixel.y, snapPixel.x + 8, snapPixel.y]}
                            stroke="#22c55e"
                            strokeWidth={2}
                            listening={false}
                        />
                        <Line
                            points={[snapPixel.x, snapPixel.y - 8, snapPixel.x, snapPixel.y + 8]}
                            stroke="#22c55e"
                            strokeWidth={2}
                            listening={false}
                        />
                    </>
                )
            })()}
            {/* Snap preview for end endpoint */}
            {endSnapPreview && (() => {
                const snapPixel = graphToPixel(endSnapPreview.coord, axes, width, height)
                return (
                    <>
                        <Line
                            points={[snapPixel.x - 8, snapPixel.y, snapPixel.x + 8, snapPixel.y]}
                            stroke="#22c55e"
                            strokeWidth={2}
                            listening={false}
                        />
                        <Line
                            points={[snapPixel.x, snapPixel.y - 8, snapPixel.x, snapPixel.y + 8]}
                            stroke="#22c55e"
                            strokeWidth={2}
                            listening={false}
                        />
                    </>
                )
            })()}
        </Group>
    )
})

EditableLine.displayName = 'EditableLine'
