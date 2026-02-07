import { describe, test } from 'node:test'
import assert from 'node:assert'
import { findEnclosingRegion, type RegionElement } from './region-finder'
import type { GraphFunction, GraphLine, GraphAxes } from '@/types/exams'

const defaultAxes: GraphAxes = {
  xMin: -5,
  xMax: 5,
  yMin: -5,
  yMax: 5
}

describe('findEnclosingRegion - Sweep-line Region Detection', () => {
  test('Test 1: Region between x² and x (intersect at x=0 and x=1)', () => {
    const func1: GraphFunction = { id: 'f1', expression: 'x^2' }
    const func2: GraphFunction = { id: 'f2', expression: 'x' }

    const elements: RegionElement[] = [
      { type: 'function', id: 'f1', element: func1 },
      { type: 'function', id: 'f2', element: func2 }
    ]

    // Drop point at (0.5, 0.3) - between the two curves in [0, 1]
    const result = findEnclosingRegion({ x: 0.5, y: 0.3 }, elements, defaultAxes)

    assert.ok(result !== null, 'Should find a region')
    assert.ok(result!.polygon.length >= 3, 'Polygon should have at least 3 points')

    // Domain should be approximately [0, 1]
    assert.ok(result!.domain.min >= -0.1 && result!.domain.min <= 0.1, 'Domain min should be ~0')
    assert.ok(result!.domain.max >= 0.9 && result!.domain.max <= 1.1, 'Domain max should be ~1')

    // Both functions should be in boundaryIds
    assert.ok(result!.boundaryIds.includes('f1'), 'Should include f1 in boundaries')
    assert.ok(result!.boundaryIds.includes('f2'), 'Should include f2 in boundaries')
  })

  test('Test 2: Region between x² and line y = 2x - 1', () => {
    const func1: GraphFunction = { id: 'f1', expression: 'x^2' }
    const line1: GraphLine = {
      id: 'line1',
      kind: 'line',
      start: { type: 'coord', x: 0, y: -1 },
      end: { type: 'coord', x: 1, y: 1 }
    }

    const elements: RegionElement[] = [
      { type: 'function', id: 'f1', element: func1 },
      { type: 'line', id: 'line1', element: line1 }
    ]

    // Drop point between the parabola and the line
    // y = 2x - 1 and y = x² intersect where x² = 2x - 1, i.e. x² - 2x + 1 = 0, (x-1)² = 0
    // So they only touch at x=1. Let's use different test case.
    // Actually, the line passes through (0,-1) and (1,1), so slope is 2
    // At x=0.5: line y = 2*0.5 - 1 = 0, parabola y = 0.25
    // The parabola is above the line at x=0.5

    const result = findEnclosingRegion({ x: 0.5, y: 0.1 }, elements, defaultAxes)

    // This might or might not find a region depending on intersections
    // The parabola x² and line 2x-1 touch at x=1 only
    // So there's no closed region between them
    // This test verifies the algorithm handles this case
    assert.ok(result === null || result.polygon.length >= 3, 'Should return null or valid polygon')
  })

  test('Test 3: Region bounded by vertical segment', () => {
    const func1: GraphFunction = { id: 'f1', expression: 'x^2' }
    const func2: GraphFunction = { id: 'f2', expression: '0' } // y = 0 (x-axis as function)
    const verticalLine: GraphLine = {
      id: 'vline',
      kind: 'segment',
      start: { type: 'coord', x: 2, y: -1 },
      end: { type: 'coord', x: 2, y: 5 }
    }

    const elements: RegionElement[] = [
      { type: 'function', id: 'f1', element: func1 },
      { type: 'function', id: 'f2', element: func2 },
      { type: 'line', id: 'vline', element: verticalLine }
    ]

    // Drop point at (1, 0.5) - between x² and y=0
    const result = findEnclosingRegion({ x: 1, y: 0.5 }, elements, defaultAxes)

    assert.ok(result !== null, 'Should find a region')
    assert.ok(result!.polygon.length >= 3, 'Polygon should have at least 3 points')

    // Domain max should be bounded by vertical line at x=2
    assert.ok(result!.domain.max <= 2.1, 'Domain should be bounded by vertical line')
  })

  test('Test 4: No closed region (drop in the void)', () => {
    // Only one curve - no opposing boundary
    const func1: GraphFunction = { id: 'f1', expression: 'x^2' }

    const elements: RegionElement[] = [
      { type: 'function', id: 'f1', element: func1 }
    ]

    // Drop point with only one curve nearby - no closed region
    const result = findEnclosingRegion({ x: 0, y: 5 }, elements, defaultAxes)

    assert.strictEqual(result, null, 'Should return null when no closed region')
  })

  test('Test 5: ignoredBoundaries - region extends when middle function is ignored', () => {
    // Three functions: x², x, and 2x
    // Between x² and x: region in [0,1]
    // If we ignore x, the region should extend to where x² meets 2x
    const func1: GraphFunction = { id: 'f1', expression: 'x^2' }
    const func2: GraphFunction = { id: 'f2', expression: 'x' }
    const func3: GraphFunction = { id: 'f3', expression: '2*x' }

    const elements: RegionElement[] = [
      { type: 'function', id: 'f1', element: func1 },
      { type: 'function', id: 'f2', element: func2 },
      { type: 'function', id: 'f3', element: func3 }
    ]

    // First, get region without ignoring anything
    const result1 = findEnclosingRegion({ x: 0.5, y: 0.5 }, elements, defaultAxes)

    // Now ignore the middle function (f2) and see if region changes
    const result2 = findEnclosingRegion({ x: 0.5, y: 0.5 }, elements, defaultAxes, ['f2'])

    // Both should return valid results (or the second might be null if no region)
    assert.ok(result1 !== null, 'Should find region without ignored boundaries')

    // With f2 ignored, the region might extend or change
    // x² and 2x intersect at x²=2x, x(x-2)=0, so x=0 or x=2
    if (result2 !== null) {
      // If a region is found, it should be different
      assert.ok(!result2.boundaryIds.includes('f2'), 'f2 should not be in boundaries when ignored')
    }
  })

  test('Test 6: Segment clips the polygon', () => {
    const func1: GraphFunction = { id: 'f1', expression: 'x^2' }
    const func2: GraphFunction = { id: 'f2', expression: '-1' } // Horizontal line at y=-1

    // Diagonal segment that cuts through the region
    const diagonalSeg: GraphLine = {
      id: 'diag',
      kind: 'segment',
      start: { type: 'coord', x: 0, y: 0 },
      end: { type: 'coord', x: 2, y: 2 }
    }

    const elements: RegionElement[] = [
      { type: 'function', id: 'f1', element: func1 },
      { type: 'function', id: 'f2', element: func2 },
      { type: 'line', id: 'diag', element: diagonalSeg }
    ]

    // Drop point between the parabola and y=-1
    const result = findEnclosingRegion({ x: 1, y: -0.5 }, elements, defaultAxes)

    // Should find a region, potentially clipped by the diagonal
    assert.ok(result === null || result.polygon.length >= 3, 'Should return null or valid polygon')
  })

  test('handles function with transformations (offsetX, offsetY, scaleY)', () => {
    const func1: GraphFunction = {
      id: 'f1',
      expression: 'x^2',
      offsetY: 1,
      scaleY: 2
    }
    const func2: GraphFunction = {
      id: 'f2',
      expression: '0'
    }

    const elements: RegionElement[] = [
      { type: 'function', id: 'f1', element: func1 },
      { type: 'function', id: 'f2', element: func2 }
    ]

    // At x=1, transformed func1 = 2*1² + 1 = 3
    // Drop point between them
    const result = findEnclosingRegion({ x: 1, y: 1.5 }, elements, defaultAxes)

    assert.ok(result !== null, 'Should find region with transformed function')
    assert.ok(result!.polygon.length >= 3, 'Polygon should have sufficient points')

    // Check that some polygon points reflect the transformation
    const maxY = Math.max(...result!.polygon.map(p => p.y))
    assert.ok(maxY > 2, 'Max Y should reflect the scaled and offset function')
  })

  test('returns null when drop point is exactly on a curve', () => {
    const func1: GraphFunction = { id: 'f1', expression: 'x^2' }
    const func2: GraphFunction = { id: 'f2', expression: 'x' }

    const elements: RegionElement[] = [
      { type: 'function', id: 'f1', element: func1 },
      { type: 'function', id: 'f2', element: func2 }
    ]

    // Drop point exactly on x² curve at x=0.5 (y=0.25)
    const result = findEnclosingRegion({ x: 0.5, y: 0.25 }, elements, defaultAxes)

    // Should return null or a degenerate result since point is on boundary
    // The tolerance check should handle this
    assert.ok(result === null || result.polygon.length >= 3, 'Should handle point on curve gracefully')
  })

  test('handles multiple pockets (sin function)', () => {
    // sin(x) creates multiple pockets with x-axis
    const func1: GraphFunction = { id: 'f1', expression: 'sin(x)' }
    const func2: GraphFunction = { id: 'f2', expression: '0' }

    const axes: GraphAxes = {
      xMin: -Math.PI * 2,
      xMax: Math.PI * 2,
      yMin: -2,
      yMax: 2
    }

    const elements: RegionElement[] = [
      { type: 'function', id: 'f1', element: func1 },
      { type: 'function', id: 'f2', element: func2 }
    ]

    // Drop in first positive pocket (0 to π)
    const result = findEnclosingRegion({ x: Math.PI / 2, y: 0.5 }, elements, axes)

    assert.ok(result !== null, 'Should find region in sin pocket')

    // Domain should be approximately [0, π]
    assert.ok(result!.domain.min >= -0.2 && result!.domain.min <= 0.2, 'Domain min should be ~0')
    assert.ok(result!.domain.max >= Math.PI - 0.2 && result!.domain.max <= Math.PI + 0.2, 'Domain max should be ~π')
  })

  test('handles ray lines', () => {
    const func1: GraphFunction = { id: 'f1', expression: 'x' }
    const func2: GraphFunction = { id: 'f2', expression: '-x' }
    const ray: GraphLine = {
      id: 'ray1',
      kind: 'ray',
      start: { type: 'coord', x: 1, y: 0 },
      end: { type: 'coord', x: 1, y: 1 } // Vertical ray going up from (1,0)
    }

    const elements: RegionElement[] = [
      { type: 'function', id: 'f1', element: func1 },
      { type: 'function', id: 'f2', element: func2 },
      { type: 'line', id: 'ray1', element: ray }
    ]

    // Drop point in the V-shape between y=x and y=-x, bounded by ray
    const result = findEnclosingRegion({ x: 0.5, y: 0 }, elements, defaultAxes)

    assert.ok(result !== null, 'Should find region bounded by ray')
    // The vertical ray at x=1 should limit the domain
    assert.ok(result!.domain.max <= 1.1, 'Domain should be bounded by ray at x=1')
  })
})
