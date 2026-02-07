import { compileExpression } from '@/components/exams/graph-utils'
import type { GraphFunction, GraphLine, GraphAxes } from '@/types/exams'

/** An element that can serve as a boundary */
export type RegionElement =
  | { type: 'function'; id: string; element: GraphFunction }
  | { type: 'line'; id: string; element: GraphLine }

/** Result of region detection */
export interface RegionResult {
  /** The closed polygon of the region (list of points) */
  polygon: Array<{ x: number; y: number }>
  /** IDs of elements that form the boundary of this region */
  boundaryIds: string[]
  /** X domain of the region */
  domain: { min: number; max: number }
}

/** A polyline representing a sampled curve */
interface Polyline {
  id: string
  type: 'function' | 'line'
  points: Array<{ x: number; y: number }>
  element: GraphFunction | GraphLine
  /** Effective x-domain where this polyline is defined */
  xMin: number
  xMax: number
}

/** A segment used for ray-casting */
interface Segment {
  p1: { x: number; y: number }
  p2: { x: number; y: number }
  ownerId: string
  ownerType: 'function' | 'line' | 'boundary'
  /** Index of this segment in its parent polyline (for curve-following) */
  polylineIndex: number
}

/** Result of a ray hitting a segment */
interface RayHit {
  point: { x: number; y: number }
  distance: number
  ownerId: string
  ownerType: 'function' | 'line' | 'boundary'
  segment: Segment
}

const NUM_SAMPLES = 200
const TOLERANCE = 0.0001
const BOUNDARY_ID = '__boundary__'
const NUM_BASE_RAYS = 120
const MAX_REFINE_DEPTH = 6
const RAY_EPSILON = 1e-9

/**
 * Sample an element (function or line) as a polyline
 */
function sampleElement(
  elem: RegionElement,
  axes: GraphAxes
): Polyline {
  const points: Array<{ x: number; y: number }> = []

  if (elem.type === 'function') {
    const func = elem.element
    const compiled = compileExpression(func.expression)
    if (!compiled) {
      return { id: elem.id, type: 'function', points: [], element: func, xMin: 0, xMax: 0 }
    }

    const offsetX = func.offsetX ?? 0
    const offsetY = func.offsetY ?? 0
    const scaleY = func.scaleY ?? 1
    const domainMin = func.domain?.min ?? axes.xMin
    const domainMax = func.domain?.max ?? axes.xMax
    const step = (domainMax - domainMin) / NUM_SAMPLES

    for (let i = 0; i <= NUM_SAMPLES; i++) {
      const x = domainMin + i * step
      try {
        const y = scaleY * compiled(x - offsetX) + offsetY
        if (Number.isFinite(y)) {
          points.push({ x, y })
        }
      } catch {
        // Skip invalid points
      }
    }

    return { id: elem.id, type: 'function', points, element: func, xMin: domainMin, xMax: domainMax }
  }

  // Line element
  const line = elem.element
  if (line.start.type !== 'coord' || line.end.type !== 'coord') {
    return { id: elem.id, type: 'line', points: [], element: line, xMin: 0, xMax: 0 }
  }

  const { x: x1, y: y1 } = line.start
  const { x: x2, y: y2 } = line.end
  const dx = x2 - x1
  const dy = y2 - y1

  let effectiveXMin = axes.xMin
  let effectiveXMax = axes.xMax

  if (line.kind === 'segment') {
    points.push({ x: x1, y: y1 })
    points.push({ x: x2, y: y2 })
    effectiveXMin = Math.min(x1, x2)
    effectiveXMax = Math.max(x1, x2)
  } else if (line.kind === 'line') {
    if (Math.abs(dx) < TOLERANCE) {
      // Vertical line — sample as two points at y extremes
      points.push({ x: x1, y: axes.yMin })
      points.push({ x: x1, y: axes.yMax })
      effectiveXMin = x1
      effectiveXMax = x1
    } else {
      const m = dy / dx
      const yAtXMin = y1 + m * (axes.xMin - x1)
      const yAtXMax = y1 + m * (axes.xMax - x1)
      // Clip to visible area
      const pts = clipLineToAxes(axes.xMin, yAtXMin, axes.xMax, yAtXMax, axes)
      points.push(...pts)
    }
  } else if (line.kind === 'ray') {
    points.push({ x: x1, y: y1 })
    if (Math.abs(dx) < TOLERANCE) {
      const endY = dy > 0 ? axes.yMax : axes.yMin
      points.push({ x: x1, y: endY })
      effectiveXMin = x1
      effectiveXMax = x1
    } else {
      const m = dy / dx
      const endX = dx > 0 ? axes.xMax : axes.xMin
      const endY = y1 + m * (endX - x1)
      // Clip ray endpoint to axes bounds
      const clipped = clipPointToAxes(endX, endY, axes)
      points.push(clipped)
      if (dx > 0) {
        effectiveXMin = x1
      } else {
        effectiveXMax = x1
      }
    }
  }

  return { id: elem.id, type: 'line', points, element: line, xMin: effectiveXMin, xMax: effectiveXMax }
}

