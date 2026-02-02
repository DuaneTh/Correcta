import { ContentSegment, GraphAnchor, GraphArea, GraphAxes, GraphCurve, GraphFunction, GraphLine, GraphPoint, GraphSegment } from '@/types/exams'

export type GraphRenderOptions = {
    scale?: number
    maxWidth?: number
}

export type GraphCoord = { x: number; y: number }

const defaultWidth = 480
const defaultHeight = 280

const safeNumber = (value: unknown, fallback: number): number => {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
}

const extractBraceGroup = (input: string, startIndex: number): { content: string; endIndex: number } | null => {
    if (input[startIndex] !== '{') return null
    let depth = 0
    for (let i = startIndex; i < input.length; i += 1) {
        const ch = input[i]
        if (ch === '{') depth += 1
        if (ch === '}') {
            depth -= 1
            if (depth === 0) {
                return { content: input.slice(startIndex + 1, i), endIndex: i }
            }
        }
    }
    return null
}

export const convertLatexToExpression = (input: string): string => {
    let output = ''
    let i = 0
    while (i < input.length) {
        if (input.startsWith('\\frac', i)) {
            i += 5
            while (input[i] === ' ') i += 1
            const numGroup = extractBraceGroup(input, i)
            if (!numGroup) break
            i = numGroup.endIndex + 1
            while (input[i] === ' ') i += 1
            const denGroup = extractBraceGroup(input, i)
            if (!denGroup) break
            i = denGroup.endIndex + 1
            output += `(${convertLatexToExpression(numGroup.content)})/(${convertLatexToExpression(denGroup.content)})`
            continue
        }
        if (input.startsWith('\\sqrt', i)) {
            i += 5
            while (input[i] === ' ') i += 1
            const radicand = extractBraceGroup(input, i)
            if (!radicand) break
            i = radicand.endIndex + 1
            output += `sqrt(${convertLatexToExpression(radicand.content)})`
            continue
        }
        if (input.startsWith('\\left', i)) {
            i += 5
            continue
        }
        if (input.startsWith('\\right', i)) {
            i += 6
            continue
        }
        const ch = input[i]
        if (ch === '^') {
            if (input[i + 1] === '{') {
                const powerGroup = extractBraceGroup(input, i + 1)
                if (!powerGroup) break
                output += `^(${convertLatexToExpression(powerGroup.content)})`
                i = powerGroup.endIndex + 1
                continue
            }
            output += '^'
            i += 1
            continue
        }
        if (ch === '{') {
            const group = extractBraceGroup(input, i)
            if (!group) break
            output += `(${convertLatexToExpression(group.content)})`
            i = group.endIndex + 1
            continue
        }
        if (ch === '\\') {
            let j = i + 1
            while (j < input.length && /[A-Za-z]/.test(input[j])) {
                j += 1
            }
            const command = input.slice(i + 1, j)
            if (command === 'cdot' || command === 'times') {
                output += '*'
            } else if (command === 'pi') {
                output += 'pi'
            } else if (command === 'ln') {
                output += 'ln'
            } else if (command === 'log') {
                output += 'log'
            } else if (command === 'sin' || command === 'cos' || command === 'tan' || command === 'asin' || command === 'acos'
                || command === 'atan' || command === 'abs' || command === 'exp') {
                output += command
            } else if (command === 'sqrt') {
                output += 'sqrt'
            } else if (command === 'mathrm') {
                while (input[j] === ' ') j += 1
                if (input[j] === '{') {
                    const group = extractBraceGroup(input, j)
                    if (group) {
                        output += convertLatexToExpression(group.content)
                        i = group.endIndex + 1
                        continue
                    }
                }
            }
            i = j
            continue
        }
        if (ch === ' ' || ch === '\n' || ch === '\t') {
            i += 1
            continue
        }
        output += ch
        i += 1
    }
    return output
}

export const normalizeGraphExpression = (expression: string): string => {
    const trimmed = expression.trim()
    if (!trimmed) return ''
    if (!/\\|{|}/.test(trimmed)) {
        return trimmed
    }
    return convertLatexToExpression(trimmed)
}

