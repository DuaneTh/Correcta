import { describe, test } from 'node:test'
import assert from 'node:assert'
import { findFunctionIntersections, findLineFunctionIntersection, findLineLineIntersection } from './intersection-solver'
import type { GraphLine } from '@/types/exams'

describe('Feature 1: findFunctionIntersections - Function-Function', () => {
  test('finds intersections of x^2 and x (should be 0 and 1)', () => {
    const intersections = findFunctionIntersections('x^2', 'x', -5, 5)
    assert.strictEqual(intersections.length, 2)
    assert.ok(Math.abs(intersections[0] - 0) < 0.001, 'First intersection should be near 0')
    assert.ok(Math.abs(intersections[1] - 1) < 0.001, 'Second intersection should be near 1')
  })

  test('finds single intersection of parabola and tangent line', () => {
    const intersections = findFunctionIntersections('x^2', '2*x - 1', -5, 5)
    assert.strictEqual(intersections.length, 1)
    assert.ok(Math.abs(intersections[0] - 1) < 0.001, 'Intersection should be near x=1')
  })

  test('finds multiple intersections of sin(x) and horizontal line', () => {
    const intersections = findFunctionIntersections('sin(x)', '0.5', 0, 6.28)
    assert.strictEqual(intersections.length, 2)
    assert.ok(Math.abs(intersections[0] - 0.524) < 0.01, 'First intersection near 0.524')
    assert.ok(Math.abs(intersections[1] - 2.618) < 0.01, 'Second intersection near 2.618')
  })

  test('returns empty array when no intersections exist', () => {
    // x^2 = -x - 5 has no real solutions (discriminant < 0)
    const intersections = findFunctionIntersections('x^2', '-x - 5', -5, 5)
    assert.strictEqual(intersections.length, 0)
  })

  test('handles invalid expressions gracefully', () => {
    const intersections = findFunctionIntersections('invalid$$', 'x', -5, 5)
    assert.strictEqual(intersections.length, 0)
  })
})

describe('Feature 2: findLineFunctionIntersection - Line-Function', () => {
  test('finds intersections of y=x line with y=x^2 parabola', () => {
    const line: GraphLine = {
      id: 'line1',
      kind: 'line',
      start: { type: 'coord', x: 0, y: 0 },
      end: { type: 'coord', x: 2, y: 2 }
    }
    const intersections = findLineFunctionIntersection(line, 'x^2', -5, 5)
    assert.strictEqual(intersections.length, 2)
    assert.ok(Math.abs(intersections[0].x - 0) < 0.001, 'First intersection at x=0')
    assert.ok(Math.abs(intersections[1].x - 1) < 0.001, 'Second intersection at x=1')
  })

  test('finds intersections of horizontal line y=1 with parabola', () => {
    const line: GraphLine = {
      id: 'line2',
      kind: 'line', // Changed to 'line' to get both intersections
      start: { type: 'coord', x: 0, y: 1 },
      end: { type: 'coord', x: 2, y: 1 }
    }
    const intersections = findLineFunctionIntersection(line, 'x^2', -5, 5)
    assert.strictEqual(intersections.length, 2)
    // y = x^2 = 1 means x = ±1
    const xValues = intersections.map(p => p.x).sort((a, b) => a - b)
    assert.ok(Math.abs(xValues[0] - (-1)) < 0.001, 'Intersection at x=-1')
    assert.ok(Math.abs(xValues[1] - 1) < 0.001, 'Intersection at x=1')
  })

  test('handles vertical line intersection', () => {
    const line: GraphLine = {
      id: 'line3',
      kind: 'line',
      start: { type: 'coord', x: 5, y: 0 },
      end: { type: 'coord', x: 5, y: 5 }
    }
    const intersections = findLineFunctionIntersection(line, 'x^2', -10, 10)
    assert.strictEqual(intersections.length, 1)
    assert.ok(Math.abs(intersections[0].x - 5) < 0.001, 'Intersection at x=5')
    assert.ok(Math.abs(intersections[0].y - 25) < 0.001, 'Intersection at y=25')
  })

  test('respects segment bounds - no intersection outside segment', () => {
    const line: GraphLine = {
      id: 'line4',
      kind: 'segment',
      start: { type: 'coord', x: 2, y: 0 },
      end: { type: 'coord', x: 3, y: 0 }
    }
    // Line is horizontal at y=0 from x=2 to x=3
    // Parabola x^2 intersects at x=0, which is outside segment
    const intersections = findLineFunctionIntersection(line, 'x^2', -5, 5)
    assert.strictEqual(intersections.length, 0, 'No intersection within segment bounds')
  })
})

describe('Feature 3: findLineLineIntersection - Line-Line', () => {
  test('finds intersection of two crossing lines', () => {
    const line1: GraphLine = {
      id: 'line1',
      kind: 'line',
      start: { type: 'coord', x: 0, y: 0 },
      end: { type: 'coord', x: 2, y: 2 }
    }
    const line2: GraphLine = {
      id: 'line2',
      kind: 'line',
      start: { type: 'coord', x: 0, y: 2 },
      end: { type: 'coord', x: 2, y: 0 }
    }
    const intersection = findLineLineIntersection(line1, line2)
    assert.ok(intersection !== null)
    assert.ok(Math.abs(intersection.x - 1) < 0.001)
    assert.ok(Math.abs(intersection.y - 1) < 0.001)
  })

  test('returns null for parallel lines', () => {
    const line1: GraphLine = {
      id: 'line1',
      kind: 'line',
      start: { type: 'coord', x: 0, y: 0 },
      end: { type: 'coord', x: 1, y: 1 }
    }
    const line2: GraphLine = {
      id: 'line2',
      kind: 'line',
      start: { type: 'coord', x: 0, y: 1 },
      end: { type: 'coord', x: 1, y: 2 }
    }
    const intersection = findLineLineIntersection(line1, line2)
    assert.strictEqual(intersection, null)
  })

  test('respects segment bounds - intersection outside both segments', () => {
    const line1: GraphLine = {
      id: 'line1',
      kind: 'segment',
      start: { type: 'coord', x: 0, y: 0 },
      end: { type: 'coord', x: 0.5, y: 0.5 }
    }
    const line2: GraphLine = {
      id: 'line2',
      kind: 'segment',
      start: { type: 'coord', x: 0, y: 2 },
      end: { type: 'coord', x: 0.5, y: 1.5 }
    }
    // Lines would intersect at (1, 1) if extended, but that's outside both segments
    const intersection = findLineLineIntersection(line1, line2)
    assert.strictEqual(intersection, null)
  })

  test('handles ray kind correctly', () => {
    const ray: GraphLine = {
      id: 'ray1',
      kind: 'ray',
      start: { type: 'coord', x: 0, y: 0 },
      end: { type: 'coord', x: 1, y: 1 }
    }
    const line: GraphLine = {
      id: 'line1',
      kind: 'line',
      start: { type: 'coord', x: 0, y: 2 },
      end: { type: 'coord', x: 2, y: 0 }
    }
    // Ray extends from (0,0) through (1,1) direction
    // Line from (0,2) to (2,0)
    // Should intersect at (1, 1)
    const intersection = findLineLineIntersection(ray, line)
    assert.ok(intersection !== null)
    assert.ok(Math.abs(intersection.x - 1) < 0.001)
    assert.ok(Math.abs(intersection.y - 1) < 0.001)
  })
})
