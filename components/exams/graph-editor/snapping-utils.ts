import { GraphLine, GraphCurve, GraphFunction, GraphAnchor, GraphPointAnchor } from '@/types/exams'
import { compileExpression } from '@/components/exams/graph-utils'

export type Coord = { x: number; y: number }

/**
 * Snap thresholds in graph units
 */
export const SNAP_THRESHOLDS = {
    line: 0.25,
    curve: 0.30,
    function: 0.30,
}

/**
 * Result of finding the closest point on an element
 */
export interface SnapResult {
    coord: Coord
    distance: number
}

/**
 * A snap target that a point can anchor to
 */
export interface SnapTarget {
    type: 'line' | 'curve' | 'function'
    elementId: string
    coord: Coord
    distance: number
    anchor: GraphPointAnchor
}

/**
 * Graph payload subset needed for snapping
 */
export interface SnapPayload {
    lines: GraphLine[]
    curves: GraphCurve[]
    functions: GraphFunction[]
}

/**
 * Get coordinate from a graph anchor
 */
function getAnchorCoord(anchor: GraphAnchor): Coord {
    if (anchor.type === 'coord') {
        return { x: anchor.x, y: anchor.y }
    }
    // For point anchors, we'd need the full payload - return origin as fallback
    return { x: 0, y: 0 }
}

/**
 * Find the closest point on a line segment, ray, or infinite line to a given point.
 * Returns the closest point, parameter t, and distance.
 *
 * For segment: t is clamped to [0, 1]
 * For ray: t is clamped to [0, infinity)
 * For line: t is unclamped
 */
