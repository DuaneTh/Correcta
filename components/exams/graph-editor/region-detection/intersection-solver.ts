import { compileExpression } from '@/components/exams/graph-utils'
import type { GraphLine } from '@/types/exams'

/**
 * Bisection method for finding roots of a function
 */
function bisection(
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance: number = 0.0001,
  maxIterations: number = 50
): number | null {
  let fa = f(a)
  let fb = f(b)

  // Check for invalid values
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) {
    return null
  }

  // Check if same sign (no root between a and b)
  if (fa * fb > 0) {
    return null
  }

  // Bisection iterations
  for (let i = 0; i < maxIterations; i++) {
    const c = (a + b) / 2
    const fc = f(c)

    if (!Number.isFinite(fc)) {
      return null
    }

    if (Math.abs(fc) < tolerance || Math.abs(b - a) < tolerance) {
      return c
    }

    if (fa * fc < 0) {
      b = c
      fb = fc
    } else {
      a = c
      fa = fc
    }
  }

  return (a + b) / 2
}

/**
 * Find x-coordinates where two functions intersect within a domain
 */
export function findFunctionIntersections(
  expr1: string,
  expr2: string,
  xMin: number,
  xMax: number,
  tolerance: number = 0.0001
): number[] {
  const f1 = compileExpression(expr1)
  const f2 = compileExpression(expr2)

  if (!f1 || !f2) {
    return []
  }

  // Define h(x) = f1(x) - f2(x)
  const h = (x: number) => {
    const y1 = f1(x)
    const y2 = f2(x)
    if (!Number.isFinite(y1) || !Number.isFinite(y2)) {
      return NaN
    }
    return y1 - y2
  }

  // Sample h at many points to find sign changes
  const numSamples = 200
  const step = (xMax - xMin) / numSamples
  const intersections: number[] = []

  for (let i = 0; i < numSamples; i++) {
    const x1 = xMin + i * step
    const x2 = xMin + (i + 1) * step
    const y1 = h(x1)
    const y2 = h(x2)

    // Skip if either value is invalid
    if (!Number.isFinite(y1) || !Number.isFinite(y2)) {
      continue
    }

    // Check for sign change
    if (y1 * y2 < 0) {
      const root = bisection(h, x1, x2, tolerance)
      if (root !== null) {
        // Avoid duplicates
        if (intersections.length === 0 || Math.abs(root - intersections[intersections.length - 1]) > tolerance) {
          intersections.push(root)
        }
      }
    } else if (Math.abs(y1) < tolerance) {
      // Handle case where we land exactly on a root
      if (intersections.length === 0 || Math.abs(x1 - intersections[intersections.length - 1]) > tolerance) {
        intersections.push(x1)
      }
    }
  }

  return intersections.sort((a, b) => a - b)
}

/**
 * Get line equation parameters from GraphLine
 */
function getLineEquation(line: GraphLine): {
  isVertical: boolean
  m?: number
  b?: number
  x?: number
} {
  if (line.start.type !== 'coord' || line.end.type !== 'coord') {
    throw new Error('Line must have coordinate anchors')
  }

  const { x: x1, y: y1 } = line.start
  const { x: x2, y: y2 } = line.end

  const dx = x2 - x1
  const dy = y2 - y1

  // Vertical line
  if (Math.abs(dx) < 0.0001) {
    return { isVertical: true, x: x1 }
  }

  // Non-vertical line: y = mx + b
  const m = dy / dx
  const b = y1 - m * x1

  return { isVertical: false, m, b }
}

/**
 * Check if a point is within line bounds based on line kind
 */
