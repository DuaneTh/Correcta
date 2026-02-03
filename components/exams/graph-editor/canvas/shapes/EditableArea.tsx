'use client'

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { Line, Group, Circle, Rect, Text as KonvaText } from 'react-konva'
import { GraphArea, GraphAxes, GraphAnchor, GraphFunction, GraphLine } from '@/types/exams'
import { graphToPixel, pixelToGraph } from '../../coordinate-utils'
import { compileExpression } from '@/components/exams/graph-utils'
import { CanvasLabel } from '../CanvasLabel'
import {
  findFunctionIntersections,
  findLineFunctionIntersection,
  findLineLineIntersection,
  generatePolygonBetweenCurves,
  generatePolygonBoundedByElements,
  type BoundaryElement
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
}

/**
 * Sample a function at regular intervals within a domain.
 */
function sampleFunctionInDomain(
    func: GraphFunction,
    minX: number,
    maxX: number,
    numSamples: number = 50
): { x: number; y: number }[] {
    const evaluator = compileExpression(func.expression)
    if (!evaluator) return []

    const samples: { x: number; y: number }[] = []
    const step = (maxX - minX) / numSamples
    const offsetX = func.offsetX ?? 0
    const offsetY = func.offsetY ?? 0
    const scaleY = func.scaleY ?? 1

    for (let i = 0; i <= numSamples; i++) {
        const x = minX + i * step
        try {
            const y = scaleY * evaluator(x - offsetX) + offsetY
            if (Number.isFinite(y)) {
                samples.push({ x, y })
            }
        } catch {
            // Skip invalid points
        }
    }

    return samples
}

/**
 * Sample a line segment at regular intervals within a domain.
 */
function sampleLineInDomain(
    line: GraphLine,
    minX: number,
    maxX: number,
    numSamples: number = 50
): { x: number; y: number }[] {
    const start = line.start.type === 'coord' ? { x: line.start.x, y: line.start.y } : { x: 0, y: 0 }
    const end = line.end.type === 'coord' ? { x: line.end.x, y: line.end.y } : { x: 0, y: 0 }

    const samples: { x: number; y: number }[] = []
    const step = (maxX - minX) / numSamples
    const dx = end.x - start.x
    const dy = end.y - start.y

    for (let i = 0; i <= numSamples; i++) {
        const x = minX + i * step
        // Linear interpolation
        const t = dx !== 0 ? (x - start.x) / dx : 0
        const y = start.y + t * dy
        samples.push({ x, y })
    }

    return samples
}

/**
 * Find the function closest to a point and evaluate it at that x.
 */
function findNearestFunction(
    point: { x: number; y: number },
    functions: GraphFunction[]
): { func: GraphFunction; distance: number; y: number } | null {
    let nearest: { func: GraphFunction; distance: number; y: number } | null = null

    for (const func of functions) {
        const evaluator = compileExpression(func.expression)
        if (!evaluator) continue

        try {
            const offsetX = func.offsetX ?? 0
            const offsetY = func.offsetY ?? 0
            const scaleY = func.scaleY ?? 1
            const y = scaleY * evaluator(point.x - offsetX) + offsetY
            if (!Number.isFinite(y)) continue

            const distance = Math.abs(point.y - y)
            if (!nearest || distance < nearest.distance) {
                nearest = { func, distance, y }
            }
        } catch {
            continue
        }
    }

    return nearest
}

/**
 * Find the line closest to a point.
 */
function findNearestLine(
    point: { x: number; y: number },
    lines: GraphLine[]
): { line: GraphLine; distance: number } | null {
    let nearest: { line: GraphLine; distance: number } | null = null

    for (const line of lines) {
        const start = line.start.type === 'coord' ? { x: line.start.x, y: line.start.y } : { x: 0, y: 0 }
        const end = line.end.type === 'coord' ? { x: line.end.x, y: line.end.y } : { x: 0, y: 0 }

        const dx = end.x - start.x
        const dy = end.y - start.y

        // Calculate perpendicular distance from point to line
        if (Math.abs(dx) < 0.001) {
            // Vertical line
            const distance = Math.abs(point.x - start.x)
            if (!nearest || distance < nearest.distance) {
                nearest = { line, distance }
            }
        } else {
            // Non-vertical line: compute closest point on line
            const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)))
            const closestX = start.x + t * dx
            const closestY = start.y + t * dy
            const distance = Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2)

            if (!nearest || distance < nearest.distance) {
                nearest = { line, distance }
            }
        }
    }

    return nearest
}

