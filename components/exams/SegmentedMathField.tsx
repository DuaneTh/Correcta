'use client'



import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Calculator, Check, X, Table, LineChart, Plus, ChevronDown } from 'lucide-react'
import { ContentSegment, GraphSegment, TableCell } from '@/types/exams'
import { renderGraphInto } from './graph-utils'
import MathToolbar from './MathToolbar'
import { renderLatexToString } from './KaTeXRenderer'


// ------------------------------------------------------------------

// Utility Functions

// ------------------------------------------------------------------

type TablePayload = {
    rows: TableCell[][]
    colWidths?: number[]
    rowHeights?: number[]
}

type GraphPayload = Omit<GraphSegment, 'id' | 'type'>

const createId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {

        return crypto.randomUUID()

    }

    return `seg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

}

const normalizeNumber = (value: unknown, fallback: number): number => {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
}

const minTableColumnWidth = 60
const minTableRowHeight = 36
const maxExamSheetWidth = 820
const defaultGraphWidth = 480
const defaultGraphHeight = 280

const normalizeSegments = (segments: ContentSegment[]): ContentSegment[] => {
    if (!segments || segments.length === 0) {
        return [{ id: createId(), type: 'text', text: '' }]
    }
    return segments.map((s) =>
        s.type === 'math'
            ? { id: s.id || createId(), type: 'math', latex: s.latex || '' }
            : s.type === 'table' ? (() => {
                const payload = normalizeTablePayload(s)
                return {
                    id: s.id || createId(),
                    type: 'table',
                    rows: payload.rows,
                    colWidths: payload.colWidths,
                    rowHeights: payload.rowHeights,
                }
            })()
                : s.type === 'graph' ? (() => {
                    const payload = normalizeGraphPayload(s)
                    return {
                        id: s.id || createId(),
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
                })()
                : { id: s.id || createId(), type: 'text', text: s.text || '' }
    )
}


const consolidateSegments = (segments: ContentSegment[]): ContentSegment[] => {
    if (!segments || segments.length === 0) {

        return [{ id: createId(), type: 'text', text: '' }]

    }



    const result: ContentSegment[] = []



    for (const seg of segments) {
        // Skip empty text segments and whitespace-only text segments
        // Also remove zero-width spaces (\u200B) before checking
        if (seg.type === 'text') {
            const cleanedText = seg.text?.replace(/\u200B/g, '') || ''
            const hasVisibleText = cleanedText.trim().length > 0
            const hasLineBreak = cleanedText.includes('\n')
            if (!hasVisibleText && !hasLineBreak) continue
        }


        const last = result[result.length - 1]

        if (seg.type === 'text' && last?.type === 'text') {

            last.text += seg.text

        } else {

            result.push({ ...seg })

        }

    }



    if (result.length === 0) {

        return [{ id: createId(), type: 'text', text: '' }]

    }



    return result
}

const createEmptyCellSegments = (): ContentSegment[] => [{ id: createId(), type: 'text', text: '' }]

const normalizeTableRows = (rows?: TableCell[][]): TableCell[][] => {
    if (!rows || rows.length === 0) return [[createEmptyCellSegments()]]

    return rows.map((row) => {
        if (!row || row.length === 0) return [createEmptyCellSegments()]
        return row.map((cell) => (cell && cell.length > 0 ? cell : createEmptyCellSegments()))
    })
}

const capColWidthsToMax = (widths: number[], maxWidth: number) => {
    let total = widths.reduce((sum, width) => sum + width, 0)
    if (total <= maxWidth) return widths

    const scale = maxWidth / total
    let scaled = widths.map((width) => Math.max(24, Math.floor(width * scale)))
    total = scaled.reduce((sum, width) => sum + width, 0)

    while (total > maxWidth) {
        let maxIndex = -1
        let maxValue = 0
        for (let i = 0; i < scaled.length; i++) {
            if (scaled[i] > maxValue) {
                maxValue = scaled[i]
                maxIndex = i
            }
        }
        if (maxIndex === -1 || maxValue <= 24) break
        scaled[maxIndex] -= 1
        total -= 1
    }

    return scaled
}

const normalizeTablePayload = (input?: Partial<TablePayload> | TableCell[][]): TablePayload => {
    if (Array.isArray(input)) {
        return { rows: normalizeTableRows(input) }
    }

    const rows = normalizeTableRows(input?.rows)
    const cols = rows[0]?.length ?? 1
    const colWidths = Array.isArray(input?.colWidths) && input.colWidths.length === cols
        ? capColWidthsToMax(
            input.colWidths.map((value) => Math.max(24, Number(value) || 0)),
            maxExamSheetWidth
        )
        : undefined
    const rowHeights = Array.isArray(input?.rowHeights) && input.rowHeights.length === rows.length
        ? input.rowHeights.map((value) => Math.max(minTableRowHeight, Number(value) || 0))
        : undefined

    return { rows, colWidths, rowHeights }
}

const parseTablePayload = (raw: string | null): TablePayload => {
    if (!raw) return normalizeTablePayload()
    try {
        const parsed = JSON.parse(raw)
        return normalizeTablePayload(parsed as Partial<TablePayload> | TableCell[][])
    } catch {
        return normalizeTablePayload()
    }
}

const createDefaultGraphPayload = (): GraphPayload => ({
    axes: {
        xMin: -5,
        xMax: 5,
        yMin: -5,
        yMax: 5,
        showGrid: true,
        gridStep: 1,
        xLabel: '',
        yLabel: '',
        xLabelIsMath: false,
        yLabelIsMath: false,
    },
    points: [],
    lines: [],
    curves: [],
    functions: [],
    areas: [],
    texts: [],
    width: defaultGraphWidth,
    height: defaultGraphHeight,
    background: 'white',
})

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

const normalizeGraphPayload = (input?: Partial<GraphPayload> | ContentSegment): GraphPayload => {
    const graph = (input as Partial<GraphPayload>) || {}
    const axesInput = graph.axes
    const axes = {
        xMin: normalizeNumber(axesInput?.xMin, -5),
        xMax: normalizeNumber(axesInput?.xMax, 5),
        yMin: normalizeNumber(axesInput?.yMin, -5),
        yMax: normalizeNumber(axesInput?.yMax, 5),
        xLabel: typeof axesInput?.xLabel === 'string' ? axesInput.xLabel : '',
        yLabel: typeof axesInput?.yLabel === 'string' ? axesInput.yLabel : '',
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

    return {
        axes,
        points: Array.isArray(graph.points)
            ? graph.points.map((point) => ({
                id: point?.id || createId(),
                x: normalizeNumber(point?.x, 0),
                y: normalizeNumber(point?.y, 0),
                label: typeof point?.label === 'string' ? point.label : '',
                labelIsMath: Boolean(point?.labelIsMath),
                color: typeof point?.color === 'string' ? point.color : undefined,
                size: normalizeNumber(point?.size, 4),
                filled: point?.filled !== false,
            }))
            : [],
        lines: Array.isArray(graph.lines)
            ? graph.lines.map((line) => ({
                id: line?.id || createId(),
                start: normalizeGraphAnchor(line?.start),
                end: normalizeGraphAnchor(line?.end),
                kind: line?.kind === 'line' || line?.kind === 'ray' ? line.kind : 'segment',
                style: line?.style,
            }))
            : [],
        curves: Array.isArray(graph.curves)
            ? graph.curves.map((curve) => ({
                id: curve?.id || createId(),
                start: normalizeGraphAnchor(curve?.start),
                end: normalizeGraphAnchor(curve?.end),
                curvature: normalizeNumber(curve?.curvature, 0),
                style: curve?.style,
            }))
            : [],
        functions: Array.isArray(graph.functions)
            ? graph.functions.map((fn) => ({
                id: fn?.id || createId(),
                expression: typeof fn?.expression === 'string' ? fn.expression : '',
                domain: fn?.domain,
                style: fn?.style,
            }))
            : [],
        areas: Array.isArray(graph.areas)
            ? graph.areas.map((area) => ({
                id: area?.id || createId(),
                mode: area?.mode === 'under-function' || area?.mode === 'between-functions'
                    ? area.mode
                    : 'polygon',
                points: Array.isArray(area?.points) ? area.points.map((point) => normalizeGraphAnchor(point)) : undefined,
                functionId: typeof area?.functionId === 'string' ? area.functionId : undefined,
                functionId2: typeof area?.functionId2 === 'string' ? area.functionId2 : undefined,
                domain: area?.domain,
                fill: area?.fill,
            }))
            : [],
        texts: Array.isArray(graph.texts)
            ? graph.texts.map((text) => ({
                id: text?.id || createId(),
                x: normalizeNumber(text?.x, 0),
                y: normalizeNumber(text?.y, 0),
                text: typeof text?.text === 'string' ? text.text : '',
                isMath: Boolean(text?.isMath),
            }))
            : [],
        width: normalizeNumber(graph.width, defaultGraphWidth),
        height: normalizeNumber(graph.height, defaultGraphHeight),
        background: typeof graph.background === 'string' ? graph.background : 'white',
    }
}

const parseGraphPayload = (raw: string | null): GraphPayload => {
    if (!raw) return createDefaultGraphPayload()
    try {
        const parsed = JSON.parse(raw)
        return normalizeGraphPayload(parsed as Partial<GraphPayload>)
    } catch {
        return createDefaultGraphPayload()
    }
}

const isSegmentElement = (el: HTMLElement | null) =>
    !!el && (el.hasAttribute('data-math-id') || el.hasAttribute('data-table-id') || el.hasAttribute('data-graph-id'))

const getSegmentId = (el: HTMLElement | null) =>
    el?.getAttribute('data-math-id') ?? el?.getAttribute('data-table-id') ?? el?.getAttribute('data-graph-id') ?? null

const isSegmentsEmpty = (segments: ContentSegment[]): boolean => {
    if (segments.length === 0) return true
    return segments.every(
        (seg) => seg.type === 'text' && !seg.text?.replace(/\u200B/g, '').trim()
    )
}

// ------------------------------------------------------------------

// InlineMath: Renders LaTeX via KaTeX (synchronous, no loading needed)

// ------------------------------------------------------------------



function InlineMath({ latex }: { latex: string; id: string }) {
    // Render LaTeX using KaTeX - synchronous, no loading states needed
    const html = latex ? renderLatexToString(latex, false) : ''

    return (
        <span
            className="text-indigo-900 math-chip-content"
            style={{
                maxWidth: '100%',
                wordBreak: 'break-all',
                overflowWrap: 'anywhere',
            }}
            dangerouslySetInnerHTML={{ __html: html || '\u25A1' }}
        />
    )
}



// ------------------------------------------------------------------

// InlineMathEditor: Popup for editing a math chip's LaTeX (live draft)

// ------------------------------------------------------------------



interface InlineMathEditorProps {
    value: string
    onChangeDraft: (newLatex: string) => void
    onConfirm: () => void
    onCancel: () => void
    onDelete: () => void
    anchorRef: React.RefObject<HTMLSpanElement | null>
    locale?: string
    /** Callback to expose the math field element to parent for toolbar insertion */
    onMathFieldReady?: (mf: MathfieldElement | null) => void
}


// MathLive types for the math-field custom element

interface MathfieldElement extends HTMLElement {

    value: string

    getValue(format?: string): string

    setValue(latex: string, options?: { suppressChangeNotifications?: boolean }): void

    insert(latex: string, options?: { focus?: boolean; feedback?: boolean; mode?: string; format?: string; insertionMode?: string; selectionMode?: string }): boolean

    focus(): void

    executeCommand(command: string | string[]): boolean

}



function InlineMathEditor({ value, onChangeDraft, onConfirm, onCancel, onDelete, anchorRef, locale = 'fr', onMathFieldReady }: InlineMathEditorProps) {
    const mathFieldRef = useRef<MathfieldElement | null>(null)

    const editorRef = useRef<HTMLDivElement>(null)

    const containerRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState({ top: 0, left: 0 })
    const [mathLiveLoaded, setMathLiveLoaded] = useState(false)
    const initialValueRef = useRef(value)
    const isFrench = locale === 'fr'

    // Store callbacks in refs to avoid useEffect dependency changes causing re-renders
    const onChangeDraftRef = useRef(onChangeDraft)
    const onConfirmRef = useRef(onConfirm)
    const onCancelRef = useRef(onCancel)
    const onMathFieldReadyRef = useRef(onMathFieldReady)
    onChangeDraftRef.current = onChangeDraft
    onConfirmRef.current = onConfirm
    onCancelRef.current = onCancel
    onMathFieldReadyRef.current = onMathFieldReady


    // Dynamically load MathLive CSS and JS

    useEffect(() => {

        if (typeof window === 'undefined') return



        // Load MathLive module and configure fonts

        import('mathlive').then((module) => {

            // Configure fonts to load from CDN to avoid bundler issues

            if (module.MathfieldElement) {

                module.MathfieldElement.fontsDirectory = 'https://unpkg.com/mathlive/fonts/'

                setMathLiveLoaded(true)

            }

        }).catch(console.error)

    }, [])



    // Position the popup

    useLayoutEffect(() => {
        if (!anchorRef.current || !editorRef.current) return

        const updatePosition = () => {
            const anchorRect = anchorRef.current?.getBoundingClientRect()
            const editorRect = editorRef.current?.getBoundingClientRect()
            if (!anchorRect || !editorRect) return

            const editorWidth = editorRect.width || 320
            const editorHeight = editorRect.height || 250
            const margin = 8

            let left = anchorRect.left
            let top = anchorRect.bottom + 4

            if (left + editorWidth > window.innerWidth - margin) {
                left = window.innerWidth - editorWidth - margin
            }
            if (left < margin) left = margin

            if (top + editorHeight > window.innerHeight - margin) {
                top = Math.max(margin, anchorRect.top - editorHeight - 4)
            }
            if (top < margin) top = margin

            setPosition({ top, left })
        }

        updatePosition()

        const handleScroll = () => updatePosition()
        const handleResize = () => updatePosition()

        window.addEventListener('scroll', handleScroll, true)
        window.addEventListener('resize', handleResize)

        let resizeObserver: ResizeObserver | null = null
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => updatePosition())
            resizeObserver.observe(editorRef.current)
        }

        return () => {
            window.removeEventListener('scroll', handleScroll, true)
            window.removeEventListener('resize', handleResize)
            resizeObserver?.disconnect()
        }
    }, [anchorRef])


    // Detect clicks outside to save

    useEffect(() => {

        let isListenerActive = false



        const handleClickOutside = (e: MouseEvent) => {

            if (!isListenerActive) return

            if (editorRef.current && !editorRef.current.contains(e.target as Node)) {

                // Click outside the popup - save changes

                onConfirmRef.current()

            }

        }



        // Add listener in capture phase to intercept before stopPropagation

        document.addEventListener('mousedown', handleClickOutside, true)



        // Activate after a small delay to avoid immediately closing on the click that opened the popup

        const timeoutId = setTimeout(() => {

            isListenerActive = true

        }, 150)



        return () => {

            clearTimeout(timeoutId)

            document.removeEventListener('mousedown', handleClickOutside, true)

        }

    }, [])



    // Create and configure the math-field once MathLive is loaded

    useEffect(() => {

        if (!mathLiveLoaded || !containerRef.current) return



        // Create the math-field element

        const mf = document.createElement('math-field') as MathfieldElement

        mf.value = initialValueRef.current

        

        // Style the math field

        mf.style.display = 'block'

        mf.style.width = '100%'

        mf.style.minHeight = '2.5rem'

        mf.style.padding = '0.5rem'

        mf.style.fontSize = '1.125rem'

        mf.style.border = '1px solid #d1d5db'

        mf.style.borderRadius = '0.375rem'

        mf.style.backgroundColor = 'white'

        mf.style.outline = 'none'

        

        // Add focus styles via event listeners

        mf.addEventListener('focus', () => {

            mf.style.borderColor = '#6366f1'

            mf.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.2)'

        })

        mf.addEventListener('blur', () => {

            mf.style.borderColor = '#d1d5db'

            mf.style.boxShadow = 'none'

        })



        // Handle input changes

        mf.addEventListener('input', () => {

            const latex = mf.getValue('latex')

            onChangeDraftRef.current(latex)

        })



        // Handle keyboard shortcuts and space key

        // Use capture phase to intercept before MathLive's own handlers

        const handleKeyDown = (e: KeyboardEvent) => {

            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {

                // Ctrl+Enter or Cmd+Enter: save

                e.preventDefault()

                e.stopImmediatePropagation()

                onConfirmRef.current()

            } else if (e.key === 'Enter') {

                // Simple Enter: line break in formula

                e.preventDefault()

                e.stopImmediatePropagation()

                // Insert a single LaTeX line break

                const lineBreak = String.raw`\\`

                mf.insert(lineBreak, { focus: true, feedback: false })

            } else if (e.key === 'Escape') {

                e.preventDefault()

                e.stopImmediatePropagation()

                onCancelRef.current()

            } else if (e.key === ' ') {
                // Insert a visible space in math mode (~ is non-breaking space in LaTeX)
                e.preventDefault()
                e.stopImmediatePropagation()
                mf.insert('~', { focus: true, feedback: false })
            } else if (e.key === '*') {
                // Replace * with a proper multiplication symbol
                e.preventDefault()
                e.stopImmediatePropagation()
                mf.insert('\\times', { focus: true, feedback: false })
            }
        }
        mf.addEventListener('keydown', handleKeyDown, { capture: true })



        // Append to container

        containerRef.current.appendChild(mf)

        mathFieldRef.current = mf

        // Notify parent that math field is ready for toolbar insertion
        onMathFieldReadyRef.current?.(mf)

        // Focus the field after a short delay

        setTimeout(() => {

            mf.focus()

            // Move cursor to end (lowercase 'f' in 'Mathfield')

            mf.executeCommand('moveToMathfieldEnd')

        }, 50)



        return () => {

            if (containerRef.current && mf.parentNode === containerRef.current) {

                containerRef.current.removeChild(mf)

            }

            mathFieldRef.current = null
            onMathFieldReadyRef.current?.(null)

        }

    }, [mathLiveLoaded])



    // Insert symbol into the math field

    const handleInsertSymbol = (symbol: string) => {

        const mf = mathFieldRef.current

        if (mf) {

            mf.insert(symbol, { focus: true, feedback: false })

        }

    }



    const quickSymbols = [
        { label: 'a/b', latex: '\\frac{#@}{#0}' },
        { label: 'âˆš', latex: '\\sqrt{#0}' },
        { label: 'x^', latex: '^{#0}' },
        { label: 'x_', latex: '_{#0}' },
        { label: 'âˆ‘', latex: '\\sum_{#@}^{#0}' },
        { label: 'âˆ«', latex: '\\int_{#@}^{#0}' },
        { label: 'âˆ', latex: '\\prod_{#@}^{#0}' },
        { label: 'lim', latex: '\\lim_{#0}' },
        { label: 'e^', latex: 'e^{#0}' },
        { label: 'ln', latex: '\\ln\\left(#0\\right)' },
        { label: 'log', latex: '\\log_{#@}\\left(#0\\right)' },
        { label: 'sin', latex: '\\sin\\left(#0\\right)' },
        { label: 'cos', latex: '\\cos\\left(#0\\right)' },
        { label: 'tan', latex: '\\tan\\left(#0\\right)' },
        { label: 'Ï€', latex: '\\pi' },
        { label: 'âˆž', latex: '\\infty' },
        { label: 'â‰¤', latex: '\\leq' },
        { label: 'â‰¥', latex: '\\geq' },
        { label: 'â‰ ', latex: '\\neq' },
        { label: 'Ã—', latex: '\\times' },
        { label: 'âˆ€', latex: '\\forall' },
        { label: 'âˆƒ', latex: '\\exists' },
        { label: 'âˆˆ', latex: '\\in' },
        { label: 'âˆ‰', latex: '\\notin' },
        { label: 'âŠ‚', latex: '\\subset' },
        { label: 'âŠ†', latex: '\\subseteq' },
        { label: 'âŠƒ', latex: '\\supset' },
        { label: 'âŠ‡', latex: '\\supseteq' },
        { label: 'âˆª', latex: '\\cup' },
        { label: 'âˆ©', latex: '\\cap' },
        { label: 'âˆ…', latex: '\\emptyset' },
        { label: 'â†’', latex: '\\to' },
        { label: 'â†¦', latex: '\\mapsto' },
        { label: 'â‡’', latex: '\\Rightarrow' },
        { label: 'â‡”', latex: '\\Leftrightarrow' },
        { label: 'â‰ˆ', latex: '\\approx' },
        { label: 'â‰¡', latex: '\\equiv' },
        { label: 'âˆ', latex: '\\propto' },
        { label: 'Â±', latex: '\\pm' },
        { label: 'âˆ‚', latex: '\\partial' },
        { label: 'âˆ‡', latex: '\\nabla' },
        { label: 'â„•', latex: '\\mathbb{N}' },
        { label: 'â„¤', latex: '\\mathbb{Z}' },
        { label: 'â„š', latex: '\\mathbb{Q}' },
        { label: 'â„', latex: '\\mathbb{R}' },
        { label: 'â„‚', latex: '\\mathbb{C}' },
        { label: 'Î±', latex: '\\alpha' },
        { label: 'Î²', latex: '\\beta' },
        { label: 'Î³', latex: '\\gamma' },
        { label: 'Î´', latex: '\\delta' },
        { label: 'Îµ', latex: '\\epsilon' },
        { label: 'Î¸', latex: '\\theta' },
        { label: 'Î»', latex: '\\lambda' },
        { label: 'Î¼', latex: '\\mu' },
        { label: 'Ï€', latex: '\\pi' },
        { label: 'Ï', latex: '\\rho' },
        { label: 'Ïƒ', latex: '\\sigma' },
        { label: 'Ï„', latex: '\\tau' },
        { label: 'Ï†', latex: '\\phi' },
        { label: 'Ï‰', latex: '\\omega' },
        { label: 'Î”', latex: '\\Delta' },
        { label: 'Î“', latex: '\\Gamma' },
        { label: 'Î£', latex: '\\Sigma' },
        { label: 'Î©', latex: '\\Omega' },
    ]

    return (

        <div

            ref={editorRef}

            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-80 inline-math-editor-popup"

            style={{ top: position.top, left: position.left }}

            onClick={(e) => e.stopPropagation()}

            onMouseDown={(e) => e.stopPropagation()}

        >

            {/* Header */}

            <div className="flex items-center justify-between mb-2">

                <span className="text-xs font-medium text-gray-600">{isFrench ? 'Modifier la formule' : 'Edit Formula'}</span>

                <div className="flex gap-1">

                    <button

                        type="button"

                        onClick={onConfirm}

                        className="p-1 text-green-600 hover:bg-green-50 rounded"

                        title={isFrench ? 'Enregistrer (Ctrl+Entr\u00e9e)' : 'Save (Ctrl+Enter)'}

                    >

                        <Check className="w-4 h-4" />

                    </button>

                    <button

                        type="button"

                        onClick={onCancel}

                        className="p-1 text-gray-400 hover:bg-gray-100 rounded"

                        title={isFrench ? 'Annuler (Echap)' : 'Cancel (Escape)'}

                    >

                        <X className="w-4 h-4" />

                    </button>

                </div>

            </div>



            {/* WYSIWYG Math Field - single editable rendered math input */}

            <div ref={containerRef} className="mb-2">

                {!mathLiveLoaded && (

                    <div className="w-full min-h-[2.5rem] p-2 border border-gray-300 rounded-md bg-gray-50 flex items-center justify-center">

                        <span className="text-sm text-gray-400">{isFrench ? 'Chargement de l\\u2019\\u00e9diteur de formules...' : 'Loading math editor...'}</span>

                    </div>

                )}

            </div>



            {/* Quick symbols */}

            <div className="flex flex-wrap gap-1">

                {quickSymbols.map((sym, index) => (
                    <button
                        key={`${sym.latex}-${sym.label}-${index}`}
                        type="button"
                        onClick={() => handleInsertSymbol(sym.latex)}
                        className="px-1.5 py-0.5 text-xs text-gray-900 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300"
                        style={{ fontFamily: 'Cambria Math, STIX Two Math, Latin Modern Math, serif' }}
                    >
                        {sym.label}

                    </button>

                ))}

            </div>



            {/* Hint + Delete */}

            <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">

                <span className="text-[10px] text-gray-400">{isFrench ? 'Entr\u00e9e = saut de ligne - Ctrl+Entr\u00e9e pour enregistrer' : 'Enter = line break - Ctrl+Enter to save'}</span>

                <button

                    type="button"

                    onClick={onDelete}

                    className="text-xs text-red-600 hover:text-red-700 hover:underline"

                >

                    Delete

                </button>

            </div>

        </div>

    )

}

// ------------------------------------------------------------------
// InlineTableEditor: Popup for editing a table segment
// ------------------------------------------------------------------

interface InlineTableEditorProps {
    value: TablePayload
    onChangeDraft: (payload: TablePayload) => void
    onConfirm: () => void
    onCancel: () => void
    onDelete: () => void
    anchorRef: React.RefObject<HTMLDivElement | null>
    initialFocusCell?: { row: number; col: number } | null
    locale?: string
}

function InlineTableEditor({ value, onChangeDraft, onConfirm, onCancel, onDelete, anchorRef, initialFocusCell, locale = 'fr' }: InlineTableEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState({ top: 0, left: 0 })
    const [pendingColumnDelete, setPendingColumnDelete] = useState<'left' | 'right' | null>(null)
    const [pendingRowDelete, setPendingRowDelete] = useState<'top' | 'bottom' | null>(null)
    const isFrench = locale === 'fr'

    const payload = normalizeTablePayload(value)
    const rows = payload.rows

    useLayoutEffect(() => {
        if (!anchorRef.current || !editorRef.current) return

        const updatePosition = () => {
            const anchorRect = anchorRef.current?.getBoundingClientRect()
            const editorRect = editorRef.current?.getBoundingClientRect()
            if (!anchorRect || !editorRect) return

            const editorWidth = editorRect.width || 420
            const editorHeight = editorRect.height || 320
            const margin = 8

            let left = anchorRect.left
            let top = anchorRect.bottom + 4

            if (left + editorWidth > window.innerWidth - margin) {
                left = window.innerWidth - editorWidth - margin
            }
            if (left < margin) left = margin

            if (top + editorHeight > window.innerHeight - margin) {
                top = Math.max(margin, anchorRect.top - editorHeight - 4)
            }
            if (top < margin) top = margin

            setPosition({ top, left })
        }

        updatePosition()

        const handleScroll = () => updatePosition()
        const handleResize = () => updatePosition()

        window.addEventListener('scroll', handleScroll, true)
        window.addEventListener('resize', handleResize)

        let resizeObserver: ResizeObserver | null = null
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => updatePosition())
            resizeObserver.observe(editorRef.current)
        }

        return () => {
            window.removeEventListener('scroll', handleScroll, true)
            window.removeEventListener('resize', handleResize)
            resizeObserver?.disconnect()
        }
    }, [anchorRef])

    useEffect(() => {
        let isListenerActive = false

        const handleClickOutside = (e: MouseEvent) => {
            if (!isListenerActive) return
            if (editorRef.current && !editorRef.current.contains(e.target as Node)) {
                onConfirm()
            }
        }

        document.addEventListener('mousedown', handleClickOutside, true)

        const timeoutId = setTimeout(() => {
            isListenerActive = true
        }, 150)

        return () => {
            clearTimeout(timeoutId)
            document.removeEventListener('mousedown', handleClickOutside, true)
        }
    }, [onConfirm])

    useEffect(() => {
        if (!initialFocusCell || !editorRef.current) return
        const { row, col } = initialFocusCell
        const focusCell = () => {
            const cell = editorRef.current?.querySelector(
                `[data-editor-cell-row="${row}"][data-editor-cell-col="${col}"]`
            ) as HTMLElement | null
            if (!cell) return
            cell.scrollIntoView({ block: 'nearest', inline: 'nearest' })
            const editable = cell.querySelector('[contenteditable="true"]') as HTMLElement | null
            editable?.focus()
        }
        requestAnimationFrame(focusCell)
    }, [initialFocusCell, rows.length, rows[0]?.length])

    const updateCell = (rowIndex: number, colIndex: number, segments: ContentSegment[]) => {
        setPendingColumnDelete(null)
        setPendingRowDelete(null)
        const nextRows = rows.map((row, r) =>
            row.map((cell, c) => (r === rowIndex && c === colIndex ? segments : cell))
        )
        onChangeDraft({ ...payload, rows: nextRows })
    }

    const addRow = (position: 'top' | 'bottom') => {
        setPendingColumnDelete(null)
        setPendingRowDelete(null)
        const cols = rows[0]?.length || 1
        const newRow = Array.from({ length: cols }, () => createEmptyCellSegments())
        const nextRows = position === 'top' ? [newRow, ...rows] : [...rows, newRow]
        const nextRowHeights = payload.rowHeights
            ? position === 'top'
                ? [minTableRowHeight, ...payload.rowHeights]
                : [...payload.rowHeights, minTableRowHeight]
            : undefined
        onChangeDraft({ ...payload, rows: nextRows, rowHeights: nextRowHeights })
    }

    const addColumn = (position: 'left' | 'right') => {
        setPendingColumnDelete(null)
        setPendingRowDelete(null)
        const currentCols = rows[0]?.length || 1
        const minNextTotal = (currentCols + 1) * minTableColumnWidth
        if (minNextTotal > maxExamSheetWidth) {
            return
        }

        const nextRows = rows.map((row) => {
            const cell = createEmptyCellSegments()
            return position === 'left' ? [cell, ...row] : [...row, cell]
        })
        const baseWidths = payload.colWidths
            ? [...payload.colWidths]
            : Array.from({ length: rows[0]?.length || 1 }, () => minTableColumnWidth)

        const nextWidths = position === 'left'
            ? [minTableColumnWidth, ...baseWidths]
            : [...baseWidths, minTableColumnWidth]
        const capped = capColWidthsToMax(nextWidths, maxExamSheetWidth)
        onChangeDraft({ ...payload, rows: nextRows, colWidths: capped })
    }

    const removeColumn = (position: 'left' | 'right') => {
        const cols = rows[0]?.length || 1
        if (cols <= 1) return

        if (pendingColumnDelete !== position) {
            setPendingColumnDelete(position)
            setPendingRowDelete(null)
            return
        }

        const nextRows = rows.map((row) =>
            position === 'left' ? row.slice(1) : row.slice(0, -1)
        )
        const nextColWidths = payload.colWidths
            ? position === 'left'
                ? payload.colWidths.slice(1)
                : payload.colWidths.slice(0, -1)
            : undefined

        setPendingColumnDelete(null)
        onChangeDraft({ ...payload, rows: nextRows, colWidths: nextColWidths })
    }

    const removeRow = (position: 'top' | 'bottom') => {
        const rowCount = rows.length
        if (rowCount <= 1) return

        if (pendingRowDelete !== position) {
            setPendingRowDelete(position)
            setPendingColumnDelete(null)
            return
        }

        const nextRows = position === 'top' ? rows.slice(1) : rows.slice(0, -1)
        const nextRowHeights = payload.rowHeights
            ? position === 'top'
                ? payload.rowHeights.slice(1)
                : payload.rowHeights.slice(0, -1)
            : undefined

        setPendingRowDelete(null)
        onChangeDraft({ ...payload, rows: nextRows, rowHeights: nextRowHeights })
    }

    return (
        <div
            ref={editorRef}
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-[32rem] inline-table-editor-popup"
            style={{ top: position.top, left: position.left }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-800">{isFrench ? 'Modifier le tableau' : 'Edit Table'}</span>
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="p-1 text-green-700 hover:bg-green-50 rounded"
                        title={isFrench ? 'Enregistrer' : 'Save'}
                    >
                        <Check className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                        title={isFrench ? 'Annuler' : 'Cancel'}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={() => addRow('top')}
                        className="px-2 py-1 text-xs text-gray-800 border border-gray-200 rounded hover:bg-gray-50"
                    >
                        {isFrench ? 'Ajouter une ligne au-dessus' : 'Add row above'}
                    </button>
                    <button
                        type="button"
                        onClick={() => removeRow('top')}
                        className={`ml-2 px-2 py-1 text-xs border rounded ${
                            pendingRowDelete === 'top'
                                ? 'text-red-800 border-red-300 bg-red-50 hover:bg-red-100'
                                : 'text-red-700 border-red-200 hover:bg-red-50'
                        }`}
                    >
                        {pendingRowDelete === 'top'
                            ? (isFrench ? 'Confirmer suppression haut' : 'Confirm remove top')
                            : (isFrench ? 'Supprimer ligne au-dessus' : 'Remove row above')}
                    </button>
                </div>
                <div className="flex items-stretch gap-2">
                    <div className="flex flex-col justify-center">
                        <button
                            type="button"
                            onClick={() => addColumn('left')}
                            className="px-2 py-1 text-xs text-gray-800 border border-gray-200 rounded hover:bg-gray-50"
                        >
                            {isFrench ? 'Ajouter colonne \u00e0 gauche' : 'Add column left'}
                        </button>
                        <button
                            type="button"
                            onClick={() => removeColumn('left')}
                            className={`mt-1 px-2 py-1 text-xs border rounded ${
                                pendingColumnDelete === 'left'
                                    ? 'text-red-800 border-red-300 bg-red-50 hover:bg-red-100'
                                    : 'text-red-700 border-red-200 hover:bg-red-50'
                            }`}
                        >
                            {pendingColumnDelete === 'left'
                                ? (isFrench ? 'Confirmer suppression gauche' : 'Confirm remove left')
                                : (isFrench ? 'Supprimer colonne \u00e0 gauche' : 'Remove column left')}
                        </button>
                    </div>
                    <div className="overflow-auto border border-gray-200 rounded">
                        <table className="border-collapse">
                            <tbody>
                                {rows.map((row, rowIndex) => (
                                    <tr key={`row-${rowIndex}`}>
                                        {row.map((cell, colIndex) => (
                                            <td
                                                key={`cell-${rowIndex}-${colIndex}`}
                                                className="border border-gray-200 p-1 align-top min-w-[140px]"
                                                data-editor-cell-row={rowIndex}
                                                data-editor-cell-col={colIndex}
                                            >
                                                <SegmentedMathField
                                                    value={cell}
                                                    onChange={(segments) => updateCell(rowIndex, colIndex, segments)}
                                                    minRows={1}
                                                    className="text-xs"
                                                    showTableButton={false}
                                                    showHint={false}
                                                    compactToolbar
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex flex-col justify-center">
                        <button
                            type="button"
                            onClick={() => addColumn('right')}
                            className="px-2 py-1 text-xs text-gray-800 border border-gray-200 rounded hover:bg-gray-50"
                        >
                            {isFrench ? 'Ajouter colonne \u00e0 droite' : 'Add column right'}
                        </button>
                        <button
                            type="button"
                            onClick={() => removeColumn('right')}
                            className={`mt-1 px-2 py-1 text-xs border rounded ${
                                pendingColumnDelete === 'right'
                                    ? 'text-red-800 border-red-300 bg-red-50 hover:bg-red-100'
                                    : 'text-red-700 border-red-200 hover:bg-red-50'
                            }`}
                        >
                            {pendingColumnDelete === 'right'
                                ? (isFrench ? 'Confirmer suppression droite' : 'Confirm remove right')
                                : (isFrench ? 'Supprimer colonne \u00e0 droite' : 'Remove column right')}
                        </button>
                    </div>
                </div>
                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={() => addRow('bottom')}
                        className="px-2 py-1 text-xs text-gray-800 border border-gray-200 rounded hover:bg-gray-50"
                    >
                        {isFrench ? 'Ajouter une ligne en dessous' : 'Add row below'}
                    </button>
                    <button
                        type="button"
                        onClick={() => removeRow('bottom')}
                        className={`ml-2 px-2 py-1 text-xs border rounded ${
                            pendingRowDelete === 'bottom'
                                ? 'text-red-800 border-red-300 bg-red-50 hover:bg-red-100'
                                : 'text-red-700 border-red-200 hover:bg-red-50'
                        }`}
                    >
                        {pendingRowDelete === 'bottom'
                            ? (isFrench ? 'Confirmer suppression bas' : 'Confirm remove bottom')
                            : (isFrench ? 'Supprimer ligne en dessous' : 'Remove row below')}
                    </button>
                </div>
            </div>

            <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
                <span className="text-[10px] text-gray-600">{isFrench ? '\u00c9ditez les cellules avec texte ou formule' : 'Edit cells with text or math'}</span>
                <button
                    type="button"
                    onClick={onDelete}
                    className="text-xs text-red-700 hover:text-red-800 hover:underline"
                >
                    Delete
                </button>
            </div>
        </div>
    )
}



// ------------------------------------------------------------------
// InlineGraphEditor: Popup for editing a graph segment
// ------------------------------------------------------------------

interface InlineGraphEditorProps {
    value: GraphPayload
    onChangeDraft: (payload: GraphPayload) => void
    onConfirm: () => void
    onCancel: () => void
    onDelete: () => void
    anchorRef: React.RefObject<HTMLDivElement | null>
    locale?: string
}

function InlineGraphEditor({ value, onChangeDraft, onConfirm, onCancel, onDelete, anchorRef, locale = 'fr' }: InlineGraphEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null)
    const previewRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState({ top: 0, left: 0 })
    const [pendingDelete, setPendingDelete] = useState<{ type: string; id: string } | null>(null)
    const isFrench = locale === 'fr'
    const payload = normalizeGraphPayload(value)

    useLayoutEffect(() => {
        if (!anchorRef.current || !editorRef.current) return

        const updatePosition = () => {
            const anchorRect = anchorRef.current?.getBoundingClientRect()
            const editorRect = editorRef.current?.getBoundingClientRect()
            if (!anchorRect || !editorRect) return

            const editorWidth = editorRect.width || 700
            const editorHeight = editorRect.height || 420
            const margin = 8

            let left = anchorRect.left
            let top = anchorRect.bottom + 4

            if (left + editorWidth > window.innerWidth - margin) {
                left = window.innerWidth - editorWidth - margin
            }
            if (left < margin) left = margin

            if (top + editorHeight > window.innerHeight - margin) {
                top = Math.max(margin, anchorRect.top - editorHeight - 4)
            }
            if (top < margin) top = margin

            setPosition({ top, left })
        }

        updatePosition()

        const handleScroll = () => updatePosition()
        const handleResize = () => updatePosition()

        window.addEventListener('scroll', handleScroll, true)
        window.addEventListener('resize', handleResize)

        let resizeObserver: ResizeObserver | null = null
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => updatePosition())
            resizeObserver.observe(editorRef.current)
        }

        return () => {
            window.removeEventListener('scroll', handleScroll, true)
            window.removeEventListener('resize', handleResize)
            resizeObserver?.disconnect()
        }
    }, [anchorRef])

    useEffect(() => {
        let isListenerActive = false

        const handleClickOutside = (e: MouseEvent) => {
            if (!isListenerActive) return
            if (editorRef.current && !editorRef.current.contains(e.target as Node)) {
                onConfirm()
            }
        }

        document.addEventListener('mousedown', handleClickOutside, true)

        const timeoutId = setTimeout(() => {
            isListenerActive = true
        }, 150)

        return () => {
            clearTimeout(timeoutId)
            document.removeEventListener('mousedown', handleClickOutside, true)
        }
    }, [onConfirm])

    useEffect(() => {
        if (!previewRef.current) return
        renderGraphInto(previewRef.current, { id: 'preview', type: 'graph', ...payload }, { maxWidth: 300 })
        // KaTeX rendering is handled synchronously by renderGraphInto if needed
        // No additional typesetting required
    }, [payload])


    const updatePayload = (next: GraphPayload) => {
        setPendingDelete(null)
        onChangeDraft(next)
    }

    const updateAxes = (key: keyof GraphPayload['axes'], value: string | number | boolean) => {
        updatePayload({
            ...payload,
            axes: {
                ...payload.axes,
                [key]: value,
            },
        })
    }

    const updatePoint = (id: string, patch: Partial<GraphPayload['points'][0]>) => {
        updatePayload({
            ...payload,
            points: payload.points.map((point) => (point.id === id ? { ...point, ...patch } : point)),
        })
    }

    const addPoint = () => {
        updatePayload({
            ...payload,
            points: [
                ...payload.points,
                { id: createId(), x: 0, y: 0, label: '', labelIsMath: false, size: 4, filled: true },
            ],
        })
    }

    const removePoint = (id: string) => {
        updatePayload({
            ...payload,
            points: payload.points.filter((point) => point.id !== id),
            lines: payload.lines.filter((line) => line.start.type !== 'point' || line.start.pointId !== id)
                .filter((line) => line.end.type !== 'point' || line.end.pointId !== id),
            curves: payload.curves.filter((curve) => curve.start.type !== 'point' || curve.start.pointId !== id)
                .filter((curve) => curve.end.type !== 'point' || curve.end.pointId !== id),
        })
    }

    const updateLine = (id: string, patch: Partial<GraphPayload['lines'][0]>) => {
        updatePayload({
            ...payload,
            lines: payload.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
        })
    }

    const addLine = () => {
        updatePayload({
            ...payload,
            lines: [
                ...payload.lines,
                {
                    id: createId(),
                    kind: 'segment',
                    start: { type: 'coord', x: -2, y: 0 },
                    end: { type: 'coord', x: 2, y: 0 },
                    style: { color: '#111827', width: 1.5 },
                },
            ],
        })
    }

    const removeLine = (id: string) => {
        updatePayload({ ...payload, lines: payload.lines.filter((line) => line.id !== id) })
    }

    const updateCurve = (id: string, patch: Partial<GraphPayload['curves'][0]>) => {
        updatePayload({
            ...payload,
            curves: payload.curves.map((curve) => (curve.id === id ? { ...curve, ...patch } : curve)),
        })
    }

    const addCurve = () => {
        updatePayload({
            ...payload,
            curves: [
                ...payload.curves,
                {
                    id: createId(),
                    start: { type: 'coord', x: -2, y: -1 },
                    end: { type: 'coord', x: 2, y: 1 },
                    curvature: 1,
                    style: { color: '#2563eb', width: 1.5 },
                },
            ],
        })
    }

    const removeCurve = (id: string) => {
        updatePayload({ ...payload, curves: payload.curves.filter((curve) => curve.id !== id) })
    }

    const updateFunction = (id: string, patch: Partial<GraphPayload['functions'][0]>) => {
        updatePayload({
            ...payload,
            functions: payload.functions.map((fn) => (fn.id === id ? { ...fn, ...patch } : fn)),
        })
    }

    const addFunction = () => {
        updatePayload({
            ...payload,
            functions: [
                ...payload.functions,
                {
                    id: createId(),
                    expression: 'sin(x)',
                    domain: { min: payload.axes.xMin, max: payload.axes.xMax },
                    style: { color: '#7c3aed', width: 1.5 },
                },
            ],
        })
    }

    const removeFunction = (id: string) => {
        updatePayload({
            ...payload,
            functions: payload.functions.filter((fn) => fn.id !== id),
            areas: payload.areas.filter((area) => area.functionId !== id && area.functionId2 !== id),
        })
    }

    const updateArea = (id: string, patch: Partial<GraphPayload['areas'][0]>) => {
        updatePayload({
            ...payload,
            areas: payload.areas.map((area) => (area.id === id ? { ...area, ...patch } : area)),
        })
    }

    const addArea = () => {
        updatePayload({
            ...payload,
            areas: [
                ...payload.areas,
                {
                    id: createId(),
                    mode: 'polygon',
                    points: [
                        { type: 'coord', x: -2, y: 0 },
                        { type: 'coord', x: 0, y: 2 },
                        { type: 'coord', x: 2, y: 0 },
                    ],
                    fill: { color: '#6366f1', opacity: 0.2 },
                },
            ],
        })
    }

    const removeArea = (id: string) => {
        updatePayload({ ...payload, areas: payload.areas.filter((area) => area.id !== id) })
    }

    const updateText = (id: string, patch: Partial<GraphPayload['texts'][0]>) => {
        updatePayload({
            ...payload,
            texts: payload.texts.map((text) => (text.id === id ? { ...text, ...patch } : text)),
        })
    }

    const addText = () => {
        updatePayload({
            ...payload,
            texts: [
                ...payload.texts,
                { id: createId(), x: 0, y: 0, text: isFrench ? 'Texte' : 'Text', isMath: false },
            ],
        })
    }

    const removeText = (id: string) => {
        updatePayload({ ...payload, texts: payload.texts.filter((text) => text.id !== id) })
    }


    const renderAnchorEditor = (
        anchor: GraphPayload['lines'][0]['start'],
        onUpdate: (next: GraphPayload['lines'][0]['start']) => void
    ) => {
        const pointOptions = payload.points
        const handleTypeChange = (value: string) => {
            if (value === 'point') {
                onUpdate({ type: 'point', pointId: pointOptions[0]?.id || '' })
            } else {
                onUpdate({ type: 'coord', x: 0, y: 0 })
            }
        }

        return (
            <div className="flex items-center gap-1">
                <select
                    value={anchor.type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="border border-gray-200 rounded px-1 py-0.5 text-[11px]"
                >
                    <option value="coord">{isFrench ? 'Coord' : 'Coord'}</option>
                    <option value="point">{isFrench ? 'Point' : 'Point'}</option>
                </select>
                {anchor.type === 'point' ? (
                    <select
                        value={anchor.pointId}
                        onChange={(e) => onUpdate({ type: 'point', pointId: e.target.value })}
                        className="border border-gray-200 rounded px-1 py-0.5 text-[11px]"
                    >
                        {pointOptions.length === 0 && (
                            <option value="">{isFrench ? 'Aucun' : 'None'}</option>
                        )}
                        {pointOptions.map((point) => (
                            <option key={point.id} value={point.id}>
                                {point.label || point.id.slice(0, 4)}
                            </option>
                        ))}
                    </select>
                ) : (
                    <>
                        <input
                            type="number"
                            value={anchor.x}
                            onChange={(e) => onUpdate({ type: 'coord', x: Number(e.target.value), y: anchor.y })}
                            className="border border-gray-200 rounded px-1 py-0.5 text-[11px] w-16"
                        />
                        <input
                            type="number"
                            value={anchor.y}
                            onChange={(e) => onUpdate({ type: 'coord', x: anchor.x, y: Number(e.target.value) })}
                            className="border border-gray-200 rounded px-1 py-0.5 text-[11px] w-16"
                        />
                    </>
                )}
            </div>
        )
    }

    const handleDeleteClick = (type: string, id: string, onConfirmDelete: () => void) => {
        if (pendingDelete?.id === id && pendingDelete.type === type) {
            onConfirmDelete()
            setPendingDelete(null)
            return
        }
        setPendingDelete({ type, id })
    }

    const inputLabelClass = 'text-[11px] text-gray-500'
    const inputClass = 'border border-gray-200 rounded px-1 py-0.5 text-xs'

    return (
        <div
            ref={editorRef}
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-[44rem] inline-graph-editor-popup"
            style={{ top: position.top, left: position.left }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-800">{isFrench ? 'Modifier le graphique' : 'Edit Graph'}</span>
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="p-1 text-green-700 hover:bg-green-50 rounded"
                        title={isFrench ? 'Enregistrer' : 'Save'}
                    >
                        <Check className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                        title={isFrench ? 'Annuler' : 'Cancel'}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex gap-3">
                <div className="flex-1 space-y-3 max-h-[70vh] overflow-auto pr-2">
                    <div className="border border-gray-200 rounded p-2 space-y-2">
                        <div className="text-xs font-medium text-gray-700">{isFrench ? 'Axes' : 'Axes'}</div>
                        <div className="grid grid-cols-4 gap-2">
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>x min</span>
                                <input
                                    type="number"
                                    value={payload.axes.xMin}
                                    onChange={(e) => updateAxes('xMin', Number(e.target.value))}
                                    className={inputClass}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>x max</span>
                                <input
                                    type="number"
                                    value={payload.axes.xMax}
                                    onChange={(e) => updateAxes('xMax', Number(e.target.value))}
                                    className={inputClass}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>y min</span>
                                <input
                                    type="number"
                                    value={payload.axes.yMin}
                                    onChange={(e) => updateAxes('yMin', Number(e.target.value))}
                                    className={inputClass}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>y max</span>
                                <input
                                    type="number"
                                    value={payload.axes.yMax}
                                    onChange={(e) => updateAxes('yMax', Number(e.target.value))}
                                    className={inputClass}
                                />
                            </label>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>{isFrench ? 'Label x' : 'x label'}</span>
                                <input
                                    type="text"
                                    value={payload.axes.xLabel}
                                    onChange={(e) => updateAxes('xLabel', e.target.value)}
                                    className={inputClass}
                                />
                            </label>
                            <label className="flex items-center gap-2 text-xs text-gray-600">
                                <input
                                    type="checkbox"
                                    checked={payload.axes.xLabelIsMath}
                                    onChange={(e) => updateAxes('xLabelIsMath', e.target.checked)}
                                />
                                {isFrench ? 'Formule' : 'Math'}
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>{isFrench ? 'Label y' : 'y label'}</span>
                                <input
                                    type="text"
                                    value={payload.axes.yLabel}
                                    onChange={(e) => updateAxes('yLabel', e.target.value)}
                                    className={inputClass}
                                />
                            </label>
                            <label className="flex items-center gap-2 text-xs text-gray-600">
                                <input
                                    type="checkbox"
                                    checked={payload.axes.yLabelIsMath}
                                    onChange={(e) => updateAxes('yLabelIsMath', e.target.checked)}
                                />
                                {isFrench ? 'Formule' : 'Math'}
                            </label>
                            <label className="flex items-center gap-2 text-xs text-gray-600">
                                <input
                                    type="checkbox"
                                    checked={payload.axes.showGrid}
                                    onChange={(e) => updateAxes('showGrid', e.target.checked)}
                                />
                                {isFrench ? 'Grille' : 'Grid'}
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>{isFrench ? 'Pas' : 'Step'}</span>
                                <input
                                    type="number"
                                    value={payload.axes.gridStep}
                                    onChange={(e) => updateAxes('gridStep', Number(e.target.value))}
                                    className={inputClass}
                                />
                            </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>{isFrench ? 'Largeur' : 'Width'}</span>
                                <input
                                    type="number"
                                    value={payload.width}
                                    onChange={(e) => updatePayload({ ...payload, width: Number(e.target.value) })}
                                    className={inputClass}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className={inputLabelClass}>{isFrench ? 'Hauteur' : 'Height'}</span>
                                <input
                                    type="number"
                                    value={payload.height}
                                    onChange={(e) => updatePayload({ ...payload, height: Number(e.target.value) })}
                                    className={inputClass}
                                />
                            </label>
                        </div>
                    </div>


                    <div className="border border-gray-200 rounded p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700">{isFrench ? 'Points' : 'Points'}</span>
                            <button
                                type="button"
                                onClick={addPoint}
                                className="text-xs text-indigo-700 hover:text-indigo-800"
                            >
                                {isFrench ? '+ Ajouter un point' : '+ Add point'}
                            </button>
                        </div>
                        {payload.points.length === 0 && (
                            <div className="text-[11px] text-gray-500">{isFrench ? 'Aucun point' : 'No points yet'}</div>
                        )}
                        {payload.points.map((point) => (
                            <div key={point.id} className="flex flex-wrap items-center gap-2 text-xs">
                                <input
                                    type="text"
                                    value={point.label || ''}
                                    onChange={(e) => updatePoint(point.id, { label: e.target.value })}
                                    placeholder={isFrench ? 'Nom' : 'Label'}
                                    className="border border-gray-200 rounded px-1 py-0.5 text-xs w-24"
                                />
                                <label className="flex items-center gap-1 text-[11px] text-gray-600">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(point.labelIsMath)}
                                        onChange={(e) => updatePoint(point.id, { labelIsMath: e.target.checked })}
                                    />
                                    {isFrench ? 'Formule' : 'Math'}
                                </label>
                                <input
                                    type="number"
                                    value={point.x}
                                    onChange={(e) => updatePoint(point.id, { x: Number(e.target.value) })}
                                    className="border border-gray-200 rounded px-1 py-0.5 text-xs w-16"
                                />
                                <input
                                    type="number"
                                    value={point.y}
                                    onChange={(e) => updatePoint(point.id, { y: Number(e.target.value) })}
                                    className="border border-gray-200 rounded px-1 py-0.5 text-xs w-16"
                                />
                                <input
                                    type="color"
                                    value={point.color || '#111827'}
                                    onChange={(e) => updatePoint(point.id, { color: e.target.value })}
                                />
                                <input
                                    type="number"
                                    value={point.size ?? 4}
                                    onChange={(e) => updatePoint(point.id, { size: Number(e.target.value) })}
                                    className="border border-gray-200 rounded px-1 py-0.5 text-xs w-14"
                                />
                                <label className="flex items-center gap-1 text-[11px] text-gray-600">
                                    <input
                                        type="checkbox"
                                        checked={point.filled !== false}
                                        onChange={(e) => updatePoint(point.id, { filled: e.target.checked })}
                                    />
                                    {isFrench ? 'Plein' : 'Filled'}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteClick('point', point.id, () => removePoint(point.id))}
                                    className={`text-[11px] ${
                                        pendingDelete?.id === point.id && pendingDelete.type === 'point'
                                            ? 'text-red-800'
                                            : 'text-red-600'
                                    }`}
                                >
                                    {pendingDelete?.id === point.id && pendingDelete.type === 'point'
                                        ? (isFrench ? 'Confirmer' : 'Confirm')
                                        : (isFrench ? 'Supprimer' : 'Delete')}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="border border-gray-200 rounded p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700">{isFrench ? 'Lignes' : 'Lines'}</span>
                            <button
                                type="button"
                                onClick={addLine}
                                className="text-xs text-indigo-700 hover:text-indigo-800"
                            >
                                {isFrench ? '+ Ajouter une ligne' : '+ Add line'}
                            </button>
                        </div>
                        {payload.lines.length === 0 && (
                            <div className="text-[11px] text-gray-500">{isFrench ? 'Aucune ligne' : 'No lines yet'}</div>
                        )}
                        {payload.lines.map((line) => (
                            <div key={line.id} className="border border-gray-100 rounded p-2 space-y-2 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                    <select
                                        value={line.kind}
                                        onChange={(e) => updateLine(line.id, { kind: e.target.value as GraphPayload['lines'][0]['kind'] })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                                    >
                                        <option value="segment">{isFrench ? 'Segment' : 'Segment'}</option>
                                        <option value="line">{isFrench ? 'Droite' : 'Line'}</option>
                                        <option value="ray">{isFrench ? 'Demi-droite' : 'Ray'}</option>
                                    </select>
                                    <label className="text-[11px] text-gray-500">{isFrench ? 'D\u00e9but' : 'Start'}</label>
                                    {renderAnchorEditor(line.start, (next) => updateLine(line.id, { start: next }))}
                                    <label className="text-[11px] text-gray-500">{isFrench ? 'Fin' : 'End'}</label>
                                    {renderAnchorEditor(line.end, (next) => updateLine(line.id, { end: next }))}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <input
                                        type="color"
                                        value={line.style?.color || '#111827'}
                                        onChange={(e) => updateLine(line.id, { style: { ...line.style, color: e.target.value } })}
                                    />
                                    <input
                                        type="number"
                                        value={line.style?.width ?? 1.5}
                                        onChange={(e) => updateLine(line.id, { style: { ...line.style, width: Number(e.target.value) } })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-16"
                                    />
                                    <label className="flex items-center gap-1 text-[11px] text-gray-600">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(line.style?.dashed)}
                                            onChange={(e) => updateLine(line.id, { style: { ...line.style, dashed: e.target.checked } })}
                                        />
                                        {isFrench ? 'Pointill\u00e9' : 'Dashed'}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteClick('line', line.id, () => removeLine(line.id))}
                                        className={`text-[11px] ${
                                            pendingDelete?.id === line.id && pendingDelete.type === 'line'
                                                ? 'text-red-800'
                                                : 'text-red-600'
                                        }`}
                                    >
                                        {pendingDelete?.id === line.id && pendingDelete.type === 'line'
                                            ? (isFrench ? 'Confirmer' : 'Confirm')
                                            : (isFrench ? 'Supprimer' : 'Delete')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>


                    <div className="border border-gray-200 rounded p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700">{isFrench ? 'Courbes' : 'Curves'}</span>
                            <button
                                type="button"
                                onClick={addCurve}
                                className="text-xs text-indigo-700 hover:text-indigo-800"
                            >
                                {isFrench ? '+ Ajouter une courbe' : '+ Add curve'}
                            </button>
                        </div>
                        {payload.curves.length === 0 && (
                            <div className="text-[11px] text-gray-500">{isFrench ? 'Aucune courbe' : 'No curves yet'}</div>
                        )}
                        {payload.curves.map((curve) => (
                            <div key={curve.id} className="border border-gray-100 rounded p-2 space-y-2 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                    <label className="text-[11px] text-gray-500">{isFrench ? 'D\u00e9but' : 'Start'}</label>
                                    {renderAnchorEditor(curve.start, (next) => updateCurve(curve.id, { start: next }))}
                                    <label className="text-[11px] text-gray-500">{isFrench ? 'Fin' : 'End'}</label>
                                    {renderAnchorEditor(curve.end, (next) => updateCurve(curve.id, { end: next }))}
                                    <label className="text-[11px] text-gray-500">{isFrench ? 'Courbure' : 'Curvature'}</label>
                                    <input
                                        type="number"
                                        value={curve.curvature ?? 0}
                                        onChange={(e) => updateCurve(curve.id, { curvature: Number(e.target.value) })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                                    />
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <input
                                        type="color"
                                        value={curve.style?.color || '#2563eb'}
                                        onChange={(e) => updateCurve(curve.id, { style: { ...curve.style, color: e.target.value } })}
                                    />
                                    <input
                                        type="number"
                                        value={curve.style?.width ?? 1.5}
                                        onChange={(e) => updateCurve(curve.id, { style: { ...curve.style, width: Number(e.target.value) } })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-16"
                                    />
                                    <label className="flex items-center gap-1 text-[11px] text-gray-600">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(curve.style?.dashed)}
                                            onChange={(e) => updateCurve(curve.id, { style: { ...curve.style, dashed: e.target.checked } })}
                                        />
                                        {isFrench ? 'Pointill\u00e9' : 'Dashed'}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteClick('curve', curve.id, () => removeCurve(curve.id))}
                                        className={`text-[11px] ${
                                            pendingDelete?.id === curve.id && pendingDelete.type === 'curve'
                                                ? 'text-red-800'
                                                : 'text-red-600'
                                        }`}
                                    >
                                        {pendingDelete?.id === curve.id && pendingDelete.type === 'curve'
                                            ? (isFrench ? 'Confirmer' : 'Confirm')
                                            : (isFrench ? 'Supprimer' : 'Delete')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="border border-gray-200 rounded p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700">{isFrench ? 'Fonctions' : 'Functions'}</span>
                            <button
                                type="button"
                                onClick={addFunction}
                                className="text-xs text-indigo-700 hover:text-indigo-800"
                            >
                                {isFrench ? '+ Ajouter une fonction' : '+ Add function'}
                            </button>
                        </div>
                        {payload.functions.length === 0 && (
                            <div className="text-[11px] text-gray-500">{isFrench ? 'Aucune fonction' : 'No functions yet'}</div>
                        )}
                        {payload.functions.map((fn) => (
                            <div key={fn.id} className="border border-gray-100 rounded p-2 space-y-2 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                    <input
                                        type="text"
                                        value={fn.expression}
                                        onChange={(e) => updateFunction(fn.id, { expression: e.target.value })}
                                        placeholder={isFrench ? 'Ex: sin(x)' : 'Ex: sin(x)'}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs flex-1"
                                    />
                                    <input
                                        type="color"
                                        value={fn.style?.color || '#7c3aed'}
                                        onChange={(e) => updateFunction(fn.id, { style: { ...fn.style, color: e.target.value } })}
                                    />
                                    <input
                                        type="number"
                                        value={fn.style?.width ?? 1.5}
                                        onChange={(e) => updateFunction(fn.id, { style: { ...fn.style, width: Number(e.target.value) } })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-16"
                                    />
                                    <label className="flex items-center gap-1 text-[11px] text-gray-600">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(fn.style?.dashed)}
                                            onChange={(e) => updateFunction(fn.id, { style: { ...fn.style, dashed: e.target.checked } })}
                                        />
                                        {isFrench ? 'Pointill\u00e9' : 'Dashed'}
                                    </label>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <label className="text-[11px] text-gray-500">{isFrench ? 'Domaine' : 'Domain'}</label>
                                    <input
                                        type="number"
                                        value={fn.domain?.min ?? payload.axes.xMin}
                                        onChange={(e) => updateFunction(fn.id, { domain: { ...fn.domain, min: Number(e.target.value) } })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                                    />
                                    <input
                                        type="number"
                                        value={fn.domain?.max ?? payload.axes.xMax}
                                        onChange={(e) => updateFunction(fn.id, { domain: { ...fn.domain, max: Number(e.target.value) } })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteClick('function', fn.id, () => removeFunction(fn.id))}
                                        className={`text-[11px] ${
                                            pendingDelete?.id === fn.id && pendingDelete.type === 'function'
                                                ? 'text-red-800'
                                                : 'text-red-600'
                                        }`}
                                    >
                                        {pendingDelete?.id === fn.id && pendingDelete.type === 'function'
                                            ? (isFrench ? 'Confirmer' : 'Confirm')
                                            : (isFrench ? 'Supprimer' : 'Delete')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>


                    <div className="border border-gray-200 rounded p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700">{isFrench ? 'Surfaces' : 'Areas'}</span>
                            <button
                                type="button"
                                onClick={addArea}
                                className="text-xs text-indigo-700 hover:text-indigo-800"
                            >
                                {isFrench ? '+ Ajouter une surface' : '+ Add area'}
                            </button>
                        </div>
                        {payload.areas.length === 0 && (
                            <div className="text-[11px] text-gray-500">{isFrench ? 'Aucune surface' : 'No areas yet'}</div>
                        )}
                        {payload.areas.map((area) => (
                            <div key={area.id} className="border border-gray-100 rounded p-2 space-y-2 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                    <select
                                        value={area.mode}
                                        onChange={(e) => updateArea(area.id, { mode: e.target.value as GraphPayload['areas'][0]['mode'] })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                                    >
                                        <option value="polygon">{isFrench ? 'Polygone' : 'Polygon'}</option>
                                        <option value="under-function">{isFrench ? 'Sous fonction' : 'Under function'}</option>
                                        <option value="between-functions">{isFrench ? 'Entre fonctions' : 'Between functions'}</option>
                                    </select>
                                    <input
                                        type="color"
                                        value={area.fill?.color || '#6366f1'}
                                        onChange={(e) => updateArea(area.id, { fill: { ...area.fill, color: e.target.value } })}
                                    />
                                    <input
                                        type="number"
                                        value={area.fill?.opacity ?? 0.2}
                                        onChange={(e) => updateArea(area.id, { fill: { ...area.fill, opacity: Number(e.target.value) } })}
                                        className="border border-gray-200 rounded px-1 py-0.5 text-xs w-16"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteClick('area', area.id, () => removeArea(area.id))}
                                        className={`text-[11px] ${
                                            pendingDelete?.id === area.id && pendingDelete.type === 'area'
                                                ? 'text-red-800'
                                                : 'text-red-600'
                                        }`}
                                    >
                                        {pendingDelete?.id === area.id && pendingDelete.type === 'area'
                                            ? (isFrench ? 'Confirmer' : 'Confirm')
                                            : (isFrench ? 'Supprimer' : 'Delete')}
                                    </button>
                                </div>
                                {area.mode === 'polygon' && (
                                    <div className="space-y-2">
                                        {(area.points || []).map((point, index) => (
                                            <div key={`${area.id}-point-${index}`} className="flex items-center gap-2">
                                                <span className="text-[11px] text-gray-500">P{index + 1}</span>
                                                {renderAnchorEditor(point, (next) => {
                                                    const nextPoints = [...(area.points || [])]
                                                    nextPoints[index] = next
                                                    updateArea(area.id, { points: nextPoints })
                                                })}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const nextPoints = (area.points || []).filter((_, i) => i !== index)
                                                        updateArea(area.id, { points: nextPoints })
                                                    }}
                                                    className="text-[11px] text-red-600"
                                                >
                                                    {isFrench ? 'Retirer' : 'Remove'}
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => updateArea(area.id, { points: [...(area.points || []), { type: 'coord', x: 0, y: 0 }] })}
                                            className="text-[11px] text-indigo-700"
                                        >
                                            {isFrench ? '+ Ajouter un point' : '+ Add point'}
                                        </button>
                                    </div>
                                )}
                                {area.mode !== 'polygon' && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <select
                                            value={area.functionId || ''}
                                            onChange={(e) => updateArea(area.id, { functionId: e.target.value })}
                                            className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                                        >
                                            <option value="">{isFrench ? 'Fonction' : 'Function'}</option>
                                            {payload.functions.map((fn) => (
                                                <option key={fn.id} value={fn.id}>
                                                    {fn.expression || fn.id.slice(0, 4)}
                                                </option>
                                            ))}
                                        </select>
                                        {area.mode === 'between-functions' && (
                                            <select
                                                value={area.functionId2 || ''}
                                                onChange={(e) => updateArea(area.id, { functionId2: e.target.value })}
                                                className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                                            >
                                                <option value="">{isFrench ? 'Fonction 2' : 'Function 2'}</option>
                                                {payload.functions.map((fn) => (
                                                    <option key={fn.id} value={fn.id}>
                                                        {fn.expression || fn.id.slice(0, 4)}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                        <input
                                            type="number"
                                            value={area.domain?.min ?? payload.axes.xMin}
                                            onChange={(e) => updateArea(area.id, { domain: { ...area.domain, min: Number(e.target.value) } })}
                                            className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                                        />
                                        <input
                                            type="number"
                                            value={area.domain?.max ?? payload.axes.xMax}
                                            onChange={(e) => updateArea(area.id, { domain: { ...area.domain, max: Number(e.target.value) } })}
                                            className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>


                    <div className="border border-gray-200 rounded p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700">{isFrench ? 'Textes' : 'Texts'}</span>
                            <button
                                type="button"
                                onClick={addText}
                                className="text-xs text-indigo-700 hover:text-indigo-800"
                            >
                                {isFrench ? '+ Ajouter un texte' : '+ Add text'}
                            </button>
                        </div>
                        {payload.texts.length === 0 && (
                            <div className="text-[11px] text-gray-500">{isFrench ? 'Aucun texte' : 'No texts yet'}</div>
                        )}
                        {payload.texts.map((text) => (
                            <div key={text.id} className="flex flex-wrap items-center gap-2 text-xs">
                                <input
                                    type="text"
                                    value={text.text}
                                    onChange={(e) => updateText(text.id, { text: e.target.value })}
                                    className="border border-gray-200 rounded px-1 py-0.5 text-xs w-40"
                                />
                                <input
                                    type="number"
                                    value={text.x}
                                    onChange={(e) => updateText(text.id, { x: Number(e.target.value) })}
                                    className="border border-gray-200 rounded px-1 py-0.5 text-xs w-16"
                                />
                                <input
                                    type="number"
                                    value={text.y}
                                    onChange={(e) => updateText(text.id, { y: Number(e.target.value) })}
                                    className="border border-gray-200 rounded px-1 py-0.5 text-xs w-16"
                                />
                                <label className="flex items-center gap-1 text-[11px] text-gray-600">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(text.isMath)}
                                        onChange={(e) => updateText(text.id, { isMath: e.target.checked })}
                                    />
                                    {isFrench ? 'Formule' : 'Math'}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteClick('text', text.id, () => removeText(text.id))}
                                    className={`text-[11px] ${
                                        pendingDelete?.id === text.id && pendingDelete.type === 'text'
                                            ? 'text-red-800'
                                            : 'text-red-600'
                                    }`}
                                >
                                    {pendingDelete?.id === text.id && pendingDelete.type === 'text'
                                        ? (isFrench ? 'Confirmer' : 'Confirm')
                                        : (isFrench ? 'Supprimer' : 'Delete')}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="w-72">
                    <div className="text-[11px] text-gray-500 mb-1">
                        {isFrench ? 'Aper\u00e7u' : 'Preview'}
                    </div>
                    <div ref={previewRef} className="border border-gray-200 rounded p-2 bg-white" />
                    <div className="mt-2 text-[11px] text-gray-500">
                        {isFrench
                            ? 'Expressions accept\u00e9es : sin(x), cos(x), x^2, pi, e'
                            : 'Accepted expressions: sin(x), cos(x), x^2, pi, e'}
                    </div>
                </div>
            </div>

            <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
                <span className="text-[10px] text-gray-600">
                    {isFrench ? 'Cliquez sur Enregistrer pour valider' : 'Click Save to apply'}
                </span>
                <button
                    type="button"
                    onClick={onDelete}
                    className="text-xs text-red-700 hover:text-red-800 hover:underline"
                >
                    Delete
                </button>
            </div>
        </div>
    )
}


// ------------------------------------------------------------------
// SegmentedMathField: contentEditable-based editor
// ------------------------------------------------------------------

interface SegmentedMathFieldProps {
    value: ContentSegment[]
    onChange: (segments: ContentSegment[]) => void
    onBlur?: () => void
    placeholder?: string
    disabled?: boolean
    className?: string
    minRows?: number
    showMathButton?: boolean
    showTableButton?: boolean
    showGraphButton?: boolean
    showHint?: boolean
    compactToolbar?: boolean
    toolbarRightSlot?: React.ReactNode
    toolbarSize?: 'sm' | 'md'
    editorSize?: 'sm' | 'md'
    mathQuickSymbols?: Array<{ label: string; latex: string }>
    tableConfig?: { maxRows?: number | null; maxCols?: number | null; allowMath?: boolean }
    graphConfig?: {
        allowPoints?: boolean
        allowLines?: boolean
        allowCurves?: boolean
        allowFunctions?: boolean
        allowAreas?: boolean
        allowText?: boolean
    }
    locale?: string
    /** Show the persistent MathToolbar above the editor (default: true when showMathButton is true) */
    showMathToolbar?: boolean
    /** Position of the MathToolbar (default: 'top') */
    toolbarPosition?: 'top' | 'bottom'
}

type InsertMenuProps = {
    isFrench: boolean
    disabled?: boolean
    compactToolbar?: boolean
    toolbarSize: 'sm' | 'md'
    showMathButton: boolean
    showTableButton: boolean
    showGraphButton: boolean
    onInsertMath: () => void
    onInsertTable: () => void
    onInsertGraph: () => void
}

function InsertMenu({
    isFrench,
    disabled,
    compactToolbar,
    toolbarSize,
    showMathButton,
    showTableButton,
    showGraphButton,
    onInsertMath,
    onInsertTable,
    onInsertGraph,
}: InsertMenuProps) {
    const [open, setOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!open) return
        const handleClickOutside = (event: MouseEvent) => {
            if (!menuRef.current) return
            if (menuRef.current.contains(event.target as Node)) return
            setOpen(false)
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [open])

    if (!showMathButton && !showTableButton && !showGraphButton) return null

    const buttonPadding = compactToolbar ? 'px-1.5 py-0.5' : toolbarSize === 'md' ? 'px-3 py-1.5' : 'px-2 py-1'
    const iconSize = compactToolbar ? 'h-3 w-3' : toolbarSize === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'
    const label = isFrench ? 'Insérer' : 'Insert'

    return (
        <div ref={menuRef} className="relative">
            <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setOpen((prev) => !prev)}
                className={`inline-flex items-center rounded-md border border-brand-200 bg-brand-50 text-brand-900 hover:bg-brand-100 ${buttonPadding}`}
                disabled={disabled}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Insérer"
                title="Insérer"
            >
                <Plus className={iconSize} />
            </button>
            {open && (
                <div
                    role="menu"
                    className="absolute right-0 z-10 mt-2 w-44 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
                >
                    {showMathButton && (
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                onInsertMath()
                                setOpen(false)
                            }}
                            className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            disabled={disabled}
                        >
                            <Calculator className="h-4 w-4 text-indigo-600" />
                            {isFrench ? 'Formule' : 'Formula'}
                        </button>
                    )}
                    {showTableButton && (
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                onInsertTable()
                                setOpen(false)
                            }}
                            className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            disabled={disabled}
                        >
                            <Table className="h-4 w-4 text-emerald-600" />
                            {isFrench ? 'Tableau' : 'Table'}
                        </button>
                    )}
                    {showGraphButton && (
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                onInsertGraph()
                                setOpen(false)
                            }}
                            className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            disabled={disabled}
                        >
                            <LineChart className="h-4 w-4 text-amber-600" />
                            {isFrench ? 'Graphique' : 'Graph'}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

// Quick symbols for the hover math button
const defaultQuickSymbols = [
    { label: 'a/b', latex: '\\frac{#@}{#0}' },
    { label: '√', latex: '\\sqrt{#0}' },
    { label: 'x²', latex: '^{#0}' },
    { label: 'xₙ', latex: '_{#0}' },
    { label: '∑', latex: '\\sum_{#@}^{#0}' },
    { label: '∫', latex: '\\int_{#@}^{#0}' },
    { label: 'lim', latex: '\\lim_{#0}' },
    { label: 'π', latex: '\\pi' },
    { label: '∞', latex: '\\infty' },
    { label: '≤', latex: '\\leq' },
    { label: '≥', latex: '\\geq' },
    { label: '≠', latex: '\\neq' },
    { label: '×', latex: '\\times' },
    { label: 'α', latex: '\\alpha' },
    { label: 'β', latex: '\\beta' },
    { label: 'θ', latex: '\\theta' },
    { label: 'λ', latex: '\\lambda' },
    { label: 'ℝ', latex: '\\mathbb{R}' },
]

type HoverMathButtonProps = {
    isFrench: boolean
    disabled?: boolean
    onInsertSymbol: (latex: string) => void
    onInsertMathChip: () => void
}

function HoverMathButton({ isFrench, disabled, onInsertSymbol, onInsertMathChip }: HoverMathButtonProps) {
    const [isHovered, setIsHovered] = useState(false)

    return (
        <div
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <button
                type="button"
                disabled={disabled}
                onClick={onInsertMathChip}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 hover:text-brand-700 hover:bg-brand-50 rounded transition-colors disabled:opacity-50"
            >
                <Calculator className="h-3.5 w-3.5" />
                <span>{isFrench ? 'Maths' : 'Math'}</span>
                <ChevronDown className="h-3 w-3" />
            </button>
            {isHovered && (
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[280px]">
                    <div className="flex flex-wrap gap-1">
                        {defaultQuickSymbols.map((sym, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => onInsertSymbol(sym.latex)}
                                className="px-2 py-1 text-sm hover:bg-brand-50 rounded border border-gray-100 hover:border-brand-200 transition-colors"
                                title={sym.latex}
                            >
                                {sym.label}
                            </button>
                        ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onInsertMathChip}
                            className="w-full text-left px-2 py-1.5 text-xs text-brand-600 hover:bg-brand-50 rounded transition-colors"
                        >
                            {isFrench ? '+ Editeur de formule avancé' : '+ Advanced formula editor'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function SegmentedMathField({
    value,
    onChange,
    onBlur,
    placeholder,
    disabled,
    className = '',
    minRows = 2,
    showMathButton = true,
    showTableButton = true,
    showGraphButton = showTableButton,
    showHint = true,
    showMathToolbar,
    toolbarPosition = 'top',
    compactToolbar = false,
    toolbarRightSlot,
    toolbarSize = 'sm',
    editorSize,
    mathQuickSymbols,
    tableConfig,
    graphConfig,
    locale = 'fr',
}: SegmentedMathFieldProps) {
    const editorRef = useRef<HTMLDivElement>(null)
    const editingChipRef = useRef<HTMLSpanElement | null>(null)
    const [editingMathId, setEditingMathId] = useState<string | null>(null)
    const editingTableRef = useRef<HTMLDivElement | null>(null)
    const [editingTableId, setEditingTableId] = useState<string | null>(null)
    const editingGraphRef = useRef<HTMLDivElement | null>(null)
    const [editingGraphId, setEditingGraphId] = useState<string | null>(null)
    const handleInputRef = useRef<() => void>(() => {})
    const isTableResizingRef = useRef(false)
    const [tableFocusCell, setTableFocusCell] = useState<{ row: number; col: number } | null>(null)
    // Draft mechanism: store draft latex while editing, keyed by segment id
    const [draftLatexById, setDraftLatexById] = useState<Record<string, string>>({})
    const [draftTableById, setDraftTableById] = useState<Record<string, TablePayload>>({})
    const [draftGraphById, setDraftGraphById] = useState<Record<string, GraphPayload>>({})
    // Store original latex when editing starts (for cancel to revert to)
    const originalLatexRef = useRef<string>('')
    const originalTableRef = useRef<TablePayload>(normalizeTablePayload())
    const originalGraphRef = useRef<GraphPayload>(createDefaultGraphPayload())
    // Track which math chip is pending deletion (requires confirmation)

    const [pendingDeletionId, setPendingDeletionId] = useState<string | null>(null)

    const segmentsRef = useRef<ContentSegment[]>(normalizeSegments(value))

    const lastExternalValue = useRef<string>(JSON.stringify(value))

    const [isHydrated, setIsHydrated] = useState(false)

    const [isEmpty, setIsEmpty] = useState(() => {
        const segs = normalizeSegments(value)
        return isSegmentsEmpty(segs)
    })
    const isFrench = locale === 'fr'

    // Compute whether to show the math toolbar (default: false - use Insert menu instead)
    const shouldShowMathToolbar = showMathToolbar ?? false

    // Ref to track the active math field element for toolbar insertion
    const activeMathFieldRef = useRef<MathfieldElement | null>(null)


    // KaTeX is loaded via CSS import in globals.css - no script loading needed
    // The renderLatexToString function from KaTeXRenderer handles all rendering synchronously



    // ------------------------------------------------------------------

    // DOM Traversal: Extract segments from contentEditable DOM

    // ------------------------------------------------------------------



    const extractSegmentsFromDOM = useCallback((): ContentSegment[] => {

        const editor = editorRef.current

        if (!editor) return [{ id: createId(), type: 'text', text: '' }]



        const segments: ContentSegment[] = []

        let textBuffer = ''



        const flushText = () => {

            if (textBuffer) {

                segments.push({ id: createId(), type: 'text', text: textBuffer })

                textBuffer = ''

            }

        }



        const traverse = (node: Node) => {

            if (node.nodeType === Node.TEXT_NODE) {

                textBuffer += node.textContent || ''

            } else if (node.nodeType === Node.ELEMENT_NODE) {

                const el = node as HTMLElement



                // Check if it's a math chip
                if (el.hasAttribute('data-math-id')) {
                    flushText()
                    const mathId = el.getAttribute('data-math-id') || createId()
                    const latex = el.getAttribute('data-latex') || ''
                    segments.push({ id: mathId, type: 'math', latex })
                } else if (el.hasAttribute('data-table-id')) {
                    flushText()
                    const tableId = el.getAttribute('data-table-id') || createId()
                    const payload = parseTablePayload(el.getAttribute('data-table'))
                    segments.push({
                        id: tableId,
                        type: 'table',
                        rows: payload.rows,
                        colWidths: payload.colWidths,
                        rowHeights: payload.rowHeights,
                    })
                } else if (el.hasAttribute('data-graph-id')) {
                    flushText()
                    const graphId = el.getAttribute('data-graph-id') || createId()
                    const payload = parseGraphPayload(el.getAttribute('data-graph'))
                    segments.push({
                        id: graphId,
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
                    })
                } else if (el.tagName === 'BR') {
                    // Handle line breaks
                    textBuffer += '\n'
                } else if (el.tagName === 'DIV' || el.tagName === 'P') {
                    // Block elements add newlines (except for the first/last)

                    if (textBuffer && !textBuffer.endsWith('\n')) {

                        textBuffer += '\n'

                    }

                    for (const child of Array.from(el.childNodes)) {

                        traverse(child)

                    }

                    if (textBuffer && !textBuffer.endsWith('\n') && el.nextSibling) {

                        textBuffer += '\n'

                    }

                } else {

                    // Traverse children for other elements

                    for (const child of Array.from(el.childNodes)) {

                        traverse(child)

                    }

                }

            }

        }



        for (const child of Array.from(editor.childNodes)) {

            traverse(child)

        }



        flushText()



        return consolidateSegments(segments)

    }, [])



    // ------------------------------------------------------------------

    // Create a math chip element

    // ------------------------------------------------------------------



    const createMathChipElement = useCallback((id: string, latex: string, isPendingDeletion: boolean = false): HTMLSpanElement => {
        const chip = document.createElement('span')
        chip.setAttribute('data-math-id', id)
        chip.setAttribute('data-latex', latex)
        chip.setAttribute('contenteditable', 'false')

        const baseClasses = `rounded mx-0.5 cursor-pointer transition-all select-none border`

        chip.className = isPendingDeletion

            ? `${baseClasses} bg-red-50 hover:bg-red-100 border-red-300`

            : `${baseClasses} bg-indigo-50 hover:bg-indigo-100 border-indigo-200`

        chip.style.display = 'inline-block'

        chip.style.verticalAlign = 'middle'

        chip.style.padding = '2px 4px'

        chip.style.minWidth = latex ? '' : '1.5em'

        chip.style.maxWidth = '100%'

        chip.style.wordBreak = 'break-all'

        chip.style.overflowWrap = 'anywhere'

        chip.style.lineHeight = 'normal'



        // Inner content for rendering using KaTeX
        const inner = document.createElement('span')
        inner.className = `math-chip-content ${isPendingDeletion ? 'text-red-900' : 'text-indigo-900'}`
        inner.style.display = 'inline-block'
        inner.style.verticalAlign = 'middle'
        inner.style.wordBreak = 'break-all'
        inner.style.overflowWrap = 'anywhere'
        // Render using KaTeX instead of $...$ format
        inner.innerHTML = latex ? renderLatexToString(latex, false) : '\u25A1'
        chip.appendChild(inner)
        return chip
    }, [])

    // ------------------------------------------------------------------
    // Table rendering helpers
    // ------------------------------------------------------------------

    const renderSegmentsPreview = useCallback((segments: ContentSegment[], container: HTMLElement) => {
        segments.forEach((segment) => {
            if (segment.type === 'text') {
                container.appendChild(document.createTextNode(segment.text))
                return
            }
            if (segment.type === 'math') {
                const span = document.createElement('span')
                span.className = 'math-inline'
                // Render using KaTeX instead of MathJax $...$ format
                span.innerHTML = renderLatexToString(segment.latex, false)
                container.appendChild(span)
                return
            }
            const placeholder = document.createElement('span')
            placeholder.textContent = segment.type === 'graph'
                ? (isFrench ? '[graphique]' : '[graph]')
                : (isFrench ? '[tableau]' : '[table]')
            placeholder.className = 'text-gray-500'
            container.appendChild(placeholder)
        })
    }, [isFrench])

    const typesetMathElements = useCallback((root?: ParentNode) => {
        // With KaTeX, math is rendered synchronously when the element is created
        // This function is kept for API compatibility but does nothing since
        // KaTeX renders immediately via dangerouslySetInnerHTML or renderLatexToString
        const editor = editorRef.current
        const scope = root ?? editor
        if (!scope) return

        // Re-render any math chips that need updating
        const mathChips = scope.querySelectorAll('[data-math-id] .math-chip-content')
        mathChips.forEach((chip) => {
            const parent = chip.closest('[data-math-id]')
            const latex = parent?.getAttribute('data-latex') || ''
            const html = latex ? renderLatexToString(latex, false) : '\u25A1'
            chip.innerHTML = html
        })
    }, [])

    const applyTableSizing = (table: HTMLTableElement, payload: TablePayload) => {
        const cols = payload.rows[0]?.length ?? 1
        const colWidths = payload.colWidths ?? []
        const rowHeights = payload.rowHeights ?? []

        let colgroup = table.querySelector('colgroup')
        if (!colgroup) {
            colgroup = document.createElement('colgroup')
            table.prepend(colgroup)
        }
        colgroup.innerHTML = ''
        for (let i = 0; i < cols; i++) {
            const col = document.createElement('col')
            if (colWidths[i]) {
                col.style.width = `${Math.max(minTableColumnWidth, colWidths[i])}px`
            }
            colgroup.appendChild(col)
        }

        const rows = Array.from(table.querySelectorAll('tr'))
        rows.forEach((tr, index) => {
            if (rowHeights[index]) {
                tr.style.height = `${Math.max(minTableRowHeight, rowHeights[index])}px`
            } else {
                tr.style.height = ''
            }
        })
    }

    const positionTableResizeHandles = (wrapper: HTMLDivElement, table: HTMLTableElement, payload: TablePayload) => {
        const handles = wrapper.querySelectorAll('.table-resize-handle')
        if (handles.length === 0) return

        const rowElements = Array.from(table.rows)
        if (rowElements.length === 0) return
        const firstRow = rowElements[0]
        const colCount = firstRow.cells.length
        const rowCount = rowElements.length

        const wrapperRect = wrapper.getBoundingClientRect()
        const tableRect = table.getBoundingClientRect()

        let handleIndex = 0
        for (let col = 0; col < colCount - 1; col++) {
            const handle = handles[handleIndex++] as HTMLDivElement
            const cellRect = firstRow.cells[col].getBoundingClientRect()
            const left = cellRect.right - wrapperRect.left
            handle.style.left = `${left}px`
            handle.style.top = `${tableRect.top - wrapperRect.top}px`
            handle.style.height = `${tableRect.height}px`
        }

        for (let row = 0; row < rowCount - 1; row++) {
            const handle = handles[handleIndex++] as HTMLDivElement
            const rowRect = rowElements[row].getBoundingClientRect()
            const top = rowRect.bottom - wrapperRect.top
            handle.style.left = `${tableRect.left - wrapperRect.left}px`
            handle.style.top = `${top}px`
            handle.style.width = `${tableRect.width}px`
        }
    }

    const attachTableResizeHandlers = (wrapper: HTMLDivElement, table: HTMLTableElement) => {
        const handles = wrapper.querySelectorAll<HTMLDivElement>('.table-resize-handle')
        handles.forEach((handle) => {
            const type = handle.getAttribute('data-handle-type')
            const index = Number(handle.getAttribute('data-index') || 0)
            const isColumn = type === 'col'

            handle.style.cursor = isColumn ? 'col-resize' : 'row-resize'
            handle.style.width = isColumn ? '6px' : handle.style.width || '100%'
            handle.style.height = isColumn ? handle.style.height || '100%' : '6px'
            handle.style.marginLeft = isColumn ? '-3px' : '0'
            handle.style.marginTop = isColumn ? '0' : '-3px'

            handle.onmousedown = (event: MouseEvent) => {
                event.preventDefault()
                event.stopPropagation()
                isTableResizingRef.current = true

                const startX = event.clientX
                const startY = event.clientY
                const payload = parseTablePayload(wrapper.getAttribute('data-table'))
                const rows = payload.rows.length
                const cols = payload.rows[0]?.length ?? 1

                let colWidths = payload.colWidths
                if (!colWidths || colWidths.length !== cols) {
                    const measured = Array.from(table.rows[0]?.cells ?? []).map((cell) =>
                        Math.max(minTableColumnWidth, cell.getBoundingClientRect().width)
                    )
                    colWidths = capColWidthsToMax(measured, maxExamSheetWidth)
                }

                let rowHeights = payload.rowHeights
                if (!rowHeights || rowHeights.length !== rows) {
                    rowHeights = Array.from(table.rows).map((row) =>
                        Math.max(minTableRowHeight, row.getBoundingClientRect().height)
                    )
                }

                const startWidth = colWidths[index] ?? minTableColumnWidth
                const startHeight = rowHeights[index] ?? minTableRowHeight

                const previousCursor = document.body.style.cursor
                document.body.style.cursor = isColumn ? 'col-resize' : 'row-resize'

                const handleMove = (moveEvent: MouseEvent) => {
                    if (isColumn) {
                        const delta = moveEvent.clientX - startX
                        const rawNextWidth = startWidth + delta
                        const totalOther = colWidths?.reduce((sum, width, idx) => (idx === index ? sum : sum + width), 0) ?? 0
                        const available = maxExamSheetWidth - totalOther
                        const minAllowed = Math.min(minTableColumnWidth, Math.max(0, available))
                        const constrained = Math.max(minAllowed, Math.min(rawNextWidth, available))
                        const nextPayload = {
                            ...payload,
                            colWidths: colWidths?.map((width, idx) => (idx === index ? constrained : width)),
                            rowHeights,
                        }
                        wrapper.setAttribute('data-table', JSON.stringify(nextPayload))
                        applyTableSizing(table, nextPayload)
                        positionTableResizeHandles(wrapper, table, nextPayload)
                    } else {
                        const delta = moveEvent.clientY - startY
                        const nextHeight = Math.max(minTableRowHeight, startHeight + delta)
                        const nextPayload = {
                            ...payload,
                            colWidths,
                            rowHeights: rowHeights?.map((height, idx) => (idx === index ? nextHeight : height)),
                        }
                        wrapper.setAttribute('data-table', JSON.stringify(nextPayload))
                        applyTableSizing(table, nextPayload)
                        positionTableResizeHandles(wrapper, table, nextPayload)
                    }
                }

                const handleUp = () => {
                    document.removeEventListener('mousemove', handleMove)
                    document.removeEventListener('mouseup', handleUp)
                    document.body.style.cursor = previousCursor
                    handleInputRef.current()
                    setTimeout(() => {
                        isTableResizingRef.current = false
                    }, 0)
                }

                document.addEventListener('mousemove', handleMove)
                document.addEventListener('mouseup', handleUp)
            }
            handle.onclick = (event: MouseEvent) => {
                event.preventDefault()
                event.stopPropagation()
            }
        })
    }

    const renderTablePreview = useCallback((wrapper: HTMLDivElement, payload: TablePayload) => {
        while (wrapper.firstChild) {
            wrapper.removeChild(wrapper.firstChild)
        }

        const table = document.createElement('table')
        table.style.borderCollapse = 'collapse'
        table.style.width = 'max-content'
        table.style.maxWidth = '100%'
        table.style.tableLayout = 'fixed'

        const tbody = document.createElement('tbody')
        payload.rows.forEach((row, rowIndex) => {
            const tr = document.createElement('tr')
            row.forEach((cell, colIndex) => {
                const td = document.createElement('td')
                td.style.border = '1px solid #e5e7eb'
                td.style.padding = '6px'
                td.style.verticalAlign = 'top'
                td.style.minWidth = `${minTableColumnWidth}px`
                td.setAttribute('data-table-cell-row', String(rowIndex))
                td.setAttribute('data-table-cell-col', String(colIndex))
                if (payload.rowHeights?.[rowIndex]) {
                    td.style.height = `${Math.max(minTableRowHeight, payload.rowHeights[rowIndex])}px`
                }
                renderSegmentsPreview(cell, td)
                tr.appendChild(td)
            })
            tbody.appendChild(tr)
        })

        table.appendChild(tbody)
        wrapper.appendChild(table)
        applyTableSizing(table, payload)
        typesetMathElements(table)

        const existingHandles = wrapper.querySelectorAll('.table-resize-handle')
        existingHandles.forEach((handle) => handle.remove())

        const cols = payload.rows[0]?.length ?? 1
        const rows = payload.rows.length
        const handleCount = Math.max(0, cols - 1) + Math.max(0, rows - 1)

        for (let i = 0; i < handleCount; i++) {
            const handle = document.createElement('div')
            handle.className = 'table-resize-handle'
            handle.style.position = 'absolute'
            handle.style.zIndex = '1'
            handle.style.background = 'rgba(99, 102, 241, 0.18)'
            handle.style.opacity = '0.35'
            handle.style.userSelect = 'none'
            handle.style.pointerEvents = 'auto'
            if (i < cols - 1) {
                handle.setAttribute('data-handle-type', 'col')
                handle.setAttribute('data-index', String(i))
            } else {
                handle.setAttribute('data-handle-type', 'row')
                handle.setAttribute('data-index', String(i - (cols - 1)))
            }
            wrapper.appendChild(handle)
        }

        positionTableResizeHandles(wrapper, table, payload)
        attachTableResizeHandlers(wrapper, table)
    }, [renderSegmentsPreview, typesetMathElements, attachTableResizeHandlers, applyTableSizing, positionTableResizeHandles])

    const createTableElement = useCallback((id: string, payload: TablePayload, isPendingDeletion: boolean = false): HTMLDivElement => {
        const wrapper = document.createElement('div')
        wrapper.setAttribute('data-table-id', id)
        wrapper.setAttribute('data-table', JSON.stringify(payload))
        wrapper.setAttribute('contenteditable', 'false')
        wrapper.className = isPendingDeletion
            ? 'table-chip border border-red-300 rounded-md bg-red-50 shadow-sm'
            : 'table-chip border border-gray-200 rounded-md bg-white shadow-sm'
        wrapper.style.display = 'block'
        wrapper.style.margin = '6px 0'
        wrapper.style.padding = '6px'
        wrapper.style.cursor = 'pointer'
        wrapper.style.maxWidth = '100%'
        wrapper.style.position = 'relative'
        wrapper.style.width = 'max-content'
        wrapper.style.maxWidth = `${maxExamSheetWidth}px`

        renderTablePreview(wrapper, payload)
        return wrapper
    }, [renderTablePreview])

    const createGraphElement = useCallback((id: string, payload: GraphPayload, isPendingDeletion: boolean = false): HTMLDivElement => {
        const wrapper = document.createElement('div')
        wrapper.setAttribute('data-graph-id', id)
        wrapper.setAttribute('data-graph', JSON.stringify(payload))
        wrapper.setAttribute('contenteditable', 'false')
        wrapper.className = isPendingDeletion
            ? 'graph-chip border border-red-300 rounded-md bg-red-50 shadow-sm'
            : 'graph-chip border border-gray-200 rounded-md bg-white shadow-sm'
        wrapper.style.display = 'block'
        wrapper.style.margin = '6px 0'
        wrapper.style.padding = '6px'
        wrapper.style.cursor = 'pointer'
        wrapper.style.maxWidth = `${maxExamSheetWidth}px`
        wrapper.style.width = 'max-content'
        wrapper.style.position = 'relative'

        renderGraphInto(wrapper, { id, type: 'graph', ...payload }, { maxWidth: maxExamSheetWidth })
        typesetMathElements(wrapper)
        return wrapper
    }, [typesetMathElements])

    const scheduleTableLayoutRefresh = useCallback((wrapper: HTMLDivElement) => {
        requestAnimationFrame(() => {
            const table = wrapper.querySelector('table') as HTMLTableElement | null
            if (!table) return
            const payload = parseTablePayload(wrapper.getAttribute('data-table'))
            applyTableSizing(table, payload)
            positionTableResizeHandles(wrapper, table, payload)
            attachTableResizeHandlers(wrapper, table)
        })
    }, [applyTableSizing, positionTableResizeHandles, attachTableResizeHandlers])

    // ------------------------------------------------------------------
    // Typeset math chips in the editor
    // ------------------------------------------------------------------


    // ------------------------------------------------------------------

    // Hydrate editor from segments (mount / external reset)

    // ------------------------------------------------------------------



    const hydrateEditorFromSegments = useCallback(() => {

        const editor = editorRef.current

        if (!editor) return



        // Don't rehydrate if editor has focus - it would disrupt user's cursor position

        const hadFocus = document.activeElement === editor

        if (hadFocus) return



        // Clear editor

        editor.innerHTML = ''



        const segments = segmentsRef.current

        const hasContent = segments.some(
            (s) => (s.type === 'text' && s.text?.trim()) || s.type === 'math' || s.type === 'table' || s.type === 'graph'
        )


        if (!hasContent) {

            // Empty - will show placeholder via CSS

            return

        }



        for (let i = 0; i < segments.length; i++) {

            const seg = segments[i]

            if (seg.type === 'text') {
                // Handle text with potential newlines
                const lines = seg.text.split('\n')
                lines.forEach((line, lineIndex) => {
                    if (line) {
                        editor.appendChild(document.createTextNode(line))
                    }
                    if (lineIndex < lines.length - 1) {
                        editor.appendChild(document.createElement('br'))
                    }
                })
            } else if (seg.type === 'math') {
                const chip = createMathChipElement(seg.id, seg.latex, pendingDeletionId === seg.id)
                editor.appendChild(chip)
            } else if (seg.type === 'table') {
                const payload = normalizeTablePayload(seg)
                const table = createTableElement(seg.id, payload, pendingDeletionId === seg.id)
                editor.appendChild(table)
                scheduleTableLayoutRefresh(table)
            } else if (seg.type === 'graph') {
                const payload = normalizeGraphPayload(seg)
                const graph = createGraphElement(seg.id, payload, pendingDeletionId === seg.id)
                editor.appendChild(graph)
            }
        }


        // Typeset math
        typesetMathElements()
    }, [createMathChipElement, createTableElement, createGraphElement, typesetMathElements, pendingDeletionId, scheduleTableLayoutRefresh])


    // ------------------------------------------------------------------

    // Initial mount: hydrate from segments

    // ------------------------------------------------------------------



    useEffect(() => {

        if (isHydrated) return

        const editor = editorRef.current

        if (!editor) return



        setIsHydrated(true)

        hydrateEditorFromSegments()

    }, [isHydrated, hydrateEditorFromSegments])



    // ------------------------------------------------------------------

    // Track if we need to sync from props (external change)

    // ------------------------------------------------------------------



    useEffect(() => {

        if (!isHydrated) return

        const newValStr = JSON.stringify(value)

        if (newValStr !== lastExternalValue.current) {

            lastExternalValue.current = newValStr

            segmentsRef.current = normalizeSegments(value)

            

            // Update isEmpty state when value changes externally

            // Also remove zero-width spaces (\u200B) before checking

            const segs = normalizeSegments(value)
            const empty = isSegmentsEmpty(segs)
            setIsEmpty(empty)

            

            // If empty, clear the DOM completely for CSS :empty to work

            if (empty && editorRef.current) {

                editorRef.current.innerHTML = ''

            } else {

                // Rehydrate the editor from segments only if not empty

                hydrateEditorFromSegments()

            }

        }

    }, [value, isHydrated, hydrateEditorFromSegments])



    // ------------------------------------------------------------------

    // Handle input: extract segments and notify parent

    // ------------------------------------------------------------------



    const handleInput = useCallback(() => {
        const newSegments = extractSegmentsFromDOM()
        segmentsRef.current = newSegments
        lastExternalValue.current = JSON.stringify(newSegments)


        // Update isEmpty state (check for empty or whitespace-only text)

        // Also remove zero-width spaces (\u200B) before checking

        const empty = isSegmentsEmpty(newSegments)
        setIsEmpty(empty)



        // If empty, clear the DOM completely so CSS :empty pseudo-class works

        if (empty && editorRef.current) {

            editorRef.current.innerHTML = ''

        }



        onChange(newSegments)
    }, [extractSegmentsFromDOM, onChange])

    useEffect(() => {
        handleInputRef.current = handleInput
    }, [handleInput])


    // ------------------------------------------------------------------

    // Handle blur

    // ------------------------------------------------------------------



    const handleBlur = useCallback(

        (e: React.FocusEvent) => {

            // Don't close math editor if clicking into it

            const relatedTarget = e.relatedTarget as HTMLElement

            if (
                relatedTarget?.closest('.inline-math-editor-popup') ||
                relatedTarget?.closest('.inline-table-editor-popup') ||
                relatedTarget?.closest('.inline-graph-editor-popup')
            ) {
                return
            }


            // Extract and save segments

            const newSegments = extractSegmentsFromDOM()

            segmentsRef.current = newSegments

            lastExternalValue.current = JSON.stringify(newSegments)

            onChange(newSegments)

            onBlur?.()

        },

        [extractSegmentsFromDOM, onChange, onBlur]

    )



    // ------------------------------------------------------------------

    // Handle click on math chips

    // ------------------------------------------------------------------



    const handleEditorClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement
        if (isTableResizingRef.current) {
            return
        }
        if (target.closest('.table-resize-handle')) {
            return
        }
        const table = target.closest('[data-table-id]') as HTMLElement | null
        const graph = target.closest('[data-graph-id]') as HTMLElement | null
        const chip = target.closest('[data-math-id]') as HTMLElement | null

        if (table) {
            e.preventDefault()
            e.stopPropagation()
            const tableId = table.getAttribute('data-table-id')
            if (tableId) {
                if (pendingDeletionId === tableId) {
                    table.remove()
                    setPendingDeletionId(null)
                    handleInput()
                    return
                }

                const payload = parseTablePayload(table.getAttribute('data-table'))
                if (pendingDeletionId) {
                    setPendingDeletionId(null)
                }
                editingTableRef.current = table as HTMLDivElement
                setEditingTableId(tableId)
                setEditingMathId(null)
                setTableFocusCell(() => {
                    const cell = target.closest('td[data-table-cell-row]') as HTMLElement | null
                    if (!cell) return null
                    const row = Number(cell.getAttribute('data-table-cell-row') || 0)
                    const col = Number(cell.getAttribute('data-table-cell-col') || 0)
                    return { row, col }
                })
                setDraftTableById((prev) => ({ ...prev, [tableId]: payload }))
                originalTableRef.current = payload
            }
            return
        }

        if (graph) {
            e.preventDefault()
            e.stopPropagation()
            const graphId = graph.getAttribute('data-graph-id')
            if (graphId) {
                if (pendingDeletionId === graphId) {
                    graph.remove()
                    setPendingDeletionId(null)
                    handleInput()
                    return
                }

                const payload = parseGraphPayload(graph.getAttribute('data-graph'))
                if (pendingDeletionId) {
                    setPendingDeletionId(null)
                }
                editingGraphRef.current = graph as HTMLDivElement
                setEditingGraphId(graphId)
                setEditingMathId(null)
                setEditingTableId(null)
                setTableFocusCell(null)
                setDraftGraphById((prev) => ({ ...prev, [graphId]: payload }))
                originalGraphRef.current = payload
            }
            return
        }

        if (chip) {
            e.preventDefault()
            e.stopPropagation()
            const mathId = chip.getAttribute('data-math-id')
            const currentLatex = chip.getAttribute('data-latex') || ''
            if (mathId) {
                // If chip is pending deletion, clicking it confirms deletion

                if (pendingDeletionId === mathId) {

                    // Delete the chip

                    chip.remove()

                    setPendingDeletionId(null)

                    handleInput()

                    return

                }

                

                // Cancel any pending deletion

                if (pendingDeletionId) {

                    setPendingDeletionId(null)

                }

                

                editingChipRef.current = chip as HTMLSpanElement
                setEditingMathId(mathId)
                setEditingTableId(null)
                setEditingGraphId(null)
                setTableFocusCell(null)
                // Initialize draft with current latex
                setDraftLatexById(prev => ({ ...prev, [mathId]: currentLatex }))
                // Store original for cancel
                originalLatexRef.current = currentLatex
            }
        } else {

            // Click outside chips - cancel pending deletion

            if (pendingDeletionId) {

                setPendingDeletionId(null)

            }

        }

    }, [pendingDeletionId, handleInput])





    // ------------------------------------------------------------------

    // Insert a new math chip at current caret position

    // ------------------------------------------------------------------



    const insertMathChip = useCallback(() => {
        if (disabled) return


        const editor = editorRef.current

        if (!editor) return



        const selection = window.getSelection()

        let range: Range | null = null

        

        // Check if we have a valid selection inside the editor

        if (selection && selection.rangeCount > 0) {

            const testRange = selection.getRangeAt(0)

            if (editor.contains(testRange.commonAncestorContainer)) {

                range = testRange

            }

        }



        // If no valid selection or not in editor, insert at end

        if (!range) {

            editor.focus()

            

            // Create range at the end of the editor

            range = document.createRange()

            const lastChild = editor.lastChild

            

            if (lastChild) {

                if (lastChild.nodeType === Node.TEXT_NODE) {

                    // Place at end of last text node

                    range.setStart(lastChild, lastChild.textContent?.length || 0)

                    range.setEnd(lastChild, lastChild.textContent?.length || 0)

                } else {

                    // Place after last child

                    range.setStartAfter(lastChild)

                    range.setEndAfter(lastChild)

                }

            } else {

                // Editor is empty, place at start

                range.setStart(editor, 0)

                range.setEnd(editor, 0)

            }

            

            // Update selection

            if (selection) {

                selection.removeAllRanges()

                selection.addRange(range)

            }

        } else {

            // We have a valid selection, use it

            editor.focus()

        }



        // Delete any selected content

        range.deleteContents()



        const newId = createId()

        const chip = createMathChipElement(newId, '')



        // Insert the chip

        range.insertNode(chip)



        // Move caret after the chip

        range.setStartAfter(chip)

        range.setEndAfter(chip)

        if (selection) {

            selection.removeAllRanges()

            selection.addRange(range)

        }



        editingChipRef.current = chip

        setEditingMathId(newId)

        // Initialize draft for new chip

        setDraftLatexById(prev => ({ ...prev, [newId]: '' }))

        originalLatexRef.current = ''

        handleInput()
    }, [disabled, createMathChipElement, handleInput])

    // ------------------------------------------------------------------
    // Insert math from toolbar: if editing math, insert into active field;
    // otherwise create a new math segment with the given LaTeX
    // ------------------------------------------------------------------

    const handleToolbarInsert = useCallback((latex: string) => {
        if (disabled) return

        // If we're currently editing a math segment, insert into the active math field
        if (editingMathId && activeMathFieldRef.current) {
            activeMathFieldRef.current.insert(latex, { focus: true, feedback: false })
            return
        }

        // Otherwise, create a new math segment with the inserted LaTeX
        const editor = editorRef.current
        if (!editor) return

        const selection = window.getSelection()
        let range: Range | null = null

        // Check if we have a valid selection inside the editor
        if (selection && selection.rangeCount > 0) {
            const testRange = selection.getRangeAt(0)
            if (editor.contains(testRange.commonAncestorContainer)) {
                range = testRange
            }
        }

        // If no valid selection or not in editor, insert at end
        if (!range) {
            editor.focus()
            range = document.createRange()
            const lastChild = editor.lastChild

            if (lastChild) {
                if (lastChild.nodeType === Node.TEXT_NODE) {
                    range.setStart(lastChild, lastChild.textContent?.length || 0)
                    range.setEnd(lastChild, lastChild.textContent?.length || 0)
                } else {
                    range.setStartAfter(lastChild)
                    range.setEndAfter(lastChild)
                }
            } else {
                range.setStart(editor, 0)
                range.setEnd(editor, 0)
            }

            if (selection) {
                selection.removeAllRanges()
                selection.addRange(range)
            }
        } else {
            editor.focus()
        }

        range.deleteContents()

        const newId = createId()
        const chip = createMathChipElement(newId, latex)

        // Insert the chip
        range.insertNode(chip)

        // Move caret after the chip
        range.setStartAfter(chip)
        range.setEndAfter(chip)
        if (selection) {
            selection.removeAllRanges()
            selection.addRange(range)
        }

        editingChipRef.current = chip
        setEditingMathId(newId)
        // Initialize draft with the inserted LaTeX
        setDraftLatexById(prev => ({ ...prev, [newId]: latex }))
        originalLatexRef.current = latex
        handleInput()
    }, [disabled, editingMathId, createMathChipElement, handleInput])

    // ------------------------------------------------------------------
    // Insert a new table at current caret position (always on next line)
    // ------------------------------------------------------------------

    const insertTable = useCallback(() => {
        if (disabled) return

        const editor = editorRef.current
        if (!editor) return

        const selection = window.getSelection()
        let range: Range | null = null

        if (selection && selection.rangeCount > 0) {
            const testRange = selection.getRangeAt(0)
            if (editor.contains(testRange.commonAncestorContainer)) {
                range = testRange
            }
        }

        if (!range) {
            editor.focus()
            range = document.createRange()
            const lastChild = editor.lastChild

            if (lastChild) {
                if (lastChild.nodeType === Node.TEXT_NODE) {
                    range.setStart(lastChild, lastChild.textContent?.length || 0)
                    range.setEnd(lastChild, lastChild.textContent?.length || 0)
                } else {
                    range.setStartAfter(lastChild)
                    range.setEndAfter(lastChild)
                }
            } else {
                range.setStart(editor, 0)
                range.setEnd(editor, 0)
            }

            if (selection) {
                selection.removeAllRanges()
                selection.addRange(range)
            }
        } else {
            editor.focus()
        }

        range.deleteContents()

        const isAtLineStart = () => {
            const container = range?.startContainer
            const offset = range?.startOffset ?? 0
            if (!container) return true

            if (container.nodeType === Node.TEXT_NODE) {
                const text = container.textContent || ''
                const before = text.slice(0, offset).replace(/\u200B/g, '')
                if (before.length > 0) return false

                let prev: Node | null = container.previousSibling
                while (prev && prev.nodeType === Node.TEXT_NODE) {
                    const content = prev.textContent || ''
                    if (content.replace(/\u200B/g, '').length > 0) {
                        return false
                    }
                    prev = prev.previousSibling
                }
                if (!prev) return true
                return prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).tagName === 'BR'
            }

            if (container.nodeType === Node.ELEMENT_NODE) {
                const el = container as Element
                if (offset === 0) {
                    let prev: Node | null = el.previousSibling
                    if (!prev) return true
                    return prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).tagName === 'BR'
                }

                let prev: Node | null = el.childNodes[offset - 1] || null
                while (prev && prev.nodeType === Node.TEXT_NODE) {
                    const content = prev.textContent || ''
                    if (content.replace(/\u200B/g, '').length > 0) {
                        return false
                    }
                    prev = prev.previousSibling
                }
                if (!prev) return true
                return prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).tagName === 'BR'
            }

            return true
        }

        const isEditorEffectivelyEmpty = () => {
            const hasSegment = editor.querySelector('[data-math-id], [data-table-id], [data-graph-id]')
            if (hasSegment) return false
            const text = editor.textContent?.replace(/\u200B/g, '').trim() ?? ''
            return text.length === 0
        }

        if (isEditorEffectivelyEmpty()) {
            editor.innerHTML = ''
        }

        const getNextNodeAfterRange = (range: Range): Node | null => {
            const container = range.startContainer
            const offset = range.startOffset
            if (container.nodeType === Node.TEXT_NODE) {
                return container.nextSibling
            }
            if (container.nodeType === Node.ELEMENT_NODE) {
                return (container as Element).childNodes[offset] ?? null
            }
            return null
        }

        const newId = createId()
        const payload = normalizeTablePayload()
        const table = createTableElement(newId, payload)
        const brBefore = document.createElement('br')
        const brAfter = document.createElement('br')
        const nextNode = getNextNodeAfterRange(range)
        const hasExistingBrAfter = nextNode?.nodeType === Node.ELEMENT_NODE && (nextNode as HTMLElement).tagName === 'BR'

        const fragment = document.createDocumentFragment()
        if (!isAtLineStart() && !isEditorEffectivelyEmpty()) {
            fragment.appendChild(brBefore)
        }
        fragment.appendChild(table)
        if (!hasExistingBrAfter) {
            fragment.appendChild(brAfter)
        }
        range.insertNode(fragment)

        if (selection) {
            const newRange = document.createRange()
            if (hasExistingBrAfter && nextNode) {
                newRange.setStartAfter(nextNode)
                newRange.setEndAfter(nextNode)
            } else {
                newRange.setStartAfter(brAfter)
                newRange.setEndAfter(brAfter)
            }
            selection.removeAllRanges()
            selection.addRange(newRange)
        }

        editingTableRef.current = table
        setEditingTableId(newId)
        setDraftTableById((prev) => ({ ...prev, [newId]: payload }))
        originalTableRef.current = payload
        scheduleTableLayoutRefresh(table)

        handleInput()
    }, [disabled, createTableElement, handleInput, scheduleTableLayoutRefresh])

    // ------------------------------------------------------------------
    // Insert a new graph at current caret position (always on next line)
    // ------------------------------------------------------------------

    const insertGraph = useCallback(() => {
        if (disabled) return

        const editor = editorRef.current
        if (!editor) return

        const selection = window.getSelection()
        let range: Range | null = null

        if (selection && selection.rangeCount > 0) {
            const testRange = selection.getRangeAt(0)
            if (editor.contains(testRange.commonAncestorContainer)) {
                range = testRange
            }
        }

        if (!range) {
            editor.focus()
            range = document.createRange()
            const lastChild = editor.lastChild

            if (lastChild) {
                if (lastChild.nodeType === Node.TEXT_NODE) {
                    range.setStart(lastChild, lastChild.textContent?.length || 0)
                    range.setEnd(lastChild, lastChild.textContent?.length || 0)
                } else {
                    range.setStartAfter(lastChild)
                    range.setEndAfter(lastChild)
                }
            } else {
                range.setStart(editor, 0)
                range.setEnd(editor, 0)
            }

            if (selection) {
                selection.removeAllRanges()
                selection.addRange(range)
            }
        } else {
            editor.focus()
        }

        range.deleteContents()

        const isAtLineStart = () => {
            const container = range?.startContainer
            const offset = range?.startOffset ?? 0
            if (!container) return true

            if (container.nodeType === Node.TEXT_NODE) {
                const text = container.textContent || ''
                const before = text.slice(0, offset).replace(/\u200B/g, '')
                if (before.length > 0) return false

                let prev: Node | null = container.previousSibling
                while (prev && prev.nodeType === Node.TEXT_NODE) {
                    const content = prev.textContent || ''
                    if (content.replace(/\u200B/g, '').length > 0) {
                        return false
                    }
                    prev = prev.previousSibling
                }
                return !prev || (prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).tagName === 'BR')
            }

            if (container.nodeType === Node.ELEMENT_NODE) {
                const element = container as HTMLElement
                if (offset === 0) {
                    const prev = element.previousSibling
                    return !prev || (prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).tagName === 'BR')
                }
            }

            return false
        }

        const isEditorEffectivelyEmpty = () => {
            const content = editor.textContent?.replace(/\u200B/g, '').trim() ?? ''
            const hasSegment = editor.querySelector('[data-math-id], [data-table-id], [data-graph-id]')
            return !content && !hasSegment
        }

        const getNextNodeAfterRange = (range: Range): Node | null => {
            const container = range.startContainer
            const offset = range.startOffset
            if (container.nodeType === Node.TEXT_NODE) {
                return container.nextSibling
            }
            if (container.nodeType === Node.ELEMENT_NODE) {
                return (container as Element).childNodes[offset] ?? null
            }
            return null
        }

        const newId = createId()
        const payload = createDefaultGraphPayload()
        const graph = createGraphElement(newId, payload)
        const brBefore = document.createElement('br')
        const brAfter = document.createElement('br')
        const nextNode = getNextNodeAfterRange(range)
        const hasExistingBrAfter = nextNode?.nodeType === Node.ELEMENT_NODE && (nextNode as HTMLElement).tagName === 'BR'

        const fragment = document.createDocumentFragment()
        if (!isAtLineStart() && !isEditorEffectivelyEmpty()) {
            fragment.appendChild(brBefore)
        }
        fragment.appendChild(graph)
        if (!hasExistingBrAfter) {
            fragment.appendChild(brAfter)
        }
        range.insertNode(fragment)

        if (selection) {
            const newRange = document.createRange()
            if (hasExistingBrAfter && nextNode) {
                newRange.setStartAfter(nextNode)
                newRange.setEndAfter(nextNode)
            } else {
                newRange.setStartAfter(brAfter)
                newRange.setEndAfter(brAfter)
            }
            selection.removeAllRanges()
            selection.addRange(newRange)
        }

        editingGraphRef.current = graph
        setEditingGraphId(newId)
        setDraftGraphById((prev) => ({ ...prev, [newId]: payload }))
        originalGraphRef.current = payload

        handleInput()
    }, [disabled, createGraphElement, handleInput])

    // ------------------------------------------------------------------

    // Math editor callbacks (draft mechanism)

    // ------------------------------------------------------------------



    // Update draft and chip live as user types

    const handleChangeDraft = useCallback((newLatex: string) => {

        if (!editingMathId) return



        // Update draft state

        setDraftLatexById(prev => ({ ...prev, [editingMathId]: newLatex }))



        // Update chip in DOM live

        const editor = editorRef.current

        if (!editor) return



        const chip = editor.querySelector(`[data-math-id="${editingMathId}"]`) as HTMLElement

        if (chip) {

            chip.setAttribute('data-latex', newLatex)

            const inner = chip.querySelector('.math-chip-content')

            if (inner) {
                // Render using KaTeX - synchronous, no typeset call needed
                inner.innerHTML = newLatex ? renderLatexToString(newLatex, false) : '\u25A1'
            }

            chip.style.minWidth = newLatex ? '' : '1.5em'

        }

    }, [editingMathId])



    // Confirm: commit draft to segments

    const handleSaveMath = useCallback(() => {

        if (!editingMathId) return



        const editor = editorRef.current

        if (!editor) return



        // The chip should already be updated in DOM (via handleChangeDraft)

        // Just need to extract segments and clear editing state



        const currentMathId = editingMathId

        setEditingMathId(null)

        editingChipRef.current = null



        // Clear the draft

        setDraftLatexById(prev => {

            const next = { ...prev }

            delete next[currentMathId]

            return next

        })



        // Update segments from DOM

        handleInput()



        // Re-focus editor and position cursor after the math chip

        const chip = editor.querySelector(`[data-math-id="${currentMathId}"]`) as HTMLElement

        if (chip) {

            const range = document.createRange()

            const selection = window.getSelection()

            

            // Check if there's a text node after the chip
            let nextNode = chip.nextSibling
            if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
                // Place cursor at the start of the next text node
                range.setStart(nextNode, 0)
                range.setEnd(nextNode, 0)
            } else {
                // No text node after; position caret directly after the chip
                range.setStartAfter(chip)
                range.setEndAfter(chip)
            }
            

            if (selection) {

                selection.removeAllRanges()

                selection.addRange(range)

            }

        }

        

        editor.focus()

    }, [editingMathId, handleInput])



    // Cancel: revert chip to original latex

    const handleCancelMath = useCallback(() => {

        if (!editingMathId) return



        const editor = editorRef.current

        if (!editor) return



        // Restore chip in DOM to original latex

        const chip = editor.querySelector(`[data-math-id="${editingMathId}"]`) as HTMLElement

        if (chip) {

            const originalLatex = originalLatexRef.current

            chip.setAttribute('data-latex', originalLatex)

            const inner = chip.querySelector('.math-chip-content')

            if (inner) {
                // Render using KaTeX - synchronous, no typeset call needed
                inner.innerHTML = originalLatex ? renderLatexToString(originalLatex, false) : '\u25A1'
            }

            chip.style.minWidth = originalLatex ? '' : '1.5em'

        }



        const currentMathId = editingMathId

        setEditingMathId(null)

        editingChipRef.current = null



        // Clear the draft

        setDraftLatexById(prev => {

            const next = { ...prev }

            delete next[currentMathId]

            return next

        })



        editorRef.current?.focus()

    }, [editingMathId])



    const handleDeleteMath = useCallback(() => {
        if (!editingMathId) return


        const editor = editorRef.current

        if (!editor) return



        // Find and remove the chip

        const chip = editor.querySelector(`[data-math-id="${editingMathId}"]`)

        if (chip) {

            chip.remove()

        }



        const currentMathId = editingMathId

        setEditingMathId(null)

        editingChipRef.current = null



        // Clear the draft

        setDraftLatexById(prev => {

            const next = { ...prev }

            delete next[currentMathId]

            return next

        })



        // Update segments

        handleInput()



        // Re-focus editor

        editor.focus()
    }, [editingMathId, handleInput])

    // ------------------------------------------------------------------
    // Table editor callbacks
    // ------------------------------------------------------------------

    const handleChangeTableDraft = useCallback((newPayload: TablePayload) => {
        if (!editingTableId) return

        const normalized = normalizeTablePayload(newPayload)
        setDraftTableById((prev) => ({ ...prev, [editingTableId]: normalized }))

        const editor = editorRef.current
        if (!editor) return

        const table = editor.querySelector(`[data-table-id="${editingTableId}"]`) as HTMLDivElement | null
        if (table) {
            table.setAttribute('data-table', JSON.stringify(normalized))
            renderTablePreview(table, normalized)
        }
    }, [editingTableId, renderTablePreview])

    const handleSaveTable = useCallback(() => {
        if (!editingTableId) return

        const editor = editorRef.current
        if (!editor) return

        const currentTableId = editingTableId
        setEditingTableId(null)
        editingTableRef.current = null
        setTableFocusCell(null)

        setDraftTableById((prev) => {
            const next = { ...prev }
            delete next[currentTableId]
            return next
        })

        handleInput()

        const table = editor.querySelector(`[data-table-id="${currentTableId}"]`) as HTMLElement | null
        if (table) {
            const range = document.createRange()
            const selection = window.getSelection()
            range.setStartAfter(table)
            range.setEndAfter(table)
            if (selection) {
                selection.removeAllRanges()
                selection.addRange(range)
            }
        }

        editor.focus()
    }, [editingTableId, handleInput])

    const handleCancelTable = useCallback(() => {
        if (!editingTableId) return

        const editor = editorRef.current
        if (!editor) return

        const table = editor.querySelector(`[data-table-id="${editingTableId}"]`) as HTMLDivElement | null
        if (table) {
            const originalPayload = normalizeTablePayload(originalTableRef.current)
            table.setAttribute('data-table', JSON.stringify(originalPayload))
            renderTablePreview(table, originalPayload)
        }

        const currentTableId = editingTableId
        setEditingTableId(null)
        editingTableRef.current = null
        setTableFocusCell(null)

        setDraftTableById((prev) => {
            const next = { ...prev }
            delete next[currentTableId]
            return next
        })

        editorRef.current?.focus()
    }, [editingTableId, renderTablePreview])

    const handleDeleteTable = useCallback(() => {
        if (!editingTableId) return

        const editor = editorRef.current
        if (!editor) return

        const table = editor.querySelector(`[data-table-id="${editingTableId}"]`)
        if (table) {
            table.remove()
        }

        const currentTableId = editingTableId
        setEditingTableId(null)
        editingTableRef.current = null
        setPendingDeletionId(null)
        setTableFocusCell(null)

        setDraftTableById((prev) => {
            const next = { ...prev }
            delete next[currentTableId]
            return next
        })

        handleInput()
        editor.focus()
    }, [editingTableId, handleInput])

    // ------------------------------------------------------------------
    // Graph editor callbacks
    // ------------------------------------------------------------------

    const handleChangeGraphDraft = useCallback((newPayload: GraphPayload) => {
        if (!editingGraphId) return

        const normalized = normalizeGraphPayload(newPayload)
        setDraftGraphById((prev) => ({ ...prev, [editingGraphId]: normalized }))

        const editor = editorRef.current
        if (!editor) return

        const graph = editor.querySelector(`[data-graph-id="${editingGraphId}"]`) as HTMLDivElement | null
        if (graph) {
            graph.setAttribute('data-graph', JSON.stringify(normalized))
            renderGraphInto(graph, { id: editingGraphId, type: 'graph', ...normalized }, { maxWidth: maxExamSheetWidth })
            typesetMathElements(graph)
        }
    }, [editingGraphId, typesetMathElements])

    const handleSaveGraph = useCallback(() => {
        if (!editingGraphId) return

        const editor = editorRef.current
        if (!editor) return

        const currentGraphId = editingGraphId
        setEditingGraphId(null)
        editingGraphRef.current = null

        setDraftGraphById((prev) => {
            const next = { ...prev }
            delete next[currentGraphId]
            return next
        })

        handleInput()

        const graph = editor.querySelector(`[data-graph-id="${currentGraphId}"]`) as HTMLElement | null
        if (graph) {
            const range = document.createRange()
            const selection = window.getSelection()
            range.setStartAfter(graph)
            range.setEndAfter(graph)
            if (selection) {
                selection.removeAllRanges()
                selection.addRange(range)
            }
        }

        editor.focus()
    }, [editingGraphId, handleInput])

    const handleCancelGraph = useCallback(() => {
        if (!editingGraphId) return

        const editor = editorRef.current
        if (!editor) return

        const graph = editor.querySelector(`[data-graph-id="${editingGraphId}"]`) as HTMLDivElement | null
        if (graph) {
            const originalPayload = normalizeGraphPayload(originalGraphRef.current)
            graph.setAttribute('data-graph', JSON.stringify(originalPayload))
            renderGraphInto(graph, { id: editingGraphId, type: 'graph', ...originalPayload }, { maxWidth: maxExamSheetWidth })
            typesetMathElements(graph)
        }

        const currentGraphId = editingGraphId
        setEditingGraphId(null)
        editingGraphRef.current = null

        setDraftGraphById((prev) => {
            const next = { ...prev }
            delete next[currentGraphId]
            return next
        })

        editorRef.current?.focus()
    }, [editingGraphId, typesetMathElements])

    const handleDeleteGraph = useCallback(() => {
        if (!editingGraphId) return

        const editor = editorRef.current
        if (!editor) return

        const graph = editor.querySelector(`[data-graph-id="${editingGraphId}"]`)
        if (graph) {
            graph.remove()
        }

        const currentGraphId = editingGraphId
        setEditingGraphId(null)
        editingGraphRef.current = null
        setPendingDeletionId(null)

        setDraftGraphById((prev) => {
            const next = { ...prev }
            delete next[currentGraphId]
            return next
        })

        handleInput()
        editor.focus()
    }, [editingGraphId, handleInput])

    // ------------------------------------------------------------------
    // Close math editor when clicking outside
    // ------------------------------------------------------------------


    useEffect(() => {
        if (!editingMathId) return


        const handleClickOutside = (e: MouseEvent) => {

            const target = e.target as Node



            // Check if click is inside the math editor popup

            const editorPopup = document.querySelector('.inline-math-editor-popup')

            if (editorPopup?.contains(target)) return



            // Check if click is on the editing chip

            if (editingChipRef.current?.contains(target)) return



            // Click is outside - cancel editing

            handleCancelMath()

        }



        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [editingMathId, handleCancelMath])

    // ------------------------------------------------------------------
    // Close table editor when clicking outside
    // ------------------------------------------------------------------

    useEffect(() => {
        if (!editingTableId) return

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node

            const editorPopup = document.querySelector('.inline-table-editor-popup')
            if (editorPopup?.contains(target)) return

            if (editingTableRef.current?.contains(target)) return

            handleCancelTable()
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [editingTableId, handleCancelTable])

    // ------------------------------------------------------------------
    // Close graph editor when clicking outside
    // ------------------------------------------------------------------

    useEffect(() => {
        if (!editingGraphId) return

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node

            const editorPopup = document.querySelector('.inline-graph-editor-popup')
            if (editorPopup?.contains(target)) return

            if (editingGraphRef.current?.contains(target)) return

            handleCancelGraph()
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [editingGraphId, handleCancelGraph])

    // ------------------------------------------------------------------

    // Update chip visual state when pendingDeletionId changes

    // ------------------------------------------------------------------



    useEffect(() => {

        const editor = editorRef.current

        if (!editor) return



        // Update all chips to reflect pending deletion state
        const chips = editor.querySelectorAll('[data-math-id], [data-table-id], [data-graph-id]')
        chips.forEach((chipEl) => {
            const chip = chipEl as HTMLElement
            const segmentId = getSegmentId(chip)
            const isPending = pendingDeletionId === '__all__' || pendingDeletionId === segmentId

            if (chip.hasAttribute('data-math-id')) {
                chip.className = chip.className
                    .replace(/bg-(red|indigo)-50/g, '')
                    .replace(/hover:bg-(red|indigo)-100/g, '')
                    .replace(/border-(red|indigo)-\d+/g, '')
                    .trim()

                if (isPending) {
                    chip.className += ' bg-red-50 hover:bg-red-100 border-red-300'
                } else {
                    chip.className += ' bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
                }

                const inner = chip.querySelector('.math-chip-content')
                if (inner) {
                    inner.className = inner.className
                        .replace(/text-(red|indigo)-900/g, '')
                        .trim()
                    inner.className += isPending ? ' text-red-900' : ' text-indigo-900'
                }
                return
            }

            if (chip.hasAttribute('data-table-id')) {
                chip.className = chip.className
                    .replace(/bg-red-50|bg-white/g, '')
                    .replace(/border-(red|gray)-\d+/g, '')
                    .trim()

                if (isPending) {
                    chip.className += ' bg-red-50 border-red-300'
                } else {
                    chip.className += ' bg-white border-gray-200'
                }
            }
        })
    }, [pendingDeletionId])


    // ------------------------------------------------------------------

    // Handle paste: strip formatting, keep only text

    // ------------------------------------------------------------------



    const handlePaste = useCallback((e: React.ClipboardEvent) => {

        e.preventDefault()

        const text = e.clipboardData.getData('text/plain')

        document.execCommand('insertText', false, text)

    }, [])



    // ------------------------------------------------------------------

    // Handle keydown: prevent some default behaviors if needed

    // ------------------------------------------------------------------



    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const editor = editorRef.current
        if (!editor) return

        const isSelectAll = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a'
        if (isSelectAll) {
            e.preventDefault()
            const selection = window.getSelection()
            if (!selection) return
            const range = document.createRange()
            range.selectNodeContents(editor)
            selection.removeAllRanges()
            selection.addRange(range)
            return
        }

        // Prevent default tab behavior (or handle it as needed)
        if (e.key === 'Tab') {
            e.preventDefault()
            document.execCommand('insertText', false, '    ')
            return
        }



        // Handle Enter key: insert <br> instead of letting browser create <div>

        // This ensures consistent DOM structure and prevents issues with line merging

        if (e.key === 'Enter' && !e.shiftKey) {

            e.preventDefault()

            

            const selection = window.getSelection()

            if (!selection || selection.rangeCount === 0) return

            

            const range = selection.getRangeAt(0)

            range.deleteContents()

            

            // Insert a <br> element

            const br = document.createElement('br')

            range.insertNode(br)

            

            // Move cursor after the <br>

            range.setStartAfter(br)

            range.setEndAfter(br)

            

            // Check if we need to add a text node after the <br> for cursor positioning

            // This is only needed when the <br> is at the very end of the editor

            const nextSibling = br.nextSibling

            const isAtEnd = !nextSibling || 

                (nextSibling.nodeType === Node.TEXT_NODE && nextSibling.textContent === '')

            

            if (isAtEnd) {

                // Add a zero-width space after the <br> to allow cursor positioning

                const textNode = document.createTextNode('\u200B')

                br.parentNode?.insertBefore(textNode, br.nextSibling)

                range.setStart(textNode, 0)

                range.setEnd(textNode, 0)

            }

            

            selection.removeAllRanges()

            selection.addRange(range)

            

            // Trigger input handler to update segments

            handleInput()

            return

        }



        // Handle Delete/Backspace near math chips

        // Check early to prevent default deletion behavior if needed

        if (e.key === 'Delete' || e.key === 'Backspace') {
            const selection = window.getSelection()
            if (!selection || selection.rangeCount === 0) return

            const range = selection.getRangeAt(0)
            if (!editor.contains(range.commonAncestorContainer)) return
            const isCollapsed = range.collapsed

            const selectionHasSegments = () => {
                const segments = editor.querySelectorAll('[data-math-id], [data-table-id], [data-graph-id]')
                for (const segment of Array.from(segments)) {
                    try {
                        if (range.intersectsNode(segment)) return true
                    } catch {
                        // Some browsers may throw on non-selectable nodes; ignore.
                    }
                }
                return false
            }

            if (!isCollapsed) {
                if (!selectionHasSegments()) return

                e.preventDefault()
                e.stopPropagation()

                if (pendingDeletionId === '__all__') {
                    range.deleteContents()
                    setPendingDeletionId(null)
                    handleInput()
                } else {
                    setPendingDeletionId('__all__')
                }
                return
            }
            const findNextSegmentSkippingBreaks = (start: Node | null): HTMLElement | null => {
                let node = start
                while (node) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const content = node.textContent || ''
                        if (content.replace(/\u200B/g, '').length > 0) return null
                        node = node.nextSibling
                        continue
                    }
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const el = node as HTMLElement
                        if (el.tagName === 'BR') {
                            node = el.nextSibling
                            continue
                        }
                        return isSegmentElement(el) ? el : null
                    }
                    node = node.nextSibling
                }
                return null
            }

            // Check if cursor is immediately before or after a math chip or table
            let adjacentElement: HTMLElement | null = null
            const cursorContainer = range.startContainer

            const cursorOffset = range.startOffset



            // Simple direct check: if cursor is in a text node, check its siblings

            if (cursorContainer.nodeType === Node.TEXT_NODE) {

                const textNode = cursorContainer as Text

                const fullText = textNode.textContent || ''

                

                // For Backspace: check if the text BEFORE the cursor is empty or only invisible chars

                if (e.key === 'Backspace') {

                    // Get text before cursor in this node

                    const textBeforeCursor = fullText.substring(0, cursorOffset)

                    // Check if it's empty or only zero-width spaces

                    const visibleTextBefore = textBeforeCursor.replace(/\u200B/g, '')

                    

                    // If no visible text before cursor in this node, check previous sibling

                    if (visibleTextBefore.length === 0) {

                        let prev: Node | null = textNode.previousSibling

                        

                        // Skip only empty text nodes and zero-width spaces

                        // Stop if we encounter a BR (line break) or any other element

                        while (prev && prev.nodeType === Node.TEXT_NODE) {

                            const prevText = prev as Text

                            const content = prevText.textContent || ''

                            // Only skip if completely empty or only zero-width spaces

                            if (content.length === 0 || content.replace(/\u200B/g, '').length === 0) {

                                prev = prev.previousSibling

                            } else {

                                // Has actual content, chip is not adjacent

                                prev = null

                                break

                            }

                        }

                        

                        // If no previous sibling found and we're in a child element (like a div),

                        // check the previous sibling of the parent element

                        if (!prev && textNode.parentElement && textNode.parentElement !== editor) {

                            let parentPrev: Node | null = textNode.parentElement.previousSibling

                            // Skip empty text nodes

                            while (parentPrev && parentPrev.nodeType === Node.TEXT_NODE) {

                                const content = parentPrev.textContent || ''

                                if (content.length === 0 || content.replace(/\u200B/g, '').length === 0) {

                                    parentPrev = parentPrev.previousSibling

                                } else {

                                    parentPrev = null

                                    break

                                }

                            }

                            if (parentPrev && parentPrev.nodeType === Node.ELEMENT_NODE) {

                                const parentPrevEl = parentPrev as HTMLElement

                                if (isSegmentElement(parentPrevEl)) {
                                    adjacentElement = parentPrevEl
                                }
                                // If it's a BR or other element, let default behavior handle it

                            }

                        }

                        // Check if prev is a BR or other non-math element

                        else if (prev && prev.nodeType === Node.ELEMENT_NODE) {

                            const el = prev as HTMLElement

                            // If it's a BR or any element that's not a math chip, don't treat as adjacent

                            if (el.tagName === 'BR' || !isSegmentElement(el)) {
                                prev = null
                            } else if (isSegmentElement(el)) {
                                adjacentElement = el
                            }
                        }

                    }

                }

                

                // For Delete: check if the text AFTER the cursor is empty or only invisible chars

                else if (e.key === 'Delete') {

                    // Get text after cursor in this node

                    const textAfterCursor = fullText.substring(cursorOffset)

                    // Check if it's empty or only zero-width spaces

                    const visibleTextAfter = textAfterCursor.replace(/\u200B/g, '')

                    

                    // If no visible text after cursor in this node, check next sibling

                    if (visibleTextAfter.length === 0) {

                        let next = textNode.nextSibling

                        

                        // Skip only empty text nodes and zero-width spaces

                        // Stop if we encounter a BR (line break) or any other element

                        while (next && next.nodeType === Node.TEXT_NODE) {

                            const nextText = next as Text

                            const content = nextText.textContent || ''

                            // Only skip if completely empty or only zero-width spaces

                            if (content.length === 0 || content.replace(/\u200B/g, '').length === 0) {

                                next = next.nextSibling

                            } else {

                                // Has actual content, chip is not adjacent

                                next = null

                                break

                            }

                        }

                        

                        // Check if next is a BR or other non-segment element
                        if (next && next.nodeType === Node.ELEMENT_NODE) {
                            const el = next as HTMLElement
                            if (el.tagName === 'BR') {
                                const nextSegment = findNextSegmentSkippingBreaks(el.nextSibling)
                                if (nextSegment) {
                                    adjacentElement = nextSegment
                                } else {
                                    next = null
                                }
                            } else if (!isSegmentElement(el)) {
                                next = null
                            } else {
                                adjacentElement = el
                            }
                        }
                    }
                }
            }

            // If cursor is directly in the editor or another element

            else if (cursorContainer.nodeType === Node.ELEMENT_NODE) {

                const el = cursorContainer as HTMLElement

                

                // For Backspace: check if previous child is a math chip

                if (e.key === 'Backspace') {

                    if (cursorOffset > 0) {

                        let prevIndex = cursorOffset - 1

                        let prevChild: ChildNode | null = el.childNodes[prevIndex] || null

                        

                        // Skip empty text nodes and zero-width spaces

                        // Stop if we encounter a BR or other elements

                        while (prevChild && prevChild.nodeType === Node.TEXT_NODE) {

                            const content = prevChild.textContent || ''

                            if (content.length === 0 || content.replace(/\u200B/g, '').length === 0) {

                                prevIndex--

                                prevChild = prevIndex >= 0 ? el.childNodes[prevIndex] : null

                            } else {

                                // Has actual content, chip is not adjacent

                                prevChild = null

                                break

                            }

                        }

                        

                        if (prevChild && prevChild.nodeType === Node.ELEMENT_NODE) {

                            const prevEl = prevChild as HTMLElement

                            // Only treat as adjacent if it's a math chip, not a BR or other element

                            if (isSegmentElement(prevEl)) {
                                adjacentElement = prevEl
                            }
                            // If it's a BR or other element, let default behavior handle it

                        }

                    }

                    // If cursor is at the beginning of a child element (like a div created by Enter),

                    // check if the previous sibling of that element ends with a math chip

                    else if (cursorOffset === 0 && el !== editor) {

                        // Find the last element before this block that could be a math chip

                        let prevSibling = el.previousSibling

                        

                        // Skip empty text nodes

                        while (prevSibling && prevSibling.nodeType === Node.TEXT_NODE) {

                            const content = prevSibling.textContent || ''

                            if (content.length === 0 || content.replace(/\u200B/g, '').length === 0) {

                                prevSibling = prevSibling.previousSibling

                            } else {

                                // Has content, not directly adjacent to potential math chip

                                prevSibling = null

                                break

                            }

                        }

                        

                        if (prevSibling && prevSibling.nodeType === Node.ELEMENT_NODE) {

                            const prevEl = prevSibling as HTMLElement

                            if (isSegmentElement(prevEl)) {
                                adjacentElement = prevEl
                            }
                            // If it's a BR, DIV, or other element, let default behavior handle it

                        }

                    }

                }

                

                // For Delete: check if next child is a math chip

                else if (e.key === 'Delete' && cursorOffset < el.childNodes.length) {

                    let nextIndex = cursorOffset

                    let nextChild: ChildNode | null = el.childNodes[nextIndex] || null

                    

                    // Skip empty text nodes and zero-width spaces

                    // Stop if we encounter a BR or other elements

                    while (nextChild && nextChild.nodeType === Node.TEXT_NODE) {

                        const content = nextChild.textContent || ''

                        if (content.length === 0 || content.replace(/\u200B/g, '').length === 0) {

                            nextIndex++

                            nextChild = nextIndex < el.childNodes.length ? el.childNodes[nextIndex] : null

                        } else {

                            // Has actual content, chip is not adjacent

                            nextChild = null

                            break

                        }

                    }

                    

                    if (nextChild && nextChild.nodeType === Node.ELEMENT_NODE) {
                        const nextEl = nextChild as HTMLElement
                        // Only treat as adjacent if it's a segment element, not a BR or other element
                        if (nextEl.tagName === 'BR') {
                            const nextSegment = findNextSegmentSkippingBreaks(nextEl.nextSibling)
                            if (nextSegment) {
                                adjacentElement = nextSegment
                            }
                        } else if (isSegmentElement(nextEl)) {
                            adjacentElement = nextEl
                        }
                        // If it's a BR or other element, let default behavior handle it
                    }
                }
            }


            if (adjacentElement) {
                const segmentId = getSegmentId(adjacentElement)
                if (segmentId) {
                    e.preventDefault()
                    e.stopPropagation()

                    // If this chip is already pending deletion, confirm deletion
                    if (pendingDeletionId === segmentId) {
                        adjacentElement.remove()
                        setPendingDeletionId(null)
                        handleInput()
                    } else {
                        // Cancel any other pending deletion
                        if (pendingDeletionId) {
                            setPendingDeletionId(null)
                        }
                        // Mark this chip as pending deletion
                        setPendingDeletionId(segmentId)
                    }
                    return
                }
            }


            // If there's a pending deletion but we're not deleting that chip, cancel it

            if (pendingDeletionId) {

                setPendingDeletionId(null)

            }

        } else {
            // Any other key press cancels pending deletion
            if (pendingDeletionId) {
                setPendingDeletionId(null)
            }
        }
    }, [pendingDeletionId, handleInput])


    const rightPaddingClass = toolbarRightSlot
        ? 'group-hover/insert:pr-28 group-focus-within/insert:pr-28'
        : 'group-hover/insert:pr-24 group-focus-within/insert:pr-24'

    return (

        <div className={`space-y-2 group/insert ${className}`}>

            {/* Math Toolbar - positioned above editor by default (legacy, hidden by default) */}
            {shouldShowMathToolbar && toolbarPosition === 'top' && (
                <MathToolbar
                    onInsert={handleToolbarInsert}
                    disabled={disabled}
                    locale={isFrench ? 'fr' : 'en'}
                    size={toolbarSize}
                />
            )}

            {/* Hover Math Button - shows symbols on hover */}
            {showMathButton && !shouldShowMathToolbar && (
                <HoverMathButton
                    isFrench={isFrench}
                    disabled={disabled}
                    onInsertSymbol={handleToolbarInsert}
                    onInsertMathChip={insertMathChip}
                />
            )}

            {/* Editor container */}
            <div className="relative">
                <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 pointer-events-none transition-opacity group-hover/insert:opacity-100 group-hover/insert:pointer-events-auto group-focus-within/insert:opacity-100 group-focus-within/insert:pointer-events-auto">
                    {toolbarRightSlot}
                    <InsertMenu
                        isFrench={isFrench}
                        disabled={disabled}
                        compactToolbar={compactToolbar}
                        toolbarSize={toolbarSize}
                        showMathButton={false}
                        showTableButton={showTableButton}
                        showGraphButton={showGraphButton}
                        onInsertMath={insertMathChip}
                        onInsertTable={insertTable}
                        onInsertGraph={insertGraph}
                    />
                </div>
                <div
                    className="relative rounded-md border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-brand-900 focus-within:border-brand-900 overflow-x-auto"
                    style={{ minHeight: minRows === 1 ? '2.5rem' : `${minRows * 1.5}rem` }}
                >
                {/* Placeholder overlay */}

                {isEmpty && placeholder && (

                    <div className={`absolute inset-0 px-3 py-2 pr-3 text-sm text-gray-400 italic pointer-events-none leading-relaxed transition-[padding] ${rightPaddingClass}`}>

                        {placeholder}

                    </div>

                )}

                

                {/* contentEditable editor */}

                <div

                    ref={editorRef}

                    contentEditable={!disabled}

                    suppressContentEditableWarning

                    onInput={handleInput}

                    onBlur={handleBlur}

                    onClick={handleEditorClick}

                    onPaste={handlePaste}

                    onKeyDown={handleKeyDown}

                    className={`relative block w-full min-h-[inherit] px-3 py-2 pr-3 text-sm text-gray-900 resize-none outline-none leading-relaxed whitespace-pre-wrap break-words transition-[padding] ${rightPaddingClass}`}

                    style={{

                        minHeight: minRows === 1 ? '2.5rem' : `${minRows * 1.5}rem`,

                    }}

                />
                </div>
            </div>



            {/* Inline Math Editor Popup (live draft) */}
            {editingMathId && (
                <InlineMathEditor
                    value={draftLatexById[editingMathId] ?? ''}
                    onChangeDraft={handleChangeDraft}
                    onConfirm={handleSaveMath}
                    onCancel={handleCancelMath}
                    onDelete={handleDeleteMath}
                    anchorRef={editingChipRef}
                    locale={locale}
                    onMathFieldReady={(mf) => { activeMathFieldRef.current = mf }}
                />
            )}

            {/* Inline Table Editor Popup */}
            {editingTableId && (
                <InlineTableEditor
                    value={draftTableById[editingTableId] ?? normalizeTablePayload()}
                    onChangeDraft={handleChangeTableDraft}
                    onConfirm={handleSaveTable}
                    onCancel={handleCancelTable}
                    onDelete={handleDeleteTable}
                    anchorRef={editingTableRef}
                    initialFocusCell={tableFocusCell}
                    locale={locale}
                />
            )}

            {editingGraphId && (
                <InlineGraphEditor
                    value={draftGraphById[editingGraphId] ?? createDefaultGraphPayload()}
                    onChangeDraft={handleChangeGraphDraft}
                    onConfirm={handleSaveGraph}
                    onCancel={handleCancelGraph}
                    onDelete={handleDeleteGraph}
                    anchorRef={editingGraphRef}
                    locale={locale}
                />
            )}

            {/* Math Toolbar - positioned below editor if toolbarPosition is 'bottom' */}
            {shouldShowMathToolbar && toolbarPosition === 'bottom' && (
                <MathToolbar
                    onInsert={handleToolbarInsert}
                    disabled={disabled}
                    locale={isFrench ? 'fr' : 'en'}
                    size={toolbarSize}
                />
            )}
        </div>
    )
}

















