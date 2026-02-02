import { GraphAxes } from '@/types/exams'

/**
 * Converts graph coordinates to canvas pixel coordinates.
 * Note: Y-axis is inverted (graph Y increases upward, pixel Y increases downward)
 *
 * Example:
 * - Graph (0,0) with axes -5..5 on 480x280 canvas = pixel (240, 140)
 * - Graph (-5,-5) with axes -5..5 on 480x280 canvas = pixel (0, 280)
 * - Graph (5,5) with axes -5..5 on 480x280 canvas = pixel (480, 0)
 */
export function graphToPixel(
    point: { x: number; y: number },
    axes: GraphAxes,
    canvasWidth: number,
    canvasHeight: number
): { x: number; y: number } {
    const xRange = axes.xMax - axes.xMin
    const yRange = axes.yMax - axes.yMin

    const pixelX = ((point.x - axes.xMin) / xRange) * canvasWidth
    const pixelY = canvasHeight - ((point.y - axes.yMin) / yRange) * canvasHeight

    return { x: pixelX, y: pixelY }
}

/**
 * Converts canvas pixel coordinates to graph coordinates.
 * Inverse of graphToPixel.
 *
 * Example:
 * - Pixel (240, 140) with axes -5..5 on 480x280 canvas = graph (0, 0)
 * - Pixel (0, 280) with axes -5..5 on 480x280 canvas = graph (-5, -5)
 * - Pixel (480, 0) with axes -5..5 on 480x280 canvas = graph (5, 5)
 */
export function pixelToGraph(
    pixel: { x: number; y: number },
    axes: GraphAxes,
    canvasWidth: number,
    canvasHeight: number
): { x: number; y: number } {
    const xRange = axes.xMax - axes.xMin
    const yRange = axes.yMax - axes.yMin

    const graphX = axes.xMin + (pixel.x / canvasWidth) * xRange
    const graphY = axes.yMin + ((canvasHeight - pixel.y) / canvasHeight) * yRange

    return { x: graphX, y: graphY }
}

/**
 * Snaps a value to the nearest grid step.
 *
 * Example:
 * - snapToGrid(3.7, 1) = 4
 * - snapToGrid(3.7, 0.5) = 3.5
 * - snapToGrid(3.7, 0.25) = 3.75
 */
export function snapToGrid(value: number, gridStep: number): number {
    if (gridStep <= 0) return value
    return Math.round(value / gridStep) * gridStep
}