const getDimensions = (payload: GraphSegment, options?: GraphRenderOptions) => {
    const baseWidth = Math.max(240, safeNumber(payload.width, defaultWidth))
    const baseHeight = Math.max(160, safeNumber(payload.height, defaultHeight))
    const scale = Math.max(0.2, options?.scale ?? 1)
    const maxScale = options?.maxWidth ? Math.min(1, options.maxWidth / baseWidth) : 1
    const finalScale = scale * maxScale
    return {
        width: Math.round(baseWidth * finalScale),
        height: Math.round(baseHeight * finalScale),
        scale: finalScale,
        baseWidth,
        baseHeight,
    }
}

const getAxes = (payload: GraphSegment): GraphAxes => payload.axes

export const resolvePointPosition = (point: GraphPoint, payload: GraphSegment, seen: Set<string> = new Set()): GraphCoord => {
    if (seen.has(point.id)) {
        return { x: point.x, y: point.y }
    }
    seen.add(point.id)
    const anchor = point.anchor
    if (!anchor || anchor.type === 'coord') {
        return { x: point.x, y: point.y }
    }
    if (anchor.type === 'line') {
        const line = payload.lines.find((entry) => entry.id === anchor.lineId)
        if (!line) return { x: point.x, y: point.y }
        const start = resolveAnchor(line.start, payload, seen)
        const end = resolveAnchor(line.end, payload, seen)
        const dx = end.x - start.x
        const dy = end.y - start.y
        let t = safeNumber(anchor.t, 0)
        if (line.kind === 'segment') {
            t = Math.max(0, Math.min(1, t))
        } else if (line.kind === 'ray') {
            t = Math.max(0, t)
        }
        return { x: start.x + dx * t, y: start.y + dy * t }
    }
    if (anchor.type === 'curve') {
        const curve = payload.curves.find((entry) => entry.id === anchor.curveId)
        if (!curve) return { x: point.x, y: point.y }
        const path = buildCurvePath(curve, payload.axes, payload, seen)
        const t = Math.max(0, Math.min(1, safeNumber(anchor.t, 0)))
        const u = 1 - t
        return {
            x: u * u * path.start.x + 2 * u * t * path.control.x + t * t * path.end.x,
            y: u * u * path.start.y + 2 * u * t * path.control.y + t * t * path.end.y,
        }
    }
    if (anchor.type === 'function') {
        const fn = payload.functions.find((entry) => entry.id === anchor.functionId)
        if (!fn) return { x: point.x, y: point.y }
        const evaluator = compileExpression(fn.expression)
        if (!evaluator) return { x: point.x, y: point.y }
        const x = safeNumber(anchor.x, point.x)
        const y = evaluator(x)
        if (!Number.isFinite(y)) return { x: point.x, y: point.y }
        return { x, y }
    }
    return { x: point.x, y: point.y }
}

const resolveAnchor = (anchor: GraphAnchor, payload: GraphSegment, seen?: Set<string>): GraphCoord => {
    if (anchor.type === 'point') {
        const point = payload.points.find((entry) => entry.id === anchor.pointId)
        if (point) return resolvePointPosition(point, payload, seen)
    }
    return {
        x: safeNumber((anchor as { x?: unknown }).x, 0),
        y: safeNumber((anchor as { y?: unknown }).y, 0),
    }
}

const toPixel = (point: GraphCoord, axes: GraphAxes, width: number, height: number): GraphCoord => {
    const xRange = axes.xMax - axes.xMin || 1
    const yRange = axes.yMax - axes.yMin || 1
    return {
        x: ((point.x - axes.xMin) / xRange) * width,
        y: height - ((point.y - axes.yMin) / yRange) * height,
    }
}

const applyStroke = (el: SVGElement, style?: { color?: string; width?: number; dashed?: boolean; opacity?: number }) => {
    const color = style?.color || '#111827'
    const width = safeNumber(style?.width, 1.5)
    el.setAttribute('stroke', color)
    el.setAttribute('stroke-width', String(width))
    el.setAttribute('fill', 'none')
    if (style?.dashed) {
        el.setAttribute('stroke-dasharray', '6 4')
    }
    if (typeof style?.opacity === 'number') {
        el.setAttribute('opacity', String(Math.max(0, Math.min(1, style.opacity))))
    }
}

