'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { Line, Group, Circle } from 'react-konva'
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
 * Get visible axes as boundary elements
 */
function getVisibleAxes(axes: GraphAxes): Array<{ type: 'axis'; axis: 'x' | 'y'; value: number }> {
    const result: Array<{ type: 'axis'; axis: 'x' | 'y'; value: number }> = []

    // X-axis (y=0) is visible if yMin <= 0 <= yMax
    if (axes.yMin <= 0 && axes.yMax >= 0) {
        result.push({ type: 'axis', axis: 'x', value: 0 })
    }

    // Y-axis (x=0) is visible if xMin <= 0 <= xMax
    if (axes.xMin <= 0 && axes.xMax >= 0) {
        result.push({ type: 'axis', axis: 'y', value: 0 })
    }

    return result
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

            // Also check for line boundaries that might limit domain
            const nearbyVerticalLines = activeBoundaries
                .filter((b): b is Extract<typeof b, { type: 'line' }> => b.type === 'line' && b.distance < threshold)
                .map(b => b.element)
                .filter(ln => isVerticalLine(ln))

            // Check for y-axis as boundary
            const yAxisBoundary = activeBoundaries.find((b): b is Extract<typeof b, { type: 'axis' }> => b.type === 'axis' && b.axis === 'y' && b.distance < threshold)

            let domainMin = axes.xMin
            let domainMax = axes.xMax

            // Vertical lines can limit the domain
            for (const vLine of nearbyVerticalLines) {
                const lineX = resolveAnchorX(vLine.start)
                if (lineX < newPos.x && lineX > domainMin) domainMin = lineX
                if (lineX > newPos.x && lineX < domainMax) domainMax = lineX
            }

            // Y-axis (x=0) can also limit domain
            if (yAxisBoundary) {
                if (0 < newPos.x && 0 > domainMin) domainMin = 0
                if (0 > newPos.x && 0 < domainMax) domainMax = 0
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

            // Generate polygon
            const polygon = generatePolygonBetweenCurves(func1, func2, domainMin, domainMax, 60)

            if (polygon.length >= 3) {
                const newPoints: GraphAnchor[] = polygon.map((pt: { x: number; y: number }) => ({
                    type: 'coord' as const,
                    x: pt.x,
                    y: pt.y
                }))

                const boundaryIds = [func1.id, func2.id, ...nearbyVerticalLines.map(l => l.id)]
                if (yAxisBoundary) boundaryIds.push('y-axis')

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

        // PRIORITY 2: Function + Line(s) or Function + Axis
        const closeFunc = activeBoundaries.find((b): b is Extract<typeof b, { type: 'function' }> => b.type === 'function' && b.distance < threshold)
        const closeLine = activeBoundaries.find((b): b is Extract<typeof b, { type: 'line' }> => b.type === 'line' && b.distance < threshold)
        const closeAxis = activeBoundaries.find((b): b is Extract<typeof b, { type: 'axis' }> => b.type === 'axis' && b.distance < threshold)

        if (closeFunc && (closeLine || closeAxis)) {
            const func = closeFunc.element

            // Build boundary elements array for generatePolygonBoundedByElements
            const boundaries: BoundaryElement[] = [{ type: 'function', element: func }]

            if (closeLine) {
                boundaries.push({ type: 'line', element: closeLine.element })
            }
            if (closeAxis) {
                boundaries.push({ type: 'axis', axis: closeAxis.axis, value: closeAxis.value })
            }

            // Generate polygon bounded by elements (with axes parameter)
            const polygon = generatePolygonBoundedByElements(boundaries, newPos, axes)

            if (polygon.length >= 3) {
                const boundaryIds = [func.id]
                if (closeLine) boundaryIds.push(closeLine.element.id)
                if (closeAxis) boundaryIds.push(`${closeAxis.axis}-axis`)

                onUpdate({
                    ...area,
                    mode: closeAxis && !closeLine ? 'under-function' : 'between-line-and-function',
                    functionId: func.id,
                    lineId: closeLine ? closeLine.element.id : undefined,
                    boundaryIds,
                    points: polygon.map((pt: { x: number; y: number }) => ({ type: 'coord' as const, x: pt.x, y: pt.y })),
                    labelPos: newPos
                })
                setDragPos(null)
                return
            }
        }

        // PRIORITY 3: Under single function (fallback - use x-axis as implicit boundary when visible)
        if (closeFunc) {
            const func = closeFunc.element
            const DOMAIN_HALF = 2.5
            const minX = newPos.x - DOMAIN_HALF
            const maxX = newPos.x + DOMAIN_HALF
            const newPoints = generatePolygonUnderFunction(func, minX, maxX)

            if (newPoints.length >= 3) {
                onUpdate({
                    ...area,
                    mode: 'under-function',
                    functionId: func.id,
                    boundaryIds: [func.id, 'x-axis'],
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
        </Group>
    )
})

EditableArea.displayName = 'EditableArea'
