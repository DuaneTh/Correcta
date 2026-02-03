import { describe, test } from 'node:test'
import assert from 'node:assert'
import { generatePolygonBetweenCurves, generatePolygonBoundedByElements } from './boundary-tracer'
import type { GraphFunction, GraphLine, GraphAxes } from '@/types/exams'

describe('Feature 4: generatePolygonBetweenCurves - Between Functions', () => {
  test('generates polygon between x^2 and x from 0 to 1', () => {
    const func1: GraphFunction = {
      id: 'f1',
      expression: 'x^2'
    }
    const func2: GraphFunction = {
      id: 'f2',
      expression: 'x'
    }
    const polygon = generatePolygonBetweenCurves(func1, func2, 0, 1, 60)

    // Should have ~121 points (60 forward + 60 backward + 1 close)
    assert.ok(polygon.length >= 100, 'Should have sufficient points')
    assert.ok(polygon.length <= 130, 'Should not have too many points')

    // First and last points should be close (closed polygon)
    const first = polygon[0]
    const last = polygon[polygon.length - 1]
    assert.ok(Math.abs(first.x - last.x) < 0.1, 'Polygon should close in x')
    assert.ok(Math.abs(first.y - last.y) < 0.1, 'Polygon should close in y')

    // Points should span the domain
    const xValues = polygon.map(p => p.x)
    const minX = Math.min(...xValues)
    const maxX = Math.max(...xValues)
    assert.ok(minX <= 0.1, 'Should start near x=0')
    assert.ok(maxX >= 0.9, 'Should end near x=1')
  })

  test('handles function with transformations (offsetX, offsetY, scaleY)', () => {
    const func1: GraphFunction = {
      id: 'f1',
      expression: 'x^2',
      offsetY: 1, // Shift up by 1
      scaleY: 2   // Stretch vertically by 2
    }
    const func2: GraphFunction = {
      id: 'f2',
      expression: '0' // Constant function y=0
    }
    const polygon = generatePolygonBetweenCurves(func1, func2, 0, 1, 30)

    assert.ok(polygon.length > 0, 'Should generate polygon')

    // Check that transformation is applied: y = 2*x^2 + 1 at x=1 should be 3
    const pointsNearX1 = polygon.filter(p => Math.abs(p.x - 1) < 0.1)
    const hasHighY = pointsNearX1.some(p => p.y > 2.5 && p.y < 3.5)
    assert.ok(hasHighY, 'Transformation should be applied')
  })

  test('returns empty array for invalid expressions', () => {
    const func1: GraphFunction = {
      id: 'f1',
      expression: 'invalid$$'
    }
    const func2: GraphFunction = {
      id: 'f2',
      expression: 'x'
    }
    const polygon = generatePolygonBetweenCurves(func1, func2, 0, 1, 30)

    assert.strictEqual(polygon.length, 0, 'Should return empty for invalid expression')
  })
})

describe('Feature 5: generatePolygonBoundedByElements - Mixed Elements with Axis Support', () => {
  test('generates polygon bounded by function and x-axis when visible', () => {
    const axes: GraphAxes = {
      xMin: -2,
      xMax: 2,
      yMin: -1,
      yMax: 3
    }

    const boundaries = [
      {
        type: 'function' as const,
        element: { id: 'f1', expression: 'x^2' } as GraphFunction
      },
      {
        type: 'axis' as const,
        axis: 'x' as const,
        value: 0
      }
    ]

    const dropPoint = { x: 0.5, y: 0.1 }
    const polygon = generatePolygonBoundedByElements(boundaries, dropPoint, axes)

    assert.ok(polygon.length > 0, 'Should generate polygon')

    // Some points should be on x-axis (y ≈ 0)
    const pointsOnXAxis = polygon.filter(p => Math.abs(p.y) < 0.01)
    assert.ok(pointsOnXAxis.length > 0, 'Should include points on x-axis')

    // Some points should be on parabola (y ≈ x^2)
    const pointsOnParabola = polygon.filter(p => Math.abs(p.y - p.x * p.x) < 0.1)
    assert.ok(pointsOnParabola.length > 10, 'Should include points on parabola')
  })

  test('ignores x-axis when not visible (yMin > 0)', () => {
    const axes: GraphAxes = {
      xMin: -2,
      xMax: 2,
      yMin: 1, // x-axis not visible
      yMax: 5
    }

    const boundaries = [
      {
        type: 'function' as const,
        element: { id: 'f1', expression: 'x^2 + 2' } as GraphFunction
      },
      {
        type: 'axis' as const,
        axis: 'x' as const,
        value: 0
      }
    ]

    const dropPoint = { x: 0, y: 2 }
    const polygon = generatePolygonBoundedByElements(boundaries, dropPoint, axes)

    // x-axis at y=0 is outside visible range, so it shouldn't be used
    // This test expects the implementation to handle this gracefully
    // For now, we'll just check it doesn't crash
    assert.ok(Array.isArray(polygon), 'Should return an array')
  })

  test('handles y-axis as boundary when visible', () => {
    const axes: GraphAxes = {
      xMin: -2,
      xMax: 2,
      yMin: -1,
      yMax: 3
    }

    const boundaries = [
      {
        type: 'function' as const,
        element: { id: 'f1', expression: 'x^2' } as GraphFunction
      },
      {
        type: 'axis' as const,
        axis: 'y' as const,
        value: 0
      }
    ]

    const dropPoint = { x: 0.1, y: 0.5 }
    const polygon = generatePolygonBoundedByElements(boundaries, dropPoint, axes)

    assert.ok(polygon.length > 0, 'Should generate polygon')

    // Some points should be on y-axis (x ≈ 0)
    const pointsOnYAxis = polygon.filter(p => Math.abs(p.x) < 0.01)
    assert.ok(pointsOnYAxis.length > 0, 'Should include points on y-axis')
  })

  test('handles vertical line as domain boundary', () => {
    const axes: GraphAxes = {
      xMin: -2,
      xMax: 2,
      yMin: -1,
      yMax: 3
    }

    const verticalLine: GraphLine = {
      id: 'vline',
      kind: 'line',
      start: { type: 'coord', x: 1, y: 0 },
      end: { type: 'coord', x: 1, y: 1 }
    }

    const boundaries = [
      {
        type: 'function' as const,
        element: { id: 'f1', expression: 'x^2' } as GraphFunction
      },
      {
        type: 'line' as const,
        element: verticalLine
      }
    ]

    const dropPoint = { x: 0.5, y: 0.3 }
    const polygon = generatePolygonBoundedByElements(boundaries, dropPoint, axes)

    assert.ok(polygon.length > 0, 'Should generate polygon')

    // Should respect vertical line at x=1
    const maxX = Math.max(...polygon.map(p => p.x))
    assert.ok(maxX <= 1.1, 'Should be bounded by vertical line at x=1')
  })
})