/** Clip a point to stay within axes bounds */
function clipPointToAxes(x: number, y: number, axes: GraphAxes): { x: number; y: number } {
  return {
    x: Math.max(axes.xMin, Math.min(axes.xMax, x)),
    y: Math.max(axes.yMin, Math.min(axes.yMax, y))
  }
}

/** Clip a line defined by two points to the axes bounding box */
function clipLineToAxes(
  x1: number, y1: number, x2: number, y2: number,
  axes: GraphAxes
): Array<{ x: number; y: number }> {
  // Cohen-Sutherland style clipping
  const result: Array<{ x: number; y: number }> = []

  // For simplicity, just compute intersections with all 4 bounds
  const dx = x2 - x1
  const dy = y2 - y1

  const candidates: Array<{ x: number; y: number; t: number }> = []

  // Parametric: P(t) = (x1 + t*dx, y1 + t*dy)
  // Find t for each boundary
  if (Math.abs(dx) > TOLERANCE) {
    // Left boundary: x = axes.xMin
    const tLeft = (axes.xMin - x1) / dx
    const yLeft = y1 + tLeft * dy
    if (yLeft >= axes.yMin - TOLERANCE && yLeft <= axes.yMax + TOLERANCE) {
      candidates.push({ x: axes.xMin, y: Math.max(axes.yMin, Math.min(axes.yMax, yLeft)), t: tLeft })
    }
    // Right boundary: x = axes.xMax
    const tRight = (axes.xMax - x1) / dx
    const yRight = y1 + tRight * dy
    if (yRight >= axes.yMin - TOLERANCE && yRight <= axes.yMax + TOLERANCE) {
      candidates.push({ x: axes.xMax, y: Math.max(axes.yMin, Math.min(axes.yMax, yRight)), t: tRight })
    }
  }
  if (Math.abs(dy) > TOLERANCE) {
    // Bottom boundary: y = axes.yMin
    const tBottom = (axes.yMin - y1) / dy
    const xBottom = x1 + tBottom * dx
    if (xBottom >= axes.xMin - TOLERANCE && xBottom <= axes.xMax + TOLERANCE) {
      candidates.push({ x: Math.max(axes.xMin, Math.min(axes.xMax, xBottom)), y: axes.yMin, t: tBottom })
    }
    // Top boundary: y = axes.yMax
    const tTop = (axes.yMax - y1) / dy
    const xTop = x1 + tTop * dx
    if (xTop >= axes.xMin - TOLERANCE && xTop <= axes.xMax + TOLERANCE) {
      candidates.push({ x: Math.max(axes.xMin, Math.min(axes.xMax, xTop)), y: axes.yMax, t: tTop })
    }
  }

  // Sort by t and take the two extremes
  candidates.sort((a, b) => a.t - b.t)

  // Deduplicate
  const unique: typeof candidates = []
  for (const c of candidates) {
    if (unique.length === 0 || Math.abs(c.t - unique[unique.length - 1].t) > TOLERANCE) {
      unique.push(c)
    }
  }

  if (unique.length >= 2) {
    result.push({ x: unique[0].x, y: unique[0].y })
    result.push({ x: unique[unique.length - 1].x, y: unique[unique.length - 1].y })
  } else if (unique.length === 1) {
    result.push({ x: unique[0].x, y: unique[0].y })
  }

  return result
}

function buildTransformedExpression(func: GraphFunction): string {
  const offsetX = func.offsetX ?? 0
  const offsetY = func.offsetY ?? 0
  const scaleY = func.scaleY ?? 1

  let expr = func.expression

  if (offsetX !== 0) {
    expr = expr.replace(/\bx\b/g, `(x-${offsetX})`)
  }
  if (scaleY !== 1) {
    expr = `(${scaleY})*(${expr})`
  }
  if (offsetY !== 0) {
    expr = `(${expr})+(${offsetY})`
  }

  return expr
}