const applyFill = (el: SVGElement, style?: { color?: string; opacity?: number }) => {
    const color = style?.color || '#6366f1'
    el.setAttribute('fill', color)
    el.setAttribute('stroke', 'none')
    const opacity = typeof style?.opacity === 'number' ? style.opacity : 0.18
    el.setAttribute('fill-opacity', String(Math.max(0, Math.min(1, opacity))))
}

export const compileExpression = (expression: string): ((x: number) => number) | null => {
    const raw = normalizeGraphExpression(expression)
    if (!raw) return null
    if (!/^[0-9xX+\-*/^().,\sA-Za-z_]+$/.test(raw)) return null

    let formula = raw
        .replace(/\^/g, '**')
        .replace(/\bpi\b/gi, 'Math.PI')
        .replace(/\be\b/g, 'Math.E')
        .replace(/\bln\b/gi, 'Math.log')
        .replace(/\blog\b/gi, 'Math.log10')
        .replace(/\bsin\b/gi, 'Math.sin')
        .replace(/\bcos\b/gi, 'Math.cos')
        .replace(/\btan\b/gi, 'Math.tan')
        .replace(/\basin\b/gi, 'Math.asin')
        .replace(/\bacos\b/gi, 'Math.acos')
        .replace(/\batan\b/gi, 'Math.atan')
        .replace(/\bsqrt\b/gi, 'Math.sqrt')
        .replace(/\babs\b/gi, 'Math.abs')
        .replace(/\bexp\b/gi, 'Math.exp')
        .replace(/\bpow\b/gi, 'Math.pow')

    try {
        const fn = new Function('x', `return (${formula});`) as (x: number) => number
        fn(0)
        return fn
    } catch {
        return null
    }
}

const lineIntersections = (p1: GraphCoord, p2: GraphCoord, axes: GraphAxes): GraphCoord[] => {
    const xMin = axes.xMin
    const xMax = axes.xMax
    const yMin = axes.yMin
    const yMax = axes.yMax
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const results: GraphCoord[] = []

    const addIfValid = (t: number) => {
        if (!Number.isFinite(t)) return
        const x = p1.x + t * dx
        const y = p1.y + t * dy
        if (x >= xMin - 1e-6 && x <= xMax + 1e-6 && y >= yMin - 1e-6 && y <= yMax + 1e-6) {
            results.push({ x, y })
        }
    }

    if (dx !== 0) {
        addIfValid((xMin - p1.x) / dx)
        addIfValid((xMax - p1.x) / dx)
    }
    if (dy !== 0) {
        addIfValid((yMin - p1.y) / dy)
        addIfValid((yMax - p1.y) / dy)
    }

    const unique: GraphCoord[] = []
    results.forEach((point) => {
        if (!unique.some((entry) => Math.abs(entry.x - point.x) < 1e-6 && Math.abs(entry.y - point.y) < 1e-6)) {
            unique.push(point)
        }
    })
    return unique
}

const findRayEnd = (start: GraphCoord, through: GraphCoord, axes: GraphAxes): GraphCoord => {
    const intersections = lineIntersections(start, through, axes)
    const dx = through.x - start.x
    const dy = through.y - start.y
    let best = through
    let bestT = -Infinity
    intersections.forEach((point) => {
        const t = Math.abs(dx) > Math.abs(dy)
            ? (point.x - start.x) / (dx || 1)
            : (point.y - start.y) / (dy || 1)
        if (t >= 0 && t > bestT) {
            bestT = t
            best = point
        }
    })
    return best
}

const buildLinePath = (line: GraphLine, axes: GraphAxes, payload: GraphSegment, seen?: Set<string>): { start: GraphCoord; end: GraphCoord } | null => {
    const start = resolveAnchor(line.start, payload, seen)
    const end = resolveAnchor(line.end, payload, seen)

    if (line.kind === 'segment') {
        return { start, end }
    }

    const intersections = lineIntersections(start, end, axes)
    if (intersections.length < 2) return null

    if (line.kind === 'line') {
        return { start: intersections[0], end: intersections[1] }
    }

    if (line.kind === 'ray') {
        const rayEnd = findRayEnd(start, end, axes)
        return { start, end: rayEnd }
    }

    return null
}