/**
 * Check if a line is vertical
 */
function isVerticalLine(line: GraphLine): boolean {
    if (line.start.type !== 'coord' || line.end.type !== 'coord') return false
    return Math.abs(line.start.x - line.end.x) < 0.001
}

/**
 * Get visible axes as boundary elements.
 * Note: Axes are NOT automatically treated as boundaries.
 * They only become boundaries when explicitly included in boundaryIds or when
 * using "under-function" mode (which implies x-axis as floor).
 */
function getVisibleAxes(axes: GraphAxes): Array<{ type: 'axis'; axis: 'x' | 'y'; value: number }> {
    // Return empty - axes are no longer automatic boundaries
    // Users can add them explicitly via the extend panel if needed
    return []
}

/**
 * Check if a line (segment) is horizontal
 */
function isHorizontalLine(line: GraphLine): boolean {
    if (line.start.type !== 'coord' || line.end.type !== 'coord') return false
    return Math.abs(line.start.y - line.end.y) < 0.001
}

/**
 * Get line Y value at a given X (for non-vertical lines)
 */
function getLineYAtX(line: GraphLine, x: number): number | null {
    if (line.start.type !== 'coord' || line.end.type !== 'coord') return null
    const { x: x1, y: y1 } = line.start
    const { x: x2, y: y2 } = line.end

    const dx = x2 - x1
    if (Math.abs(dx) < 0.001) return null // Vertical line

    const t = (x - x1) / dx

    // Check if x is within segment bounds (with small tolerance)
    if (line.kind === 'segment' && (t < -0.01 || t > 1.01)) return null
    if (line.kind === 'ray' && t < -0.01) return null

    return y1 + t * (y2 - y1)
}

/**
 * Check if a point is inside a line segment's bounding box (with margin)
 */
function isPointNearSegment(point: { x: number; y: number }, line: GraphLine, margin: number = 0.5): boolean {
    if (line.start.type !== 'coord' || line.end.type !== 'coord') return false
    const minX = Math.min(line.start.x, line.end.x) - margin
    const maxX = Math.max(line.start.x, line.end.x) + margin
    const minY = Math.min(line.start.y, line.end.y) - margin
    const maxY = Math.max(line.start.y, line.end.y) + margin
    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
}

/**
 * Determine which side of a line a point is on.
 * Returns positive if point is on the "left" side, negative if on "right", 0 if on line.
 */
function pointLineSide(point: { x: number; y: number }, lineStart: { x: number; y: number }, lineEnd: { x: number; y: number }): number {
    return (lineEnd.x - lineStart.x) * (point.y - lineStart.y) - (lineEnd.y - lineStart.y) * (point.x - lineStart.x)
}

/**
 * Find intersection point of two line segments
 */
function segmentIntersection(
    p1: { x: number; y: number }, p2: { x: number; y: number },
    p3: { x: number; y: number }, p4: { x: number; y: number }
): { x: number; y: number } | null {
    const d1x = p2.x - p1.x
    const d1y = p2.y - p1.y
    const d2x = p4.x - p3.x
    const d2y = p4.y - p3.y

    const denom = d1x * d2y - d1y * d2x
    if (Math.abs(denom) < 0.0001) return null // Parallel

    const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom
    const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom

    // Check if intersection is within both segments
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            x: p1.x + t * d1x,
            y: p1.y + t * d1y
        }
    }
    return null
}

/**
 * Clip a polygon by line segments - keeps the portion containing dropPoint.
 * Uses Sutherland-Hodgman-like algorithm for each segment.
 */