// ========================================================================
// Visibility Polygon Algorithm
// ========================================================================

/**
 * Convert polylines + canvas bounds into a flat list of segments for ray-casting
 */
function buildSegmentList(polylines: Polyline[], axes: GraphAxes): Segment[] {
  const segments: Segment[] = []

  // Add segments from each polyline
  for (const pl of polylines) {
    if (pl.points.length < 2) continue

    for (let i = 0; i < pl.points.length - 1; i++) {
      const p1 = pl.points[i]
      const p2 = pl.points[i + 1]

      // Skip degenerate segments
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      if (dx * dx + dy * dy < TOLERANCE * TOLERANCE) continue

      // Skip segments with non-finite coords
      if (!Number.isFinite(p1.x) || !Number.isFinite(p1.y) ||
          !Number.isFinite(p2.x) || !Number.isFinite(p2.y)) continue

      segments.push({
        p1, p2,
        ownerId: pl.id,
        ownerType: pl.type,
        polylineIndex: i
      })
    }
  }

  // Add canvas boundary segments
  const { xMin, xMax, yMin, yMax } = axes
  const corners = [
    { x: xMin, y: yMin }, // bottom-left
    { x: xMax, y: yMin }, // bottom-right
    { x: xMax, y: yMax }, // top-right
    { x: xMin, y: yMax }, // top-left
  ]

  for (let i = 0; i < 4; i++) {
    segments.push({
      p1: corners[i],
      p2: corners[(i + 1) % 4],
      ownerId: BOUNDARY_ID,
      ownerType: 'boundary',
      polylineIndex: i
    })
  }

  return segments
}

/**
 * Compute ray-segment intersection.
 * Ray: origin + t * direction (t > 0)
 * Segment: p1 + u * (p2 - p1) (0 <= u <= 1)
 */
function raySegmentIntersection(
  ox: number, oy: number,
  dx: number, dy: number,
  seg: Segment
): { px: number; py: number; t: number } | null {
  const sx = seg.p2.x - seg.p1.x
  const sy = seg.p2.y - seg.p1.y

  const denom = dx * sy - dy * sx
  if (Math.abs(denom) < RAY_EPSILON) return null

  const diffX = seg.p1.x - ox
  const diffY = seg.p1.y - oy

  const t = (diffX * sy - diffY * sx) / denom
  if (t < RAY_EPSILON) return null

  const u = (diffX * dy - diffY * dx) / denom
  if (u < -TOLERANCE || u > 1 + TOLERANCE) return null

  return {
    px: ox + t * dx,
    py: oy + t * dy,
    t
  }
}

/**
 * Cast a single ray from origin at the given angle, find the nearest hit
 */
function castRay(
  ox: number, oy: number,
  angle: number,
  segments: Segment[]
): RayHit | null {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)

  let bestHit: RayHit | null = null
  let bestT = Infinity

  for (const seg of segments) {
    const result = raySegmentIntersection(ox, oy, dx, dy, seg)
    if (result && result.t < bestT) {
      bestT = result.t
      bestHit = {
        point: { x: result.px, y: result.py },
        distance: result.t,
        ownerId: seg.ownerId,
        ownerType: seg.ownerType,
        segment: seg
      }
    }
  }

  return bestHit
}

/**
 * Refine transition between two angles where different owners are hit.
 * Uses bisection to find the exact angle where the transition occurs.
 * Returns the array of additional hits to insert between the two original hits.
 */
function refineTransition(
  ox: number, oy: number,
  angle1: number, angle2: number,
  hit1: RayHit, hit2: RayHit,
  segments: Segment[],
  depth: number
): RayHit[] {
  if (depth >= MAX_REFINE_DEPTH) return []

  const midAngle = (angle1 + angle2) / 2

  // Angle difference too small to matter
  if (Math.abs(angle2 - angle1) < 0.001) return []

  const midHit = castRay(ox, oy, midAngle, segments)
  if (!midHit) return []

  const results: RayHit[] = []

  // If mid hit has different owner from hit1, refine left half
  if (midHit.ownerId !== hit1.ownerId) {
    results.push(...refineTransition(ox, oy, angle1, midAngle, hit1, midHit, segments, depth + 1))
  }

  results.push(midHit)

  // If mid hit has different owner from hit2, refine right half
  if (midHit.ownerId !== hit2.ownerId) {
    results.push(...refineTransition(ox, oy, midAngle, angle2, midHit, hit2, segments, depth + 1))
  }

  return results
}