const buildCurvePath = (curve: GraphCurve, axes: GraphAxes, payload: GraphSegment, seen?: Set<string>): { start: GraphCoord; control: GraphCoord; end: GraphCoord } => {
    const start = resolveAnchor(curve.start, payload, seen)
    const end = resolveAnchor(curve.end, payload, seen)
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
    const dx = end.x - start.x
    const dy = end.y - start.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const normal = { x: -dy / len, y: dx / len }
    const curvature = safeNumber(curve.curvature, 0)
    const control = {
        x: mid.x + normal.x * curvature,
        y: mid.y + normal.y * curvature,
    }
    return { start, control, end }
}

export const sampleFunction = (fn: GraphFunction, axes: GraphAxes): GraphCoord[] => {
    const evaluator = compileExpression(fn.expression)
    if (!evaluator) return []
    const minX = typeof fn.domain?.min === 'number' ? fn.domain.min : axes.xMin
    const maxX = typeof fn.domain?.max === 'number' ? fn.domain.max : axes.xMax
    const samples = Math.max(80, Math.round((maxX - minX) * 12))
    const points: GraphCoord[] = []
    for (let i = 0; i <= samples; i++) {
        const x = minX + ((maxX - minX) * i) / samples
        let y = evaluator(x)
        if (!Number.isFinite(y)) continue
        points.push({ x, y })
    }
    return points
}

const buildAreaPath = (
    area: GraphArea,
    functions: GraphFunction[],
    axes: GraphAxes,
    payload: GraphSegment
): GraphCoord[] => {
    if (area.mode === 'polygon') {
        return (area.points || []).map((anchor) => resolveAnchor(anchor, payload))
    }

    if (area.mode === 'under-function' && area.functionId) {
        const fn = functions.find((entry) => entry.id === area.functionId)
        if (!fn) return []
        const samples = sampleFunction(fn, axes)
        if (samples.length === 0) return []
        const minX = typeof area.domain?.min === 'number' ? area.domain.min : samples[0].x
        const maxX = typeof area.domain?.max === 'number' ? area.domain.max : samples[samples.length - 1].x
        const filtered = samples.filter((pt) => pt.x >= minX && pt.x <= maxX)
        if (filtered.length === 0) return []
        const baseY = 0
        return [
            { x: filtered[0].x, y: baseY },
            ...filtered,
            { x: filtered[filtered.length - 1].x, y: baseY },
        ]
    }

    if (area.mode === 'between-functions' && area.functionId && area.functionId2) {
        const fn1 = functions.find((entry) => entry.id === area.functionId)
        const fn2 = functions.find((entry) => entry.id === area.functionId2)
        if (!fn1 || !fn2) return []
        const samples1 = sampleFunction(fn1, axes)
        const samples2 = sampleFunction(fn2, axes)
        if (samples1.length === 0 || samples2.length === 0) return []
        const minX = typeof area.domain?.min === 'number' ? area.domain.min : Math.max(samples1[0].x, samples2[0].x)
        const maxX = typeof area.domain?.max === 'number' ? area.domain.max : Math.min(samples1[samples1.length - 1].x, samples2[samples2.length - 1].x)
        const filtered1 = samples1.filter((pt) => pt.x >= minX && pt.x <= maxX)
        const filtered2 = samples2.filter((pt) => pt.x >= minX && pt.x <= maxX).reverse()
        if (filtered1.length === 0 || filtered2.length === 0) return []
        return [...filtered1, ...filtered2]
    }

    return []
}

const createSvg = (width: number, height: number) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', String(width))
    svg.setAttribute('height', String(height))
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    svg.setAttribute('preserveAspectRatio', 'xMinYMin meet')
    svg.style.display = 'block'
    return svg
}

