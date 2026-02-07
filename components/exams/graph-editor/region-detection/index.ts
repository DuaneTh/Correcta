// Intersection solver exports (UNCHANGED)
export {
  findFunctionIntersections,
  findLineFunctionIntersection,
  findLineLineIntersection
} from './intersection-solver'

// Region finder (NEW, replaces boundary-tracer)
export {
  findEnclosingRegion,
} from './region-finder'

export type { RegionElement, RegionResult } from './region-finder'
