import {
    ContentSegment,
    TableCell,
    GraphLine,
    GraphCurve,
    GraphPoint,
    GraphFunction,
    GraphArea,
    GraphText,
} from '@/types/exams'

const createSegmentId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return `seg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const maxGraphWidth = 820

const sanitizeText = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    return String(value)
}

function normalizeTableRows(rows: unknown): TableCell[][] {
    if (!Array.isArray(rows) || rows.length === 0) {
        return [[[createTextSegment('')]]]
    }

    return rows.map((row) => {
        if (!Array.isArray(row) || row.length === 0) {
            return [[createTextSegment('')]]
        }

        return row.map((cell) => {
            if (!Array.isArray(cell) || cell.length === 0) {
                return [createTextSegment('')]
            }

            const normalized = cell.map((segment) => normalizeSegment(segment, 'text'))
            return normalized.length > 0 ? normalized : [createTextSegment('')]
        })
    })
}

const normalizeNumber = (value: unknown, fallback: number): number => {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
}

const normalizeTablePayload = (segment: Partial<ContentSegment> | undefined) => {
    const rowsInput = (segment as Extract<ContentSegment, { type: 'table' }>)?.rows
    const rows = normalizeTableRows(rowsInput)
    const cols = rows[0]?.length ?? 1
    const colWidthsInput = (segment as Extract<ContentSegment, { type: 'table' }>)?.colWidths
    const rowHeightsInput = (segment as Extract<ContentSegment, { type: 'table' }>)?.rowHeights

    const colWidths = Array.isArray(colWidthsInput) && colWidthsInput.length === cols
        ? colWidthsInput.map((value) => Math.max(24, Number(value) || 0))
        : undefined
    const rowHeights = Array.isArray(rowHeightsInput) && rowHeightsInput.length === rows.length
        ? rowHeightsInput.map((value) => Math.max(24, Number(value) || 0))
        : undefined

    return { rows, colWidths, rowHeights }
}

const normalizeGraphAnchor = (value: unknown) => {
    const anchor = value as { type?: string; pointId?: string; x?: unknown; y?: unknown } | undefined
    if (anchor?.type === 'point' && typeof anchor.pointId === 'string') {
        return { type: 'point' as const, pointId: anchor.pointId }
    }
    return {
        type: 'coord' as const,
        x: normalizeNumber(anchor?.x, 0),
        y: normalizeNumber(anchor?.y, 0),
    }
}

const normalizeGraphPayload = (segment: Partial<ContentSegment> | undefined) => {
    const graph = segment as Extract<ContentSegment, { type: 'graph' }> | undefined
    const axesInput = graph?.axes
    const axes = {
        xMin: normalizeNumber(axesInput?.xMin, -5),
        xMax: normalizeNumber(axesInput?.xMax, 5),
        yMin: normalizeNumber(axesInput?.yMin, -5),
        yMax: normalizeNumber(axesInput?.yMax, 5),
        xLabel: typeof axesInput?.xLabel === 'string' ? axesInput?.xLabel : '',
        yLabel: typeof axesInput?.yLabel === 'string' ? axesInput?.yLabel : '',
        xLabelIsMath: Boolean(axesInput?.xLabelIsMath),
        yLabelIsMath: Boolean(axesInput?.yLabelIsMath),
        showGrid: axesInput?.showGrid !== false,
        gridStep: normalizeNumber(axesInput?.gridStep, 1),
    }
    if (axes.xMax <= axes.xMin) {
        axes.xMin = -5
        axes.xMax = 5
    }
    if (axes.yMax <= axes.yMin) {
        axes.yMin = -5
        axes.yMax = 5
    }

    const points: GraphPoint[] = Array.isArray(graph?.points)
        ? graph!.points.map((point) => ({
            id: point?.id || createSegmentId(),
            x: normalizeNumber(point?.x, 0),
            y: normalizeNumber(point?.y, 0),
            label: typeof point?.label === 'string' ? point.label : '',
            labelIsMath: Boolean(point?.labelIsMath),
            color: typeof point?.color === 'string' ? point.color : undefined,
            size: normalizeNumber(point?.size, 4),
            filled: point?.filled !== false,
        }))
        : []

    const lines: GraphLine[] = Array.isArray(graph?.lines)
        ? graph!.lines.map((line) => ({
            id: line?.id || createSegmentId(),
            start: normalizeGraphAnchor(line?.start),
            end: normalizeGraphAnchor(line?.end),
            kind: (line?.kind === 'line' || line?.kind === 'ray' ? line.kind : 'segment') as GraphLine['kind'],
            style: line?.style,
        }))
        : []

    const curves: GraphCurve[] = Array.isArray(graph?.curves)
        ? graph!.curves.map((curve) => ({
            id: curve?.id || createSegmentId(),
            start: normalizeGraphAnchor(curve?.start),
            end: normalizeGraphAnchor(curve?.end),
            curvature: normalizeNumber(curve?.curvature, 0),
            style: curve?.style,
        }))
        : []

    const functions: GraphFunction[] = Array.isArray(graph?.functions)
        ? graph!.functions.map((fn) => ({
            id: fn?.id || createSegmentId(),
            expression: typeof fn?.expression === 'string' ? fn.expression : '',
            domain: fn?.domain,
            offsetX: typeof fn?.offsetX === 'number' ? fn.offsetX : undefined,
            offsetY: typeof fn?.offsetY === 'number' ? fn.offsetY : undefined,
            scaleY: typeof fn?.scaleY === 'number' ? fn.scaleY : undefined,
            style: fn?.style,
        }))
        : []

    const areas: GraphArea[] = Array.isArray(graph?.areas)
        ? graph!.areas.map((area) => ({
            id: area?.id || createSegmentId(),
            mode: (area?.mode === 'under-function' || area?.mode === 'between-functions'
                ? area.mode
                : 'polygon') as GraphArea['mode'],
            points: Array.isArray(area?.points) ? area.points.map((point) => normalizeGraphAnchor(point)) : undefined,
            functionId: typeof area?.functionId === 'string' ? area.functionId : undefined,
            functionId2: typeof area?.functionId2 === 'string' ? area.functionId2 : undefined,
            domain: area?.domain,
            fill: area?.fill,
        }))
        : []

    const texts: GraphText[] = Array.isArray(graph?.texts)
        ? graph!.texts.map((text) => ({
            id: text?.id || createSegmentId(),
            x: normalizeNumber(text?.x, 0),
            y: normalizeNumber(text?.y, 0),
            text: typeof text?.text === 'string' ? text.text : '',
            isMath: Boolean(text?.isMath),
        }))
        : []

    return {
        axes,
        points,
        lines,
        curves,
        functions,
        areas,
        texts,
        width: Math.min(maxGraphWidth, normalizeNumber(graph?.width, 480)),
        height: normalizeNumber(graph?.height, 280),
        background: typeof graph?.background === 'string' ? graph.background : undefined,
    }
}

function normalizeSegment(segment: Partial<ContentSegment>, fallback: 'text' | 'math' = 'text'): ContentSegment {
    if (segment?.type === 'table') {
        const payload = normalizeTablePayload(segment)
        return {
            id: segment.id || createSegmentId(),
            type: 'table',
            rows: payload.rows,
            colWidths: payload.colWidths,
            rowHeights: payload.rowHeights,
        }
    }

    if (segment?.type === 'graph') {
        const payload = normalizeGraphPayload(segment)
        return {
            id: segment.id || createSegmentId(),
            type: 'graph',
            axes: payload.axes,
            points: payload.points,
            lines: payload.lines,
            curves: payload.curves,
            functions: payload.functions,
            areas: payload.areas,
            texts: payload.texts,
            width: payload.width,
            height: payload.height,
            background: payload.background,
        }
    }

    if (segment?.type === 'math') {
        return {
            id: segment.id || createSegmentId(),
            type: 'math',
            latex: sanitizeText((segment as Extract<ContentSegment, { type: 'math' }>).latex),
        }
    }

    if (segment?.type === 'text') {
        return {
            id: segment.id || createSegmentId(),
            type: 'text',
            text: sanitizeText((segment as Extract<ContentSegment, { type: 'text' }>).text),
        }
    }

    return fallback === 'math'
        ? { id: createSegmentId(), type: 'math', latex: '' }
        : { id: createSegmentId(), type: 'text', text: '' }
}

export const createTextSegment = (text: string): ContentSegment => ({
    id: createSegmentId(),
    type: 'text',
    text,
})

export const createMathSegment = (latex: string): ContentSegment => ({
    id: createSegmentId(),
    type: 'math',
    latex,
})

export const parseContent = (raw: unknown): ContentSegment[] => {
    if (Array.isArray(raw)) {
        const segments = raw as Array<Partial<ContentSegment>>
        if (segments.length === 0) return [createTextSegment('')]
        return segments.map((segment) => normalizeSegment(segment))
    }

    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) {
                const segments = parsed as Array<Partial<ContentSegment>>
                if (segments.length === 0) return [createTextSegment('')]
                return segments.map((segment) => normalizeSegment(segment))
            }
        } catch {
            // Not JSON, fall back to legacy string
        }
        return [createTextSegment(raw)]
    }

    return [createTextSegment('')]
}

export const serializeContent = (segments: ContentSegment[]): string => {
    const normalized = segments.map((segment) =>
        normalizeSegment(segment, segment.type === 'math' ? 'math' : 'text')
    )
    return JSON.stringify(normalized)
}

export const segmentsToLatexString = (segments: ContentSegment[]): string => {
    if (!segments || segments.length === 0) return ''
    const toLatex = (value: ContentSegment[]): string =>
        value
            .map((segment) => {
                if (segment.type === 'math') {
                    return `$${segment.latex}$`
                }
                if (segment.type === 'graph') {
                    return '[graph]'
                }
                if (segment.type === 'table') {
                    return segment.rows
                        .map((row) => row.map((cell) => toLatex(cell)).join('\t'))
                        .join('\n')
                }
                if (segment.type === 'image') {
                    return `![${segment.alt || 'image'}](${segment.url})`
                }
                return segment.text
            })
            .join('')

    return toLatex(segments)
}

export const segmentsToPlainText = (segments: ContentSegment[]): string => {
    if (!segments || segments.length === 0) return ''
    const toPlain = (value: ContentSegment[]): string =>
        value
            .map((segment) => {
                if (segment.type === 'math') return segment.latex
                if (segment.type === 'graph') return '[graph]'
                if (segment.type === 'image') return '[image]'
                if (segment.type === 'table') {
                    return segment.rows
                        .map((row) => row.map((cell) => toPlain(cell)).join('\t'))
                        .join('\n')
                }
                return segment.text
            })
            .join('')

    return toPlain(segments)
}

export const stringToSegments = (value: string, previous?: ContentSegment[]): ContentSegment[] => {
    const reusePool = [...(previous ?? [])]
    const reuse = (type: 'text' | 'math', content: string): ContentSegment => {
        const index = reusePool.findIndex((segment) => {
            if (segment.type !== type) return false
            return type === 'math'
                ? (segment as Extract<ContentSegment, { type: 'math' }>).latex === content
                : (segment as Extract<ContentSegment, { type: 'text' }>).text === content
        })

        if (index !== -1) {
            const [match] = reusePool.splice(index, 1)
            return type === 'math'
                ? { ...match, type: 'math', latex: content }
                : { ...match, type: 'text', text: content }
        }

        return type === 'math' ? createMathSegment(content) : createTextSegment(content)
    }

    if (!value) return [createTextSegment('')]

    const segments: ContentSegment[] = []
    const regex = /\$\$([^$]*)\$\$|\$([^$]*)\$/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(value)) !== null) {
        if (match.index > lastIndex) {
            const textPart = value.slice(lastIndex, match.index)
            if (textPart) segments.push(reuse('text', textPart))
        }

        const latex = match[1] ?? match[2] ?? ''
        segments.push(reuse('math', latex))
        lastIndex = regex.lastIndex
    }

    if (lastIndex < value.length) {
        const textPart = value.slice(lastIndex)
        if (textPart) segments.push(reuse('text', textPart))
    }

    return segments.length > 0 ? segments : [createTextSegment('')]
}