const appendGrid = (svg: SVGElement, axes: GraphAxes, width: number, height: number) => {
    if (!axes.showGrid) return
    const xStep = Math.max(0.1, safeNumber(axes.xStep ?? axes.gridStep, 1))
    const yStep = Math.max(0.1, safeNumber(axes.yStep ?? axes.gridStep, 1))
    const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    gridGroup.setAttribute('stroke', '#e5e7eb')
    gridGroup.setAttribute('stroke-width', '1')
    gridGroup.setAttribute('opacity', '0.8')

    const xStart = Math.ceil(axes.xMin / xStep) * xStep
    const xEnd = Math.floor(axes.xMax / xStep) * xStep
    for (let x = xStart; x <= xEnd; x += xStep) {
        const px = toPixel({ x, y: axes.yMin }, axes, width, height).x
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        line.setAttribute('x1', String(px))
        line.setAttribute('y1', '0')
        line.setAttribute('x2', String(px))
        line.setAttribute('y2', String(height))
        gridGroup.appendChild(line)
    }

    const yStart = Math.ceil(axes.yMin / yStep) * yStep
    const yEnd = Math.floor(axes.yMax / yStep) * yStep
    for (let y = yStart; y <= yEnd; y += yStep) {
        const py = toPixel({ x: axes.xMin, y }, axes, width, height).y
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        line.setAttribute('x1', '0')
        line.setAttribute('y1', String(py))
        line.setAttribute('x2', String(width))
        line.setAttribute('y2', String(py))
        gridGroup.appendChild(line)
    }

    svg.appendChild(gridGroup)
}

const appendAxes = (svg: SVGElement, axes: GraphAxes, width: number, height: number) => {
    const axisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    axisGroup.setAttribute('stroke', '#6b7280')
    axisGroup.setAttribute('stroke-width', '1.25')

    if (axes.xMin <= 0 && axes.xMax >= 0) {
        const px = toPixel({ x: 0, y: axes.yMin }, axes, width, height).x
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        line.setAttribute('x1', String(px))
        line.setAttribute('y1', '0')
        line.setAttribute('x2', String(px))
        line.setAttribute('y2', String(height))
        axisGroup.appendChild(line)
    }

    if (axes.yMin <= 0 && axes.yMax >= 0) {
        const py = toPixel({ x: axes.xMin, y: 0 }, axes, width, height).y
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        line.setAttribute('x1', '0')
        line.setAttribute('y1', String(py))
        line.setAttribute('x2', String(width))
        line.setAttribute('y2', String(py))
        axisGroup.appendChild(line)
    }

    svg.appendChild(axisGroup)
}

const appendLines = (svg: SVGElement, lines: GraphLine[], axes: GraphAxes, payload: GraphSegment, width: number, height: number) => {
    lines.forEach((line) => {
        const path = buildLinePath(line, axes, payload)
        if (!path) return
        const start = toPixel(path.start, axes, width, height)
        const end = toPixel(path.end, axes, width, height)
        const lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        lineEl.setAttribute('x1', String(start.x))
        lineEl.setAttribute('y1', String(start.y))
        lineEl.setAttribute('x2', String(end.x))
        lineEl.setAttribute('y2', String(end.y))
        applyStroke(lineEl, line.style)
        svg.appendChild(lineEl)
    })
}

const appendCurves = (svg: SVGElement, curves: GraphCurve[], axes: GraphAxes, payload: GraphSegment, width: number, height: number) => {
    curves.forEach((curve) => {
        const path = buildCurvePath(curve, axes, payload)
        const start = toPixel(path.start, axes, width, height)
        const control = toPixel(path.control, axes, width, height)
        const end = toPixel(path.end, axes, width, height)
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        pathEl.setAttribute('d', `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`)
        applyStroke(pathEl, curve.style)
        svg.appendChild(pathEl)
    })
}

const appendFunctions = (svg: SVGElement, functions: GraphFunction[], axes: GraphAxes, width: number, height: number) => {
    functions.forEach((fn) => {
        const samples = sampleFunction(fn, axes)
        if (samples.length === 0) return
        let d = ''
        samples.forEach((point, index) => {
            const px = toPixel(point, axes, width, height)
            d += `${index === 0 ? 'M' : 'L'} ${px.x} ${px.y} `
        })
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        pathEl.setAttribute('d', d.trim())
        applyStroke(pathEl, fn.style)
        svg.appendChild(pathEl)
    })
}

const appendAreas = (svg: SVGElement, areas: GraphArea[], functions: GraphFunction[], axes: GraphAxes, payload: GraphSegment, width: number, height: number) => {
    areas.forEach((area) => {
        const outline = buildAreaPath(area, functions, axes, payload)
        if (outline.length < 3) return
        const pointsAttr = outline
            .map((pt) => {
                const pixel = toPixel(pt, axes, width, height)
                return `${pixel.x},${pixel.y}`
            })
            .join(' ')
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
        polygon.setAttribute('points', pointsAttr)
        applyFill(polygon, area.fill)
        svg.appendChild(polygon)
    })
}

