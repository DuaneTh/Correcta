'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Line, Group, Circle, Text as KonvaText } from 'react-konva'
import { GraphArea, GraphAxes, GraphAnchor, GraphFunction, GraphLine } from '@/types/exams'
import { graphToPixel, pixelToGraph } from '../../coordinate-utils'
import { compileExpression } from '@/components/exams/graph-utils'
import { CanvasLabel } from '../CanvasLabel'
import {
  findEnclosingRegion,
  type RegionElement
} from '../../region-detection'

interface EditableAreaProps {
    area: GraphArea
    functions: GraphFunction[]
    lines: GraphLine[]
    axes: GraphAxes
    width: number
    height: number
    isSelected: boolean
    onUpdate: (area: GraphArea) => void
    onSelect?: (id: string) => void
    /** When true, only render the +/- overlay buttons (for z-ordering above other shapes) */
    renderOverlayOnly?: boolean
}

/**
 * EditableArea with a single draggable control point.
 * When the control point is moved, it detects nearby curves/lines
 * and generates a polygon to fill the area.
 */
export const EditableArea = React.memo<EditableAreaProps>(({
    area,
    functions,
    lines,
    axes,
    width,
    height,
    isSelected,
    onUpdate,
    onSelect,
    renderOverlayOnly,
}) => {
    // Ref to always read the latest area (avoids stale closures in Konva handlers)
    const areaRef = useRef(area)
    areaRef.current = area

    // Local state for smooth dragging
    const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)

    // Control point position
    const controlPoint = useMemo(() => {
        if (dragPos) return dragPos
        if (area.labelPos) return area.labelPos
        // Calculate from polygon centroid or domain center
        if (area.points && area.points.length > 0) {
            const coords = area.points
                .filter((p): p is { type: 'coord'; x: number; y: number } => p.type === 'coord')
            if (coords.length > 0) {
                const sum = coords.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
                return { x: sum.x / coords.length, y: sum.y / coords.length }
            }
        }
        const centerX = ((area.domain?.min ?? -2) + (area.domain?.max ?? 2)) / 2
        return { x: centerX, y: 1 }
    }, [dragPos, area.labelPos, area.points, area.domain])

    const controlPixel = graphToPixel(controlPoint, axes, width, height)

    // Calculate outline from polygon points
    const outline = useMemo(() => {
        if (!area.points || area.points.length < 3) return []
        return area.points
            .filter((p): p is { type: 'coord'; x: number; y: number } => p.type === 'coord')
            .map(p => ({ x: p.x, y: p.y }))
    }, [area.points])

    // Centroid for label
    const centroid = useMemo(() => {
        if (outline.length === 0) return controlPoint
        const sum = outline.reduce((acc, pt) => ({ x: acc.x + pt.x, y: acc.y + pt.y }), { x: 0, y: 0 })
        return { x: sum.x / outline.length, y: sum.y / outline.length }
    }, [outline, controlPoint])

    const labelPixel = graphToPixel(centroid, axes, width, height)
    const shouldShowLabel = area.showLabel !== false && Boolean(area.label)

    const handleClick = useCallback(() => {
        onSelect?.(area.id)
    }, [area.id, onSelect])

    const handleDragMove = useCallback((e: any) => {
        const node = e.target
        const pos = pixelToGraph({ x: node.x(), y: node.y() }, axes, width, height)
        setDragPos(pos)
    }, [axes, width, height])

    const handleDragEnd = useCallback((e: any) => {
        const node = e.target
        const newPos = pixelToGraph({ x: node.x(), y: node.y() }, axes, width, height)

        // 1. Build the list of elements (all lines participate, including dashed/asymptotes)
        const elements: RegionElement[] = [
            ...functions.map(fn => ({ type: 'function' as const, id: fn.id, element: fn })),
            ...lines.map(ln => ({ type: 'line' as const, id: ln.id, element: ln })),
        ]

        // 2. Call the detector
        const result = findEnclosingRegion(
            newPos,
            elements,
            axes,
            area.ignoredBoundaries
        )

        // 3. Update the area
        if (result && result.polygon.length >= 3) {
            const newPoints: GraphAnchor[] = result.polygon.map(pt => ({
                type: 'coord' as const,
                x: pt.x,
                y: pt.y,
            }))

            onUpdate({
                ...area,
                mode: 'bounded-region',
                boundaryIds: result.boundaryIds,
                domain: result.domain,
                points: newPoints,
                labelPos: newPos,
            })
        } else {
            // No closed region found, just move the control point
            onUpdate({
                ...area,
                labelPos: newPos,
            })
        }

        setDragPos(null)
    }, [area, functions, lines, axes, width, height, onUpdate])

    // Convert outline to pixels
    const pixelPoints = useMemo(() => {
        const pts: number[] = []
        outline.forEach(coord => {
            const px = graphToPixel(coord, axes, width, height)
            pts.push(px.x, px.y)
        })
        return pts
    }, [outline, axes, width, height])

    const fillColor = area.fill?.color || '#8b5cf6'
    const fillOpacity = area.fill?.opacity ?? 0.35

    // Boundary buttons: detect adjacent zones and place +/- buttons at their centres.
    // "+" (green) = extend into adjacent zone    →  click ignores the boundary
    // "−" (red)   = retract from a sub-zone      →  click restores the boundary
    const boundaryButtons = useMemo(() => {
        if (!isSelected || outline.length < 3) return []

        const buttons: Array<{ id: string; x: number; y: number; isIgnored: boolean }> = []

        // Centroid of current polygon (graph coords)
        const cx = outline.reduce((s, p) => s + p.x, 0) / outline.length
        const cy = outline.reduce((s, p) => s + p.y, 0) / outline.length
        const centroidPx = graphToPixel({ x: cx, y: cy }, axes, width, height)

        const ignoredIds = new Set(area.ignoredBoundaries || [])

        // Use boundaryIds if available, otherwise consider ALL functions/lines
        const candidateIds: string[] = (area.boundaryIds && area.boundaryIds.length > 0)
            ? area.boundaryIds
            : [...functions.map(f => f.id), ...lines.map(l => l.id)]

        const allElements: RegionElement[] = [
            ...functions.map(fn => ({ type: 'function' as const, id: fn.id, element: fn })),
            ...lines.map(ln => ({ type: 'line' as const, id: ln.id, element: ln })),
        ]

        const PROBE = 0.2 // graph-units past the boundary

        // Reference points:
        //  "+" uses polygon centroid  → probe goes AWAY from area into adjacent zone
        //  "−" uses controlPoint      → probe goes AWAY from original zone into extension
        const cpx = controlPoint.x, cpy = controlPoint.y

        // Find point on the boundary, then step past it AWAY from (refX, refY)
        const getBoundaryAndProbe = (id: string, refX: number, refY: number): {
            bx: number; by: number; // boundary point (graph)
            px: number; py: number; // probe point (graph, other side of boundary)
        } | null => {
            const func = functions.find(f => f.id === id)
            if (func) {
                const ev = compileExpression(func.expression)
                if (!ev) return null
                try {
                    const oX = func.offsetX ?? 0, oY = func.offsetY ?? 0, sY = func.scaleY ?? 1
                    const yF = sY * ev(refX - oX) + oY
                    if (!Number.isFinite(yF)) return null
                    const step = yF > refY ? PROBE : -PROBE
                    return { bx: refX, by: yF, px: refX, py: yF + step }
                } catch { return null }
            }

            const line = lines.find(l => l.id === id)
            if (line && line.start.type === 'coord' && line.end.type === 'coord') {
                const lx1 = line.start.x, ly1 = line.start.y
                const lx2 = line.end.x, ly2 = line.end.y

                if (Math.abs(lx1 - lx2) < 0.1) {
                    const lineX = (lx1 + lx2) / 2
                    const step = lineX > refX ? PROBE : -PROBE
                    return { bx: lineX, by: refY, px: lineX + step, py: refY }
                }
                if (Math.abs(ly1 - ly2) < 0.1) {
                    const lineY = (ly1 + ly2) / 2
                    const step = lineY > refY ? PROBE : -PROBE
                    return { bx: refX, by: lineY, px: refX, py: lineY + step }
                }

                // Diagonal
                const mx = (lx1 + lx2) / 2, my = (ly1 + ly2) / 2
                let nx = -(ly2 - ly1), ny = lx2 - lx1
                const len = Math.sqrt(nx * nx + ny * ny) || 1
                nx /= len; ny /= len
                if (nx * (mx - refX) + ny * (my - refY) < 0) { nx = -nx; ny = -ny }
                return { bx: mx, by: my, px: mx + nx * PROBE, py: my + ny * PROBE }
            }
            return null
        }

        // Min distance from a point to the nearest polygon edge (graph coords)
        const minDistToEdge = (px: number, py: number, poly: { x: number; y: number }[]) => {
            let minD = Infinity
            for (let i = 0; i < poly.length; i++) {
                const j = (i + 1) % poly.length
                const ex = poly[j].x - poly[i].x, ey = poly[j].y - poly[i].y
                const len2 = ex * ex + ey * ey
                if (len2 < 1e-10) continue
                const t = Math.max(0, Math.min(1, ((px - poly[i].x) * ex + (py - poly[i].y) * ey) / len2))
                const dx = px - (poly[i].x + t * ex), dy = py - (poly[i].y + t * ey)
                const d = Math.sqrt(dx * dx + dy * dy)
                if (d < minD) minD = d
            }
            return minD
        }

        // "+" buttons — placed just past each active boundary, at the polygon edge.
        // Only shown if the boundary actually touches the polygon outline.
        for (const bId of candidateIds) {
            if (ignoredIds.has(bId)) continue

            const bp = getBoundaryAndProbe(bId, cx, cy)
            if (!bp) continue

            // Only show if the boundary point is near our polygon edge
            if (minDistToEdge(bp.bx, bp.by, outline) > 0.5) continue

            // Place button just past the boundary (probe point)
            const px = graphToPixel({ x: bp.px, y: bp.py }, axes, width, height)
            buttons.push({ id: bId, x: px.x, y: px.y, isIgnored: false })
        }

        // "−" buttons — for each ignored boundary, show in the sub-zone that would be removed
        const cpPx = graphToPixel(controlPoint, axes, width, height)
        for (const igId of ignoredIds) {
            const bp = getBoundaryAndProbe(igId, cpx, cpy)
            if (!bp) continue

            const restored = (area.ignoredBoundaries || []).filter(id => id !== igId)
            const sub = findEnclosingRegion({ x: bp.px, y: bp.py }, allElements, axes, restored)
            if (sub && sub.polygon.length >= 3) {
                const n = sub.polygon.length
                const gx = sub.polygon.reduce((s, p) => s + p.x, 0) / n
                const gy = sub.polygon.reduce((s, p) => s + p.y, 0) / n
                const px = graphToPixel({ x: gx, y: gy }, axes, width, height)
                buttons.push({ id: igId, x: px.x, y: px.y, isIgnored: true })
            } else {
                // Fallback: place button past boundary, away from control point
                const bPx = graphToPixel({ x: bp.bx, y: bp.by }, axes, width, height)
                const dx = bPx.x - cpPx.x  // direction: control → boundary
                const dy = bPx.y - cpPx.y
                const len = Math.sqrt(dx * dx + dy * dy) || 1
                // Continue past the boundary in that direction
                buttons.push({ id: igId, x: bPx.x + (dx / len) * 25, y: bPx.y + (dy / len) * 25, isIgnored: true })
            }
        }

        return buttons
    }, [isSelected, area.boundaryIds, area.ignoredBoundaries, outline, controlPoint, functions, lines, axes, width, height])

    // Handle extend/collapse button click - toggle boundary and recalculate area
    // Uses areaRef to always read the LATEST area (prevents stale closures
    // when Konva event handlers haven't been updated yet between clicks).
    const handleBoundaryToggle = useCallback((boundaryId: string) => {
        const currentArea = areaRef.current

        const isCurrentlyIgnored = currentArea.ignoredBoundaries?.includes(boundaryId) || false

        const newIgnored = isCurrentlyIgnored
            ? (currentArea.ignoredBoundaries || []).filter(id => id !== boundaryId)
            : [...(currentArea.ignoredBoundaries || []), boundaryId]

        // Recalculate with the new set of ignored boundaries (all lines participate)
        const elements: RegionElement[] = [
            ...functions.map(fn => ({ type: 'function' as const, id: fn.id, element: fn })),
            ...lines.map(ln => ({ type: 'line' as const, id: ln.id, element: ln })),
        ]

        const result = findEnclosingRegion(
            controlPoint, // Use current control point position
            elements,
            axes,
            newIgnored
        )

        if (result && result.polygon.length >= 3) {
            onUpdate({
                ...currentArea,
                mode: 'bounded-region',
                boundaryIds: result.boundaryIds,
                domain: result.domain,
                points: result.polygon.map(pt => ({ type: 'coord' as const, x: pt.x, y: pt.y })),
                ignoredBoundaries: newIgnored,
            })
        } else {
            onUpdate({
                ...currentArea,
                ignoredBoundaries: newIgnored,
            })
        }
    }, [controlPoint, functions, lines, axes, onUpdate])

    // Control point element
    const controlElement = (
        <Circle
            x={controlPixel.x}
            y={controlPixel.y}
            radius={isSelected ? 12 : 8}
            fill={isSelected ? '#3b82f6' : '#8b5cf6'}
            stroke="white"
            strokeWidth={2}
            opacity={isSelected ? 1 : 0.8}
            draggable
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onClick={handleClick}
            onTap={handleClick}
        />
    )

    // ── Overlay-only pass: just the +/- buttons, rendered above all other shapes ──
    if (renderOverlayOnly) {
        if (!isSelected || boundaryButtons.length === 0) return null
        return (
            <Group>
                {boundaryButtons.map(btn => (
                    <Group
                        key={btn.id}
                        x={btn.x}
                        y={btn.y}
                        onClick={(e) => {
                            e.cancelBubble = true
                            handleBoundaryToggle(btn.id)
                        }}
                        onTap={(e) => {
                            e.cancelBubble = true
                            handleBoundaryToggle(btn.id)
                        }}
                    >
                        <Circle
                            radius={12}
                            fill={btn.isIgnored ? '#dc2626' : '#16a34a'}
                            stroke="white"
                            strokeWidth={2}
                        />
                        <KonvaText
                            text={btn.isIgnored ? '−' : '+'}
                            fontSize={15}
                            fontStyle="bold"
                            fill="white"
                            width={24}
                            height={24}
                            offsetX={12}
                            offsetY={12}
                            align="center"
                            verticalAlign="middle"
                            listening={false}
                        />
                    </Group>
                ))}
            </Group>
        )
    }

    // ── Normal pass: fill, control point, label (no buttons) ──

    // If no valid outline, just show control point
    if (outline.length < 3) {
        return controlElement
    }

    return (
        <Group>
            {/* Filled area */}
            <Line
                points={pixelPoints}
                closed
                fill={fillColor}
                opacity={isSelected ? Math.min(fillOpacity + 0.1, 0.5) : fillOpacity}
                stroke={isSelected ? '#3b82f6' : undefined}
                strokeWidth={isSelected ? 2 : 0}
                onClick={handleClick}
                onTap={handleClick}
            />

            {/* Control point */}
            {controlElement}

            {/* Label */}
            {shouldShowLabel && area.label && (
                <CanvasLabel
                    x={labelPixel.x}
                    y={labelPixel.y}
                    label={area.label}
                    isMath={area.labelIsMath}
                    fontSize={12}
                    color="#111827"
                    offsetX={-8}
                    offsetY={0}
                />
            )}
        </Group>
    )
})

EditableArea.displayName = 'EditableArea'
