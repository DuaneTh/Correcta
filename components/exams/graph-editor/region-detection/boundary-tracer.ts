import { compileExpression } from '@/components/exams/graph-utils'
import type { GraphFunction, GraphLine, GraphAxes } from '@/types/exams'
import { findFunctionIntersections, findLineFunctionIntersection } from './intersection-solver'

export type BoundaryElement =
  | { type: 'function'; element: GraphFunction }
  | { type: 'line'; element: GraphLine }
  | { type: 'axis'; axis: 'x' | 'y'; value: number }

/**
 * Sample a function at regular intervals within a domain
 */
export function sampleFunctionInDomain(
  func: GraphFunction,
  minX: number,
  maxX: number,
  numSamples: number
): Array<{ x: number; y: number }> {
  const compiled = compileExpression(func.expression)
  if (!compiled) {
    return []
  }

  const points: Array<{ x: number; y: number }> = []
  const step = (maxX - minX) / numSamples

  for (let i = 0; i <= numSamples; i++) {
    const x = minX + i * step

    // Apply offsetX if present
    const transformedX = x - (func.offsetX || 0)

    // Evaluate function
    let y = compiled(transformedX)

    // Skip invalid values
    if (!Number.isFinite(y)) {
      continue
    }

    // Apply scaleY and offsetY transformations
    y = y * (func.scaleY || 1) + (func.offsetY || 0)

    points.push({ x, y })
  }

  return points
}

/**
 * Generate a closed polygon between two function curves
 */
export function generatePolygonBetweenCurves(
  func1: GraphFunction,
  func2: GraphFunction,
  xMin: number,
  xMax: number,
  numSamples: number = 60
): Array<{ x: number; y: number }> {
  const samples1 = sampleFunctionInDomain(func1, xMin, xMax, numSamples)
  const samples2 = sampleFunctionInDomain(func2, xMin, xMax, numSamples)

  if (samples1.length === 0 || samples2.length === 0) {
    return []
  }

  // Determine which function is "upper" at midpoint
  const midX = (xMin + xMax) / 2
  const midY1 = samples1.find(p => Math.abs(p.x - midX) < (xMax - xMin) / numSamples)?.y || 0
  const midY2 = samples2.find(p => Math.abs(p.x - midX) < (xMax - xMin) / numSamples)?.y || 0

  let upper = samples1
  let lower = samples2

  if (midY2 > midY1) {
    upper = samples2
    lower = samples1
  }

  // Create closed polygon: upper forward + lower backward
  const polygon = [...upper, ...lower.slice().reverse()]

  return polygon
}

/**
 * Check if an axis is visible within the canvas bounds
 */
function isAxisVisible(axis: 'x' | 'y', axes: GraphAxes): boolean {
  if (axis === 'x') {
    // x-axis at y=0
    return axes.yMin <= 0 && axes.yMax >= 0
  } else {
    // y-axis at x=0
    return axes.xMin <= 0 && axes.xMax >= 0
  }
}

/**
 * Generate polygon bounded by mixed elements (functions, lines, axes)
 */
export function generatePolygonBoundedByElements(
  boundaries: BoundaryElement[],
  dropPoint: { x: number; y: number },
  axes: GraphAxes
): Array<{ x: number; y: number }> {
  // Filter out invisible axes
  const visibleBoundaries = boundaries.filter(boundary => {
    if (boundary.type === 'axis') {
      return isAxisVisible(boundary.axis, axes)
    }
    return true
  })

  if (visibleBoundaries.length === 0) {
    return []
  }

  // Simplified implementation for common cases
  const functions = visibleBoundaries.filter(b => b.type === 'function')
  const lines = visibleBoundaries.filter(b => b.type === 'line')
  const axisElements = visibleBoundaries.filter(b => b.type === 'axis')

  // Case 1: Function + x-axis (area under curve)
  if (functions.length === 1 && axisElements.length === 1 && axisElements[0].type === 'axis' && axisElements[0].axis === 'x') {
    const func = functions[0].element
    const xMin = axes.xMin
    const xMax = axes.xMax

    // Sample the function
    const funcSamples = sampleFunctionInDomain(func, xMin, xMax, 60)

    if (funcSamples.length === 0) {
      return []
    }

    // Create polygon: function samples + along x-axis
    const minX = Math.min(...funcSamples.map(p => p.x))
    const maxX = Math.max(...funcSamples.map(p => p.x))

    const polygon = [
      ...funcSamples,
      { x: maxX, y: 0 },
      { x: minX, y: 0 }
    ]

    return polygon
  }

  // Case 2: Function + y-axis
  if (functions.length === 1 && axisElements.length === 1 && axisElements[0].type === 'axis' && axisElements[0].axis === 'y') {
    const func = functions[0].element

    // Find where function intersects y-axis (x=0)
    const compiled = compileExpression(func.expression)
    if (!compiled) {
      return []
    }

    const yAtZero = compiled(0 - (func.offsetX || 0)) * (func.scaleY || 1) + (func.offsetY || 0)

    if (!Number.isFinite(yAtZero)) {
      return []
    }

    // Sample function from x=0 to some domain
    const xMin = 0
    const xMax = axes.xMax

    const funcSamples = sampleFunctionInDomain(func, xMin, xMax, 60)

    if (funcSamples.length === 0) {
      return []
    }

    // Create polygon: function samples + along y-axis
    const minY = Math.min(0, ...funcSamples.map(p => p.y))
    const maxY = Math.max(yAtZero, ...funcSamples.map(p => p.y))

    const polygon = [
      ...funcSamples,
      { x: 0, y: maxY },
      { x: 0, y: minY }
    ]

    return polygon
  }

  // Case 3: Function + vertical line
  if (functions.length === 1 && lines.length === 1) {
    const func = functions[0].element
    const line = lines[0].element

    // Check if line is vertical
    if (line.start.type === 'coord' && line.end.type === 'coord') {
      const dx = Math.abs(line.end.x - line.start.x)

      if (dx < 0.001) {
        // Vertical line
        const lineX = line.start.x
        const xMin = Math.min(axes.xMin, lineX)
        const xMax = Math.max(lineX, axes.xMax)

        const funcSamples = sampleFunctionInDomain(func, xMin, xMax, 60)

        if (funcSamples.length === 0) {
          return []
        }

        // Find y-values at vertical line
        const compiled = compileExpression(func.expression)
        if (!compiled) {
          return funcSamples
        }

        const yAtLine = compiled(lineX - (func.offsetX || 0)) * (func.scaleY || 1) + (func.offsetY || 0)

        // Create polygon respecting vertical line boundary
        const leftSamples = funcSamples.filter(p => p.x <= lineX + 0.01)

        const polygon = [
          ...leftSamples,
          { x: lineX, y: Number.isFinite(yAtLine) ? yAtLine : 0 },
          { x: lineX, y: 0 },
          { x: leftSamples[0]?.x || xMin, y: 0 }
        ]

        return polygon
      }
    }
  }

  // Fallback: just sample the first function
  if (functions.length > 0) {
    return sampleFunctionInDomain(functions[0].element, axes.xMin, axes.xMax, 60)
  }

  return []
}