function isPointOnLine(
  point: { x: number; y: number },
  line: GraphLine
): boolean {
  if (line.start.type !== 'coord' || line.end.type !== 'coord') {
    return false
  }

  const { x, y } = point
  const { x: x1, y: y1 } = line.start
  const { x: x2, y: y2 } = line.end

  if (line.kind === 'line') {
    return true // Infinite line
  }

  if (line.kind === 'segment') {
    // Point must be between start and end
    const minX = Math.min(x1, x2)
    const maxX = Math.max(x1, x2)
    const minY = Math.min(y1, y2)
    const maxY = Math.max(y1, y2)
    return x >= minX - 0.001 && x <= maxX + 0.001 && y >= minY - 0.001 && y <= maxY + 0.001
  }

  if (line.kind === 'ray') {
    // Ray extends from start through end direction
    const dx = x2 - x1
    const dy = y2 - y1
    const t = Math.abs(dx) > Math.abs(dy) ? (x - x1) / dx : (y - y1) / dy
    return t >= -0.001 // Allow slight tolerance
  }

  return false
}

/**
 * Find intersection points between a line and a function
 */
export function findLineFunctionIntersection(
  line: GraphLine,
  functionExpr: string,
  xMin: number,
  xMax: number,
  tolerance: number = 0.0001
): Array<{ x: number; y: number }> {
  const f = compileExpression(functionExpr)
  if (!f) {
    return []
  }

  const lineEq = getLineEquation(line)

  // Handle vertical line
  if (lineEq.isVertical) {
    const x = lineEq.x!
    if (x < xMin || x > xMax) {
      return []
    }
    const y = f(x)
    if (!Number.isFinite(y)) {
      return []
    }
    const point = { x, y }
    return isPointOnLine(point, line) ? [point] : []
  }

  // Non-vertical line: find where f(x) = mx + b
  const { m, b } = lineEq
  const h = (x: number) => {
    const fy = f(x)
    if (!Number.isFinite(fy)) {
      return NaN
    }
    return fy - (m! * x + b!)
  }

  const xIntersections = findFunctionIntersections(functionExpr, `${m}*x + ${b}`, xMin, xMax, tolerance)

  const points: Array<{ x: number; y: number }> = []
  for (const x of xIntersections) {
    const y = f(x)
    if (Number.isFinite(y)) {
      const point = { x, y }
      if (isPointOnLine(point, line)) {
        points.push(point)
      }
    }
  }

  return points
}

/**
 * Find intersection point between two lines
 */
export function findLineLineIntersection(
  line1: GraphLine,
  line2: GraphLine
): { x: number; y: number } | null {
  if (line1.start.type !== 'coord' || line1.end.type !== 'coord' ||
      line2.start.type !== 'coord' || line2.end.type !== 'coord') {
    return null
  }

  const { x: x1, y: y1 } = line1.start
  const { x: x2, y: y2 } = line1.end
  const { x: x3, y: y3 } = line2.start
  const { x: x4, y: y4 } = line2.end

  // Line 1: P1 + t*(P2-P1)
  // Line 2: P3 + u*(P4-P3)
  const dx1 = x2 - x1
  const dy1 = y2 - y1
  const dx2 = x4 - x3
  const dy2 = y4 - y3

  // Calculate denominator
  const denom = dx1 * dy2 - dy1 * dx2

  // Check for parallel lines
  if (Math.abs(denom) < 0.0001) {
    return null
  }

  // Calculate t and u parameters
  const t = ((x3 - x1) * dy2 - (y3 - y1) * dx2) / denom
  const u = ((x3 - x1) * dy1 - (y3 - y1) * dx1) / denom

  // Calculate intersection point
  const x = x1 + t * dx1
  const y = y1 + t * dy1
  const point = { x, y }

  // Check if intersection is within bounds for each line
  const onLine1 = line1.kind === 'line' ||
                  (line1.kind === 'segment' && t >= -0.001 && t <= 1.001) ||
                  (line1.kind === 'ray' && t >= -0.001)

  const onLine2 = line2.kind === 'line' ||
                  (line2.kind === 'segment' && u >= -0.001 && u <= 1.001) ||
                  (line2.kind === 'ray' && u >= -0.001)

  return (onLine1 && onLine2) ? point : null
}