const appendPoints = (svg: SVGElement, points: GraphPoint[], axes: GraphAxes, payload: GraphSegment, width: number, height: number) => {
    points.forEach((point) => {
        const resolved = resolvePointPosition(point, payload)
        const px = toPixel(resolved, axes, width, height)
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        circle.setAttribute('cx', String(px.x))
        circle.setAttribute('cy', String(px.y))
        const radius = Math.max(2, safeNumber(point.size, 4))
        circle.setAttribute('r', String(radius))
        circle.setAttribute('stroke', point.color || '#111827')
        circle.setAttribute('stroke-width', '1.5')
        circle.setAttribute('fill', point.filled === false ? 'white' : (point.color || '#111827'))
        svg.appendChild(circle)
    })
}

const appendLabels = (
    labels: HTMLElement,
    payload: GraphSegment,
    width: number,
    height: number,
    scale: number
) => {
    const axes = payload.axes
    const axisX = axes.xMin <= 0 && axes.xMax >= 0
        ? toPixel({ x: 0, y: axes.yMin }, axes, width, height).x
        : null
    const axisY = axes.yMin <= 0 && axes.yMax >= 0
        ? toPixel({ x: axes.xMin, y: 0 }, axes, width, height).y
        : null
    const hasSegmentsContent = (segments?: ContentSegment[]) => (
        Array.isArray(segments) && segments.some((seg) => {
            if (seg.type === 'math') {
                return Boolean(seg.latex?.trim())
            }
            if (seg.type === 'text') {
                return Boolean(seg.text?.trim())
            }
            return false
        })
    )
    const hasLabelContent = (label?: string, segments?: ContentSegment[]) => (
        Boolean(label?.trim()) || hasSegmentsContent(segments)
    )
    const addLabel = (text: string, x: number, y: number, isMath?: boolean, align?: string, fontSize?: number) => {
        if (!text) return
        const label = document.createElement('span')
        label.style.position = 'absolute'
        label.style.left = `${x}px`
        label.style.top = `${y}px`
        const size = typeof fontSize === 'number' ? fontSize : 12
        label.style.fontSize = `${Math.max(8, size * scale)}px`
        label.style.color = '#111827'
        label.style.pointerEvents = 'none'
        label.style.whiteSpace = 'nowrap'
        label.style.transform = align || 'translate(-50%, -50%)'
        if (isMath) {
            label.className = 'math-inline'
            label.textContent = `$${text}$`
        } else {
            label.textContent = text
        }
        labels.appendChild(label)
    }
    const addSegmentsLabel = (segments: ContentSegment[], x: number, y: number, align?: string, fontSize?: number) => {
        if (!hasSegmentsContent(segments)) return
        const label = document.createElement('span')
        label.style.position = 'absolute'
        label.style.left = `${x}px`
        label.style.top = `${y}px`
        const size = typeof fontSize === 'number' ? fontSize : 12
        label.style.fontSize = `${Math.max(8, size * scale)}px`
        label.style.color = '#111827'
        label.style.pointerEvents = 'none'
        label.style.whiteSpace = 'nowrap'
        label.style.transform = align || 'translate(-50%, -50%)'
        segments.forEach((seg) => {
            if (seg.type === 'text') {
                if (seg.text) label.appendChild(document.createTextNode(seg.text))
                return
            }
            if (seg.type === 'math') {
                const span = document.createElement('span')
                span.className = 'math-inline'
                span.textContent = `$${seg.latex || ''}$`
                label.appendChild(span)
            }
        })
        labels.appendChild(label)
    }

    payload.points.forEach((point) => {
        if (point.showLabel === false || !hasLabelContent(point.label, point.labelSegments)) return
        const resolved = resolvePointPosition(point, payload)
        const base = point.labelPos ? point.labelPos : resolved
        const pixel = toPixel(base, axes, width, height)
        const offsetX = point.labelPos ? 0 : 8
        const offsetY = point.labelPos ? 0 : -8
        if (hasSegmentsContent(point.labelSegments)) {
            addSegmentsLabel(
                point.labelSegments || [],
                pixel.x + offsetX,
                pixel.y + offsetY,
                'translate(0, -50%)',
                safeNumber(point.labelSize, 12)
            )
        } else if (point.label) {
            addLabel(
                point.label,
                pixel.x + offsetX,
                pixel.y + offsetY,
                point.labelIsMath,
                'translate(0, -50%)',
                safeNumber(point.labelSize, 12)
            )
        }
    })

    const addElementLabel = (
        label?: string,
        labelSegments?: ContentSegment[],
        labelIsMath?: boolean,
        labelPos?: { x: number; y: number },
        fontSize?: number
    ) => {
        if (!labelPos || !hasLabelContent(label, labelSegments)) return
        const pixel = toPixel(labelPos, axes, width, height)
        if (hasSegmentsContent(labelSegments)) {
            addSegmentsLabel(labelSegments || [], pixel.x, pixel.y, 'translate(-50%, -50%)', fontSize)
        } else if (label) {
            addLabel(label, pixel.x, pixel.y, labelIsMath, 'translate(-50%, -50%)', fontSize)
        }
    }

    const defaultLineLabelPos = (line: GraphLine): { x: number; y: number } | null => {
        const path = buildLinePath(line, axes, payload)
        if (!path) return null
        return { x: (path.start.x + path.end.x) / 2, y: (path.start.y + path.end.y) / 2 }
    }

    const defaultCurveLabelPos = (curve: GraphCurve): { x: number; y: number } => {
        const path = buildCurvePath(curve, axes, payload)
        const t = 0.5
        const u = 1 - t
        return {
            x: u * u * path.start.x + 2 * u * t * path.control.x + t * t * path.end.x,
            y: u * u * path.start.y + 2 * u * t * path.control.y + t * t * path.end.y,
        }
    }

    const defaultFunctionLabelPos = (fn: GraphFunction): { x: number; y: number } | null => {
        const evaluator = compileExpression(fn.expression)
        if (!evaluator) return null
        const minX = typeof fn.domain?.min === 'number' ? fn.domain.min : axes.xMin
        const maxX = typeof fn.domain?.max === 'number' ? fn.domain.max : axes.xMax
        const x = (minX + maxX) / 2
        const y = evaluator(x)
        if (!Number.isFinite(y)) return null
        return { x, y }
    }

    const defaultAreaLabelPos = (area: GraphArea): { x: number; y: number } | null => {
        if (area.mode === 'polygon') {
            const points = (area.points || []).map((anchor) => resolveAnchor(anchor, payload))
            if (points.length === 0) return null
            const sum = points.reduce((acc, pt) => ({ x: acc.x + pt.x, y: acc.y + pt.y }), { x: 0, y: 0 })
            return { x: sum.x / points.length, y: sum.y / points.length }
        }
        if (area.mode === 'under-function' && area.functionId) {
            const fn = payload.functions.find((entry) => entry.id === area.functionId)
            if (!fn) return null
            const evaluator = compileExpression(fn.expression)
            if (!evaluator) return null
            const minX = typeof area.domain?.min === 'number' ? area.domain.min : axes.xMin
            const maxX = typeof area.domain?.max === 'number' ? area.domain.max : axes.xMax
            const x = (minX + maxX) / 2
            const y = evaluator(x)
            if (!Number.isFinite(y)) return null
            return { x, y: y / 2 }
        }
        if (area.mode === 'between-functions' && area.functionId && area.functionId2) {
            const fn1 = payload.functions.find((entry) => entry.id === area.functionId)
            const fn2 = payload.functions.find((entry) => entry.id === area.functionId2)
            if (!fn1 || !fn2) return null
            const eval1 = compileExpression(fn1.expression)
            const eval2 = compileExpression(fn2.expression)
            if (!eval1 || !eval2) return null
            const minX = typeof area.domain?.min === 'number' ? area.domain.min : axes.xMin
            const maxX = typeof area.domain?.max === 'number' ? area.domain.max : axes.xMax
            const x = (minX + maxX) / 2
            const y1 = eval1(x)
            const y2 = eval2(x)
            if (!Number.isFinite(y1) || !Number.isFinite(y2)) return null
            return { x, y: (y1 + y2) / 2 }
        }
        return null
    }

    payload.lines.forEach((line) => {
        if (line.showLabel === false || !hasLabelContent(line.label, line.labelSegments)) return
        const pos = line.labelPos || defaultLineLabelPos(line)
        addElementLabel(line.label, line.labelSegments, line.labelIsMath, pos || undefined)
    })

    payload.curves.forEach((curve) => {
        if (curve.showLabel === false || !hasLabelContent(curve.label, curve.labelSegments)) return
        const pos = curve.labelPos || defaultCurveLabelPos(curve)
        addElementLabel(curve.label, curve.labelSegments, curve.labelIsMath, pos || undefined)
    })

    payload.functions.forEach((fn) => {
        if (fn.showLabel === false || !hasLabelContent(fn.label, fn.labelSegments)) return
        const pos = fn.labelPos || defaultFunctionLabelPos(fn)
        addElementLabel(fn.label, fn.labelSegments, fn.labelIsMath, pos || undefined)
    })

    payload.areas.forEach((area) => {
        if (area.showLabel === false || !hasLabelContent(area.label, area.labelSegments)) return
        const pos = area.labelPos || defaultAreaLabelPos(area)
        addElementLabel(area.label, area.labelSegments, area.labelIsMath, pos || undefined)
    })

    payload.texts.forEach((text) => {
        const pixel = toPixel({ x: text.x, y: text.y }, axes, width, height)
        if (hasSegmentsContent(text.textSegments)) {
            addSegmentsLabel(text.textSegments || [], pixel.x, pixel.y)
        } else {
            addLabel(text.text, pixel.x, pixel.y, text.isMath)
        }
    })

    if (axes.xLabel) {
        const y = axisY === null ? height - 6 : Math.min(height - 6, axisY + 8)
        addLabel(axes.xLabel, width - 6, y, axes.xLabelIsMath, 'translate(-100%, 0)')
    } else if (hasSegmentsContent(axes.xLabelSegments)) {
        const y = axisY === null ? height - 6 : Math.min(height - 6, axisY + 8)
        addSegmentsLabel(axes.xLabelSegments || [], width - 6, y, 'translate(-100%, 0)')
    }
    if (axes.yLabel) {
        const x = axisX === null ? 8 : Math.min(width - 6, axisX + 8)
        const y = 6
        addLabel(axes.yLabel, x, y, axes.yLabelIsMath, 'translate(0, 0)')
    } else if (hasSegmentsContent(axes.yLabelSegments)) {
        const x = axisX === null ? 8 : Math.min(width - 6, axisX + 8)
        const y = 6
        addSegmentsLabel(axes.yLabelSegments || [], x, y, 'translate(0, 0)')
    }
}

