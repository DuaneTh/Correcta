// Intersection solver exports
export {
  findFunctionIntersections,
  findLineFunctionIntersection,
  findLineLineIntersection
} from './intersection-solver'

// Boundary tracer exports
export {
  generatePolygonBetweenCurves,
  generatePolygonBoundedByElements,
  sampleFunctionInDomain
} from './boundary-tracer'

// Type exports
export type { BoundaryElement } from './boundary-tracer'