/**
 * Find the closest point index in a polyline to a given point
 */
function findClosestPointIndex(
  polyline: Polyline,
  point: { x: number; y: number }
): number {
  let bestIdx = 0
  let bestDist = Infinity

  for (let i = 0; i < polyline.points.length; i++) {
    const p = polyline.points[i]
    const d = (p.x - point.x) ** 2 + (p.y - point.y) ** 2
    if (d < bestDist) {
      bestDist = d
      bestIdx = i
    }
  }

  return bestIdx
}

/**
 * Follow a curve (polyline) between two points on it.
 * Returns the intermediate polyline points for smooth rendering.
 */
function followCurve(
  hit1Point: { x: number; y: number },
  hit2Point: { x: number; y: number },
  polyline: Polyline
): Array<{ x: number; y: number }> {
  if (polyline.points.length < 2) return []

  const idx1 = findClosestPointIndex(polyline, hit1Point)
  const idx2 = findClosestPointIndex(polyline, hit2Point)

  if (idx1 === idx2) return []

  const startIdx = Math.min(idx1, idx2)
  const endIdx = Math.max(idx1, idx2)

  // Extract points between the two indices (exclusive of endpoints since they're already in the polygon)
  const curvePoints: Array<{ x: number; y: number }> = []

  // Decide direction: we want the shorter arc
  // For functions, the polyline is ordered by x, so we typically go from startIdx to endIdx
  // But check if going the other way around would be shorter (for closed polylines — not typical for functions)
  const directCount = endIdx - startIdx
  const wrapCount = polyline.points.length - directCount

  if (directCount <= wrapCount || polyline.type === 'function') {
    // Go direct from startIdx+1 to endIdx-1
    for (let i = startIdx + 1; i < endIdx; i++) {
      curvePoints.push(polyline.points[i])
    }
    // If hit1 was at idx2 (reversed), reverse the curve points
    if (idx1 > idx2) {
      curvePoints.reverse()
    }
  } else {
    // Go the wrap-around way (only relevant for closed polylines)
    for (let i = endIdx + 1; i < polyline.points.length; i++) {
      curvePoints.push(polyline.points[i])
    }
    for (let i = 0; i < startIdx; i++) {
      curvePoints.push(polyline.points[i])
    }
    if (idx1 < idx2) {
      curvePoints.reverse()
    }
  }

  // Subsample if too many points (keep max ~30 points per arc for performance)
  const MAX_ARC_POINTS = 30
  if (curvePoints.length > MAX_ARC_POINTS) {
    const step = curvePoints.length / MAX_ARC_POINTS
    const subsampled: Array<{ x: number; y: number }> = []
    for (let i = 0; i < MAX_ARC_POINTS; i++) {
      subsampled.push(curvePoints[Math.floor(i * step)])
    }
    return subsampled
  }

  return curvePoints
}

/**
 * Build the final polygon from ray hits with curve-following between
 * consecutive hits on the same curve.
 */
function buildPolygonFromHits(
  hits: RayHit[],
  polylineMap: Map<string, Polyline>
): Array<{ x: number; y: number }> {
  if (hits.length < 3) return []

  const polygon: Array<{ x: number; y: number }> = []

  for (let i = 0; i < hits.length; i++) {
    const current = hits[i]
    const next = hits[(i + 1) % hits.length]

    // Add the current hit point
    polygon.push(current.point)

    // If current and next are on the same polyline (and not a boundary),
    // follow the curve between them
    if (current.ownerId === next.ownerId &&
        current.ownerId !== BOUNDARY_ID) {
      const polyline = polylineMap.get(current.ownerId)
      if (polyline) {
        const curvePoints = followCurve(current.point, next.point, polyline)
        polygon.push(...curvePoints)
      }
    }
  }

  return polygon
}

/**
 * Remove duplicate consecutive points from polygon
 */
function deduplicatePolygon(polygon: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (polygon.length < 2) return polygon
  const result: Array<{ x: number; y: number }> = [polygon[0]]
  const minDist = 0.001

  for (let i = 1; i < polygon.length; i++) {
    const prev = result[result.length - 1]
    const curr = polygon[i]
    const dx = curr.x - prev.x
    const dy = curr.y - prev.y
    if (dx * dx + dy * dy > minDist * minDist) {
      result.push(curr)
    }
  }

  // Also check first vs last
  if (result.length > 2) {
    const first = result[0]
    const last = result[result.length - 1]
    const dx = first.x - last.x
    const dy = first.y - last.y
    if (dx * dx + dy * dy < minDist * minDist) {
      result.pop()
    }
  }

  return result
}