function clipPolygonBySegments(
    polygon: Array<{ x: number; y: number }>,
    segments: GraphLine[],
    dropPoint: { x: number; y: number }
): Array<{ x: number; y: number }> {
    if (polygon.length < 3) return polygon

    let currentPolygon = [...polygon]

    for (const segment of segments) {
        if (segment.start.type !== 'coord' || segment.end.type !== 'coord') continue
        if (isVerticalLine(segment)) continue // Vertical lines are handled separately

        const lineStart = { x: segment.start.x, y: segment.start.y }
        const lineEnd = { x: segment.end.x, y: segment.end.y }

        // Determine which side the drop point is on
        const dropSide = pointLineSide(dropPoint, lineStart, lineEnd)
        if (Math.abs(dropSide) < 0.01) continue // Point is on the line, skip

        // Clip polygon to keep only the side containing dropPoint
        const clipped: Array<{ x: number; y: number }> = []

        for (let i = 0; i < currentPolygon.length; i++) {
            const current = currentPolygon[i]
            const next = currentPolygon[(i + 1) % currentPolygon.length]

            const currentSide = pointLineSide(current, lineStart, lineEnd)
            const nextSide = pointLineSide(next, lineStart, lineEnd)

            const currentInside = (currentSide >= 0) === (dropSide >= 0) || Math.abs(currentSide) < 0.01
            const nextInside = (nextSide >= 0) === (dropSide >= 0) || Math.abs(nextSide) < 0.01

            if (currentInside) {
                clipped.push(current)
            }

            // Check for intersection if crossing the line
            if ((currentInside && !nextInside) || (!currentInside && nextInside)) {
                // Find intersection with the clip line (extended as infinite line)
                const intersection = segmentIntersection(current, next, lineStart, lineEnd)
                if (intersection) {
                    clipped.push(intersection)
                }
            }
        }

        if (clipped.length < 3) {
            // Clipping removed everything, return original polygon
            return polygon
        }

        currentPolygon = clipped
    }

    return currentPolygon
}

/**
 * Resolve anchor x coordinate
 */
function resolveAnchorX(anchor: GraphAnchor): number {
    return anchor.type === 'coord' ? anchor.x : 0
}

/**
 * Resolve anchor y coordinate
 */
function resolveAnchorY(anchor: GraphAnchor): number {
    return anchor.type === 'coord' ? anchor.y : 0
}

/**
 * Generate polygon points for area between line and function.
 */
function generatePolygonBetweenLineAndFunction(
    func: GraphFunction,
    line: GraphLine,
    minX: number,
    maxX: number
): GraphAnchor[] {
    const funcSamples = sampleFunctionInDomain(func, minX, maxX, 60)
    const lineSamples = sampleLineInDomain(line, minX, maxX, 60)

    if (funcSamples.length === 0 || lineSamples.length === 0) return []

    // Create polygon: function points forward, then line points backward
    const points: GraphAnchor[] = []

    // Add function samples
    for (const pt of funcSamples) {
        points.push({ type: 'coord', x: pt.x, y: pt.y })
    }

    // Add line samples in reverse
    for (let i = lineSamples.length - 1; i >= 0; i--) {
        points.push({ type: 'coord', x: lineSamples[i].x, y: lineSamples[i].y })
    }

    return points
}

/**
 * Generate polygon points for area under function (to y=0).
 */