export function findClosestPointOnLine(
    point: Coord,
    lineStart: Coord,
    lineEnd: Coord,
    kind: 'segment' | 'line' | 'ray'
): { coord: Coord; t: number; distance: number } | null {
    const dx = lineEnd.x - lineStart.x
    const dy = lineEnd.y - lineStart.y
    const lenSq = dx * dx + dy * dy

    // Degenerate line (start == end)
    if (lenSq < 1e-10) {
        const dist = Math.sqrt(
            (point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2
        )
        return { coord: lineStart, t: 0, distance: dist }
    }

    // Calculate t parameter (projection onto line)
    let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq

    // Clamp t based on line kind
    if (kind === 'segment') {
        t = Math.max(0, Math.min(1, t))
    } else if (kind === 'ray') {
        t = Math.max(0, t)
    }
    // For 'line', t is unclamped

    const closestX = lineStart.x + t * dx
    const closestY = lineStart.y + t * dy

    const distance = Math.sqrt(
        (point.x - closestX) ** 2 + (point.y - closestY) ** 2
    )

    return {
        coord: { x: closestX, y: closestY },
        t,
        distance,
    }
}

/**
 * Find the closest point on a quadratic Bezier curve to a given point.
 * Uses Newton's method to minimize distance.
 *
 * Curve equation: B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
 * where P₀ = start, P₁ = control, P₂ = end
 */
export function findClosestPointOnCurve(
    point: Coord,
    start: Coord,
    control: Coord,
    end: Coord
): { coord: Coord; t: number; distance: number } | null {
    // Evaluate curve at parameter t
    const evalCurve = (t: number): Coord => {
        const u = 1 - t
        return {
            x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
            y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
        }
    }

    // Derivative of curve
    const evalDerivative = (t: number): Coord => {
        const u = 1 - t
        return {
            x: 2 * (t - 1) * start.x + 2 * (1 - 2 * t) * control.x + 2 * t * end.x,
            y: 2 * (t - 1) * start.y + 2 * (1 - 2 * t) * control.y + 2 * t * end.y,
        }
    }

    // Distance squared from point to curve at t
    const distSq = (t: number): number => {
        const c = evalCurve(t)
        return (point.x - c.x) ** 2 + (point.y - c.y) ** 2
    }

    // Sample curve to find initial guess
    let bestT = 0
    let bestDistSq = Infinity
    const samples = 20
    for (let i = 0; i <= samples; i++) {
        const t = i / samples
        const d = distSq(t)
        if (d < bestDistSq) {
            bestDistSq = d
            bestT = t
        }
    }

    // Refine with Newton's method (minimizing distance squared)
    // We want to find t where d/dt(distSq) = 0
    for (let iter = 0; iter < 5; iter++) {
        const c = evalCurve(bestT)
        const dc = evalDerivative(bestT)

        // Gradient of distance squared with respect to t
        const grad = 2 * ((c.x - point.x) * dc.x + (c.y - point.y) * dc.y)

        if (Math.abs(grad) < 1e-10) break

        // Simple gradient descent step
        let step = -grad * 0.1
        let newT = Math.max(0, Math.min(1, bestT + step))

        // Only accept if it improves
        if (distSq(newT) < bestDistSq) {
            bestT = newT
            bestDistSq = distSq(newT)
        }
    }

    const closest = evalCurve(bestT)
    return {
        coord: closest,
        t: bestT,
        distance: Math.sqrt(bestDistSq),
    }
}

/**
 * Find the closest point on a function curve to a given point.
 * Searches within the function's domain.
 */
export function findClosestPointOnFunction(
    point: Coord,
    expression: string,
    domain: { min: number; max: number },
    offsetX: number = 0,
    offsetY: number = 0,
    scaleY: number = 1
): { coord: Coord; x: number; distance: number } | null {
    const evaluator = compileExpression(expression)
    if (!evaluator) return null

    const evalFunction = (x: number): number | null => {
        try {
            const y = scaleY * evaluator(x - offsetX) + offsetY
            return Number.isFinite(y) ? y : null
        } catch {
            return null
        }
    }

    // Sample function to find initial guess
    let bestX = domain.min
    let bestDistSq = Infinity
    const samples = 50
    const step = (domain.max - domain.min) / samples

    for (let i = 0; i <= samples; i++) {
        const x = domain.min + i * step
        const y = evalFunction(x)
        if (y === null) continue

        const distSq = (point.x - x) ** 2 + (point.y - y) ** 2
        if (distSq < bestDistSq) {
            bestDistSq = distSq
            bestX = x
        }
    }

    // Refine with golden section search
    let left = Math.max(domain.min, bestX - step)
    let right = Math.min(domain.max, bestX + step)
    const phi = (1 + Math.sqrt(5)) / 2
    const resphi = 2 - phi

    let x1 = left + resphi * (right - left)
    let x2 = right - resphi * (right - left)

    const getDistSq = (x: number): number => {
        const y = evalFunction(x)
        if (y === null) return Infinity
        return (point.x - x) ** 2 + (point.y - y) ** 2
    }

    let f1 = getDistSq(x1)
    let f2 = getDistSq(x2)

    for (let iter = 0; iter < 15; iter++) {
        if (f1 < f2) {
            right = x2
            x2 = x1
            f2 = f1
            x1 = left + resphi * (right - left)
            f1 = getDistSq(x1)
        } else {
            left = x1
            x1 = x2
            f1 = f2
            x2 = right - resphi * (right - left)
            f2 = getDistSq(x2)
        }
    }

    bestX = (x1 + x2) / 2
    const bestY = evalFunction(bestX)
    if (bestY === null) return null

    return {
        coord: { x: bestX, y: bestY },
        x: bestX,
        distance: Math.sqrt(getDistSq(bestX)),
    }
}

/**
 * Calculate control point for a curve given start, end, and curvature.
 */
function calculateCurveControl(start: Coord, end: Coord, curvature: number): Coord {
    const midX = (start.x + end.x) / 2
    const midY = (start.y + end.y) / 2
    const dx = end.x - start.x
    const dy = end.y - start.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const normalX = -dy / len
    const normalY = dx / len
    return {
        x: midX + normalX * curvature,
        y: midY + normalY * curvature,
    }
}

/**
 * Find the nearest element to snap to from the given point.
 * Returns the best snap target if one is within threshold, otherwise null.
 */
export function findNearestSnapTarget(
    point: Coord,
    payload: SnapPayload,
    thresholds: typeof SNAP_THRESHOLDS = SNAP_THRESHOLDS
): SnapTarget | null {
    let bestTarget: SnapTarget | null = null
    let bestDistance = Infinity

    // Check lines
    for (const line of payload.lines) {
        const start = getAnchorCoord(line.start)
        const end = getAnchorCoord(line.end)
        const result = findClosestPointOnLine(point, start, end, line.kind)

        if (result && result.distance < thresholds.line && result.distance < bestDistance) {
            bestDistance = result.distance
            bestTarget = {
                type: 'line',
                elementId: line.id,
                coord: result.coord,
                distance: result.distance,
                anchor: { type: 'line', lineId: line.id, t: result.t },
            }
        }
    }

    // Check curves
    for (const curve of payload.curves) {
        const start = getAnchorCoord(curve.start)
        const end = getAnchorCoord(curve.end)
        const control = calculateCurveControl(start, end, curve.curvature)
        const result = findClosestPointOnCurve(point, start, control, end)

        if (result && result.distance < thresholds.curve && result.distance < bestDistance) {
            bestDistance = result.distance
            bestTarget = {
                type: 'curve',
                elementId: curve.id,
                coord: result.coord,
                distance: result.distance,
                anchor: { type: 'curve', curveId: curve.id, t: result.t },
            }
        }
    }

    // Check functions
    for (const fn of payload.functions) {
        const domain = {
            min: fn.domain?.min ?? -10,
            max: fn.domain?.max ?? 10,
        }
        const result = findClosestPointOnFunction(
            point,
            fn.expression,
            domain,
            fn.offsetX ?? 0,
            fn.offsetY ?? 0,
            fn.scaleY ?? 1
        )

        if (result && result.distance < thresholds.function && result.distance < bestDistance) {
            bestDistance = result.distance
            bestTarget = {
                type: 'function',
                elementId: fn.id,
                coord: result.coord,
                distance: result.distance,
                anchor: { type: 'function', functionId: fn.id, x: result.x },
            }
        }
    }

    return bestTarget
}

/**
 * Check if a point is anchored to a specific element.
 */
export function isAnchoredTo(anchor: GraphPointAnchor | undefined, elementId: string): boolean {
    if (!anchor || anchor.type === 'coord') return false
    if (anchor.type === 'line') return anchor.lineId === elementId
    if (anchor.type === 'curve') return anchor.curveId === elementId
    if (anchor.type === 'function') return anchor.functionId === elementId
    return false
}