/**
 * Main function: find the enclosing region around a drop point
 * using a visibility polygon / radial ray-casting algorithm.
 *
 * Algorithm:
 * 1. Sample all elements as polylines, convert to flat segment list
 * 2. Cast rays in all directions from the drop point
 * 3. Find nearest intersection per ray
 * 4. Refine transitions between different boundaries
 * 5. Follow curves for smooth rendering
 * 6. Extract boundary IDs and domain
 */
export function findEnclosingRegion(
  dropPoint: { x: number; y: number },
  elements: RegionElement[],
  axes: GraphAxes,
  ignoredBoundaryIds?: string[]
): RegionResult | null {
  // Filter out ignored elements
  const activeElements = elements.filter(
    elem => !ignoredBoundaryIds?.includes(elem.id)
  )

  if (activeElements.length === 0) {
    // No active elements — the entire canvas is one region
    const { xMin, xMax, yMin, yMax } = axes
    return {
      polygon: [
        { x: xMin, y: yMin },
        { x: xMax, y: yMin },
        { x: xMax, y: yMax },
        { x: xMin, y: yMax },
      ],
      boundaryIds: [],
      domain: { min: xMin, max: xMax },
    }
  }

  // Step 1: Sample all elements as polylines
  const polylines = activeElements.map(elem => sampleElement(elem, axes))
  const validPolylines = polylines.filter(p => p.points.length >= 2)

  // Build polyline lookup map for curve-following
  const polylineMap = new Map<string, Polyline>()
  for (const pl of validPolylines) {
    polylineMap.set(pl.id, pl)
  }

  // Step 2: Build flat segment list (polylines + canvas boundaries)
  const segments = buildSegmentList(validPolylines, axes)

  if (segments.length === 0) return null

  // Step 3: Cast base rays
  const baseAngles: number[] = []
  const angleStep = (2 * Math.PI) / NUM_BASE_RAYS
  for (let i = 0; i < NUM_BASE_RAYS; i++) {
    baseAngles.push(i * angleStep)
  }

  const baseHits: Array<{ angle: number; hit: RayHit }> = []
  for (const angle of baseAngles) {
    const hit = castRay(dropPoint.x, dropPoint.y, angle, segments)
    if (hit) {
      baseHits.push({ angle, hit })
    }
  }

  if (baseHits.length < 3) return null

  // Step 4: Refine transitions between different boundaries
  const allHits: RayHit[] = []
  for (let i = 0; i < baseHits.length; i++) {
    const current = baseHits[i]
    const next = baseHits[(i + 1) % baseHits.length]

    allHits.push(current.hit)

    // If consecutive hits are on different elements, refine the transition
    if (current.hit.ownerId !== next.hit.ownerId) {
      let a1 = current.angle
      let a2 = next.angle

      // Handle wrap-around (last to first)
      if (i === baseHits.length - 1) {
        a2 = next.angle + 2 * Math.PI
      }

      const refined = refineTransition(
        dropPoint.x, dropPoint.y,
        a1, a2,
        current.hit, next.hit,
        segments,
        0
      )
      allHits.push(...refined)
    }
  }

  if (allHits.length < 3) return null

  // Step 5: Build polygon with curve-following
  const rawPolygon = buildPolygonFromHits(allHits, polylineMap)
  const polygon = deduplicatePolygon(rawPolygon)

  if (polygon.length < 3) return null

  // Step 6: Extract boundary IDs (exclude canvas boundary)
  const boundaryIdSet = new Set<string>()
  for (const hit of allHits) {
    if (hit.ownerId !== BOUNDARY_ID) {
      boundaryIdSet.add(hit.ownerId)
    }
  }
  const boundaryIds = Array.from(boundaryIdSet)

  // Step 7: Compute domain
  let domainMin = Infinity
  let domainMax = -Infinity
  for (const pt of polygon) {
    if (pt.x < domainMin) domainMin = pt.x
    if (pt.x > domainMax) domainMax = pt.x
  }

  return {
    polygon,
    boundaryIds,
    domain: { min: domainMin, max: domainMax }
  }
}