export const renderGraphInto = (container: HTMLElement, payload: GraphSegment, options?: GraphRenderOptions) => {
    while (container.firstChild) {
        container.removeChild(container.firstChild)
    }

    const { width, height, scale, baseWidth, baseHeight } = getDimensions(payload, options)
    const axes = getAxes(payload)
    const canvas = document.createElement('div')
    canvas.style.position = 'relative'
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.style.background = payload.background || 'white'
    canvas.style.border = '1px solid #e5e7eb'
    canvas.style.borderRadius = '8px'
    canvas.style.overflow = 'hidden'

    const svg = createSvg(baseWidth, baseHeight)
    svg.style.width = `${width}px`
    svg.style.height = `${height}px`
    svg.style.display = 'block'

    appendGrid(svg, axes, baseWidth, baseHeight)
    appendAreas(svg, payload.areas, payload.functions, axes, payload, baseWidth, baseHeight)
    appendAxes(svg, axes, baseWidth, baseHeight)
    appendLines(svg, payload.lines, axes, payload, baseWidth, baseHeight)
    appendCurves(svg, payload.curves, axes, payload, baseWidth, baseHeight)
    appendFunctions(svg, payload.functions, axes, baseWidth, baseHeight)
    appendPoints(svg, payload.points, axes, payload, baseWidth, baseHeight)

    const labels = document.createElement('div')
    labels.style.position = 'absolute'
    labels.style.inset = '0'
    labels.style.pointerEvents = 'none'

    appendLabels(labels, payload, width, height, scale)

    canvas.appendChild(svg)
    canvas.appendChild(labels)
    container.appendChild(canvas)
}