function generatePolygonUnderFunction(
    func: GraphFunction,
    minX: number,
    maxX: number
): GraphAnchor[] {
    const funcSamples = sampleFunctionInDomain(func, minX, maxX, 60)

    if (funcSamples.length === 0) return []

    const points: GraphAnchor[] = []

    // Start at y=0
    points.push({ type: 'coord', x: minX, y: 0 })

    // Add function samples
    for (const pt of funcSamples) {
        points.push({ type: 'coord', x: pt.x, y: pt.y })
    }

    // End at y=0
    points.push({ type: 'coord', x: maxX, y: 0 })

    return points
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
}) => {
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

        // Collect ALL potential boundaries (functions + lines + visible axes)
        const nearbyFuncs = functions
            .map(fn => {
                const nearest = findNearestFunction({ x: newPos.x, y: newPos.y }, [fn])
                return nearest ? { type: 'function' as const, element: fn, distance: nearest.distance, y: nearest.y } : null
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)

        const nearbyLines = lines
            .map(ln => {
                const nearest = findNearestLine({ x: newPos.x, y: newPos.y }, [ln])
                return nearest ? { type: 'line' as const, element: ln, distance: nearest.distance } : null
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)

        // Add visible axes as implicit boundaries
        const visibleAxes = getVisibleAxes(axes)
        const nearbyAxes = visibleAxes
            .map(ax => {
                // Distance to x-axis (y=0) is |newPos.y|
                // Distance to y-axis (x=0) is |newPos.x|
                const distance = ax.axis === 'x' ? Math.abs(newPos.y) : Math.abs(newPos.x)
                return { ...ax, distance }
            })

        // Merge and sort by distance
        type BoundaryWithDistance =
            | { type: 'function'; element: GraphFunction; distance: number; y: number }
            | { type: 'line'; element: GraphLine; distance: number }
            | { type: 'axis'; axis: 'x' | 'y'; value: number; distance: number }

        const allBoundaries: BoundaryWithDistance[] = ([
            ...nearbyFuncs,
            ...nearbyLines,
            ...nearbyAxes
        ] as BoundaryWithDistance[]).sort((a, b) => a.distance - b.distance)

        // Filter out ignoredBoundaries (for extend mode)
        const activeBoundaries = allBoundaries.filter(b => {
            // For axes, use synthetic IDs like 'x-axis' or 'y-axis'
            const id = b.type === 'axis' ? `${b.axis}-axis` : b.element.id
            return !area.ignoredBoundaries?.includes(id)
        })

        const threshold = 3.0 // Graph units

        // PRIORITY 1: Two functions (most common case)
        const closeFuncs = activeBoundaries
            .filter((b): b is Extract<typeof b, { type: 'function' }> => b.type === 'function' && b.distance < threshold)
            .slice(0, 2)

        // Get ALL nearby lines (segments) - not just vertical ones
        const nearbyLineElements = activeBoundaries
            .filter((b): b is Extract<typeof b, { type: 'line' }> => b.type === 'line' && b.distance < threshold)
            .map(b => b.element)

        if (closeFuncs.length >= 2) {
            const func1 = closeFuncs[0].element
            const func2 = closeFuncs[1].element

            // Find intersections between the two functions
            const intersections = findFunctionIntersections(
                func1.expression,
                func2.expression,
                axes.xMin,
                axes.xMax
            )

            // Vertical lines limit the domain
            const nearbyVerticalLines = nearbyLineElements.filter(ln => isVerticalLine(ln))

            let domainMin = axes.xMin
            let domainMax = axes.xMax

            // Vertical lines can limit the domain
            for (const vLine of nearbyVerticalLines) {
                const lineX = resolveAnchorX(vLine.start)
                if (lineX < newPos.x && lineX > domainMin) domainMin = lineX
                if (lineX > newPos.x && lineX < domainMax) domainMax = lineX
            }

            if (intersections.length >= 2) {
                // Find the domain containing drop point
                for (let i = 0; i < intersections.length - 1; i++) {
                    if (newPos.x >= intersections[i] && newPos.x <= intersections[i + 1]) {
                        domainMin = Math.max(domainMin, intersections[i])
                        domainMax = Math.min(domainMax, intersections[i + 1])
                        break
                    }
                }
            }

            // Generate polygon between curves
            const polygon = generatePolygonBetweenCurves(func1, func2, domainMin, domainMax, 60)

            // Apply non-vertical segment boundaries as clipping
            const clippedPolygon = clipPolygonBySegments(polygon, nearbyLineElements, newPos)

            if (clippedPolygon.length >= 3) {
                const newPoints: GraphAnchor[] = clippedPolygon.map((pt: { x: number; y: number }) => ({
                    type: 'coord' as const,
                    x: pt.x,
                    y: pt.y
                }))

                const boundaryIds = [func1.id, func2.id, ...nearbyLineElements.map(l => l.id)]

                onUpdate({
                    ...area,
                    mode: 'between-functions',
                    functionId: func1.id,
                    functionId2: func2.id,
                    boundaryIds,
                    domain: { min: domainMin, max: domainMax },
                    points: newPoints,
                    labelPos: newPos
                })
                setDragPos(null)
                return
            }
        }

        // PRIORITY 2: Function + Line segments
        const closeFunc = activeBoundaries.find((b): b is Extract<typeof b, { type: 'function' }> => b.type === 'function' && b.distance < threshold)

        if (closeFunc && nearbyLineElements.length > 0) {
            const func = closeFunc.element

            // Check for horizontal segment as lower/upper bound
            const horizontalLine = nearbyLineElements.find(ln => isHorizontalLine(ln))
            const verticalLines = nearbyLineElements.filter(ln => isVerticalLine(ln))

            let polygon: Array<{ x: number; y: number }> = []

            if (horizontalLine && horizontalLine.start.type === 'coord') {
                // Area between function and horizontal line
                const lineY = horizontalLine.start.y
                let minX = axes.xMin
                let maxX = axes.xMax

                // Vertical lines limit domain
                for (const vLine of verticalLines) {
                    const lineX = resolveAnchorX(vLine.start)
                    if (lineX < newPos.x && lineX > minX) minX = lineX
                    if (lineX > newPos.x && lineX < maxX) maxX = lineX
                }

                // Sample function in domain
                const samples = sampleFunctionInDomain(func, minX, maxX, 60)
                if (samples.length >= 2) {
                    polygon = [
                        ...samples,
                        { x: maxX, y: lineY },
                        { x: minX, y: lineY }
                    ]
                }
            } else if (verticalLines.length > 0) {
                // Area bounded by function and vertical lines
                let minX = axes.xMin
                let maxX = axes.xMax

                for (const vLine of verticalLines) {
                    const lineX = resolveAnchorX(vLine.start)
                    if (lineX < newPos.x && lineX > minX) minX = lineX
                    if (lineX > newPos.x && lineX < maxX) maxX = lineX
                }

                const samples = sampleFunctionInDomain(func, minX, maxX, 60)
                if (samples.length >= 2) {
                    // Close with y=0 as default floor
                    polygon = [
                        ...samples,
                        { x: maxX, y: 0 },
                        { x: minX, y: 0 }
                    ]
                }
            } else {
                // Non-vertical, non-horizontal segments - clip function polygon
                const samples = sampleFunctionInDomain(func, axes.xMin, axes.xMax, 60)
                if (samples.length >= 2) {
                    const minX = samples[0].x
                    const maxX = samples[samples.length - 1].x
                    polygon = [
                        ...samples,
                        { x: maxX, y: 0 },
                        { x: minX, y: 0 }
                    ]
                }
            }

            // Apply segment clipping for diagonal segments
            const clippedPolygon = clipPolygonBySegments(polygon, nearbyLineElements, newPos)

            if (clippedPolygon.length >= 3) {
                const boundaryIds = [func.id, ...nearbyLineElements.map(l => l.id)]

                onUpdate({
                    ...area,
                    mode: 'between-line-and-function',
                    functionId: func.id,
                    lineId: nearbyLineElements[0]?.id,
                    boundaryIds,
                    points: clippedPolygon.map((pt: { x: number; y: number }) => ({ type: 'coord' as const, x: pt.x, y: pt.y })),
                    labelPos: newPos
                })
                setDragPos(null)
                return
            }
        }

        // PRIORITY 3: Single function without lines - just create a local area around drop point
        // Note: This does NOT automatically use x-axis as boundary
        const singleFunc = activeBoundaries.find((b): b is Extract<typeof b, { type: 'function' }> => b.type === 'function' && b.distance < threshold)
        if (singleFunc) {
            const func = singleFunc.element
            const DOMAIN_HALF = 2.5
            const minX = newPos.x - DOMAIN_HALF
            const maxX = newPos.x + DOMAIN_HALF

            // Sample the function to create a basic polygon
            const samples = sampleFunctionInDomain(func, minX, maxX, 60)

            if (samples.length >= 2) {
                // Create a simple closed polygon (function + flat bottom at lowest point)
                const minY = Math.min(...samples.map(s => s.y), newPos.y - 1)
                const newPoints: GraphAnchor[] = [
                    ...samples.map(pt => ({ type: 'coord' as const, x: pt.x, y: pt.y })),
                    { type: 'coord' as const, x: maxX, y: minY },
                    { type: 'coord' as const, x: minX, y: minY }
                ]

                onUpdate({
                    ...area,
                    mode: 'under-function',
                    functionId: func.id,
                    boundaryIds: [func.id],
                    domain: { min: minX, max: maxX },
                    points: newPoints,
                    labelPos: newPos
                })
                setDragPos(null)
                return
            }
        }

        // No valid polygon generated, just move the control point
        onUpdate({
            ...area,
            labelPos: newPos,
        })

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

    // Calculate boundary button positions (only when selected)
    const boundaryButtons = useMemo(() => {
        if (!isSelected || !area.boundaryIds || area.boundaryIds.length === 0) return []

        const buttons: Array<{
            id: string
            x: number
            y: number
            isExtended: boolean
            label: string
        }> = []

        const centroid = outline.length > 0
            ? outline.reduce((acc, pt) => ({ x: acc.x + pt.x / outline.length, y: acc.y + pt.y / outline.length }), { x: 0, y: 0 })
            : controlPoint

        // For each boundary, find a position on the edge of the polygon
        for (const boundaryId of area.boundaryIds) {
            const isExtended = area.ignoredBoundaries?.includes(boundaryId) || false

            // Find the corresponding element
            const func = functions.find(f => f.id === boundaryId)
            const line = lines.find(l => l.id === boundaryId)

            let buttonPos = { x: centroid.x, y: centroid.y }
            let label = ''

            if (func) {
                // Position button at the function curve, offset from centroid
                const evaluator = compileExpression(func.expression)
                if (evaluator) {
                    const offsetX = func.offsetX ?? 0
                    const offsetY = func.offsetY ?? 0
                    const scaleY = func.scaleY ?? 1
                    try {
                        const yAtCentroid = scaleY * evaluator(centroid.x - offsetX) + offsetY
                        if (Number.isFinite(yAtCentroid)) {
                            // Position between centroid and curve
                            buttonPos = {
                                x: centroid.x,
                                y: (centroid.y + yAtCentroid) / 2
                            }
                        }
                    } catch { /* ignore */ }
                }
                label = func.label || `f(x)`
            } else if (line && line.start.type === 'coord' && line.end.type === 'coord') {
                // Position button at the midpoint of the line segment
                const midX = (line.start.x + line.end.x) / 2
                const midY = (line.start.y + line.end.y) / 2

                // Move slightly toward centroid
                buttonPos = {
                    x: midX + (centroid.x - midX) * 0.3,
                    y: midY + (centroid.y - midY) * 0.3
                }
                label = line.label || 'segment'
            }

            // Convert to pixels
            const pixel = graphToPixel(buttonPos, axes, width, height)

            buttons.push({
                id: boundaryId,
                x: pixel.x,
                y: pixel.y,
                isExtended,
                label
            })
        }

        return buttons
    }, [isSelected, area.boundaryIds, area.ignoredBoundaries, outline, controlPoint, functions, lines, axes, width, height])

    // Track if we need to re-detect after boundary toggle
    const pendingRedetectRef = useRef<string[] | null>(null)

    // Handle extend/collapse button click
    const handleBoundaryToggle = useCallback((boundaryId: string) => {
        const isCurrentlyExtended = area.ignoredBoundaries?.includes(boundaryId) || false

        const newIgnored = isCurrentlyExtended
            ? (area.ignoredBoundaries || []).filter(id => id !== boundaryId)
            : [...(area.ignoredBoundaries || []), boundaryId]

        // Store new ignored boundaries for re-detection
        pendingRedetectRef.current = newIgnored

        // First update ignoredBoundaries
        onUpdate({
            ...area,
            ignoredBoundaries: newIgnored
        })
    }, [area, onUpdate])

    // Re-detect area when ignoredBoundaries changes via toggle
    useEffect(() => {
        if (!pendingRedetectRef.current) return

        const newIgnored = pendingRedetectRef.current
        pendingRedetectRef.current = null

        // Re-run detection logic with current position
        const pos = controlPoint
        const threshold = 3.0

        // Get nearby functions
        const nearbyFuncs = functions
            .map(fn => {
                const nearest = findNearestFunction({ x: pos.x, y: pos.y }, [fn])
                return nearest ? { type: 'function' as const, element: fn, distance: nearest.distance, y: nearest.y } : null
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)

        // Get nearby lines
        const nearbyLines = lines
            .map(ln => {
                const nearest = findNearestLine({ x: pos.x, y: pos.y }, [ln])
                return nearest ? { type: 'line' as const, element: ln, distance: nearest.distance } : null
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)

        // Filter out ignored boundaries
        const activeFuncs = nearbyFuncs.filter(b => !newIgnored.includes(b.element.id))
        const activeLines = nearbyLines.filter(b => !newIgnored.includes(b.element.id))

        const closeFuncs = activeFuncs
            .filter(b => b.distance < threshold)
            .slice(0, 2)

        const nearbyLineElements = activeLines
            .filter(b => b.distance < threshold)
            .map(b => b.element)

        // Re-generate polygon based on active boundaries
        if (closeFuncs.length >= 2) {
            const func1 = closeFuncs[0].element
            const func2 = closeFuncs[1].element

            const intersections = findFunctionIntersections(
                func1.expression,
                func2.expression,
                axes.xMin,
                axes.xMax
            )

            const nearbyVerticalLines = nearbyLineElements.filter(ln => isVerticalLine(ln))

            let domainMin = axes.xMin
            let domainMax = axes.xMax

            for (const vLine of nearbyVerticalLines) {
                const lineX = resolveAnchorX(vLine.start)
                if (lineX < pos.x && lineX > domainMin) domainMin = lineX
                if (lineX > pos.x && lineX < domainMax) domainMax = lineX
            }

            if (intersections.length >= 2) {
                for (let i = 0; i < intersections.length - 1; i++) {
                    if (pos.x >= intersections[i] && pos.x <= intersections[i + 1]) {
                        domainMin = Math.max(domainMin, intersections[i])
                        domainMax = Math.min(domainMax, intersections[i + 1])
                        break
                    }
                }
            }

            const polygon = generatePolygonBetweenCurves(func1, func2, domainMin, domainMax, 60)
            const clippedPolygon = clipPolygonBySegments(polygon, nearbyLineElements, pos)

            if (clippedPolygon.length >= 3) {
                const newPoints: GraphAnchor[] = clippedPolygon.map((pt: { x: number; y: number }) => ({
                    type: 'coord' as const,
                    x: pt.x,
                    y: pt.y
                }))

                // Include ALL nearby boundaries (not just active ones) in boundaryIds
                const allNearbyIds = [
                    ...nearbyFuncs.filter(b => b.distance < threshold).map(b => b.element.id),
                    ...nearbyLines.filter(b => b.distance < threshold).map(b => b.element.id)
                ]

                onUpdate({
                    ...area,
                    mode: 'between-functions',
                    functionId: func1.id,
                    functionId2: func2.id,
                    boundaryIds: allNearbyIds,
                    domain: { min: domainMin, max: domainMax },
                    points: newPoints,
                    ignoredBoundaries: newIgnored
                })
            }
        }
    }, [area.ignoredBoundaries])

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

            {/* Boundary extend/collapse buttons (only when selected) */}
            {isSelected && boundaryButtons.map(btn => (
                <Group key={btn.id} x={btn.x} y={btn.y}>
                    {/* Button background */}
                    <Circle
                        radius={14}
                        fill={btn.isExtended ? '#ef4444' : '#22c55e'}
                        stroke="white"
                        strokeWidth={2}
                        shadowColor="black"
                        shadowBlur={4}
                        shadowOpacity={0.3}
                        onClick={() => handleBoundaryToggle(btn.id)}
                        onTap={() => handleBoundaryToggle(btn.id)}
                    />
                    {/* Plus or Minus symbol */}
                    <KonvaText
                        text={btn.isExtended ? '−' : '+'}
                        fontSize={18}
                        fontStyle="bold"
                        fill="white"
                        align="center"
                        verticalAlign="middle"
                        width={28}
                        height={28}
                        offsetX={14}
                        offsetY={14}
                        listening={false}
                    />
                </Group>
            ))}
        </Group>
    )
})

EditableArea.displayName = 'EditableArea'
