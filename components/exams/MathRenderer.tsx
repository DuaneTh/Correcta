'use client'

import { useEffect, useMemo, useRef } from 'react'
import { legacyMathHtmlToLatex } from '@/lib/math/legacy'
import { parseContent } from '@/lib/content'
import { ContentSegment } from '@/types/exams'
import { renderGraphInto } from './graph-utils'

type MathJaxObject = {
    startup?: { ready?: boolean }
    typesetPromise?: (nodes?: Element[]) => Promise<void>
    typeset?: (nodes?: Element[]) => void
    tex2chtml?: (tex: string, options?: { display?: boolean }) => HTMLElement
    tex2chtmlPromise?: (tex: string, options?: { display?: boolean }) => Promise<HTMLElement>
    tex?: {
        inlineMath: string[][]
        displayMath: string[][]
    }
}

type MathJaxWindow = Window & { MathJax?: MathJaxObject }
const maxExamSheetWidth = 820
const bigOperatorRegex = /\\(sum|prod|coprod|bigcup|bigcap|bigsqcup|bigvee|bigwedge|bigodot|bigotimes|bigoplus|biguplus|lim)(?![A-Za-z])/

const formatLatexForMathJax = (latex: string) => {
    const withPlaceholders = latex.replace(/\\placeholder(\{[^}]*\})?/g, '\\boxed{\\quad}')
    const withLimits = withPlaceholders.replace(
        /(\\(sum|prod|coprod|bigcup|bigcap|bigsqcup|bigvee|bigwedge|bigodot|bigotimes|bigoplus|biguplus|lim))(?![A-Za-z])(?!\s*\\limits|\s*\\nolimits)/g,
        (match, _op, _name, offset: number) => {
            const prefix = withPlaceholders.slice(0, offset)
            const hasDisplayStyle = /\\displaystyle\s*$/.test(prefix)
            const displayPrefix = hasDisplayStyle ? '' : '\\displaystyle'
            return `${displayPrefix}${match}\\limits`
        }
    )
    const needsDisplay = bigOperatorRegex.test(withLimits)
    const text = needsDisplay ? `$$${withLimits}$$` : `$${withLimits}$`
    return { text, needsDisplay }
}

const stripMathDelimiters = (value: string) => {
    const trimmed = value.trim()
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
        return trimmed.slice(2, -2).trim()
    }
    if (trimmed.startsWith('$') && trimmed.endsWith('$')) {
        return trimmed.slice(1, -1).trim()
    }
    if (trimmed.startsWith('\\[') && trimmed.endsWith('\\]')) {
        return trimmed.slice(2, -2).trim()
    }
    if (trimmed.startsWith('\\(') && trimmed.endsWith('\\)')) {
        return trimmed.slice(2, -2).trim()
    }
    return trimmed
}

interface MathRendererProps {
    text: string | ContentSegment[]
    className?: string
    tableScale?: number | 'fit'
}

export default function MathRenderer({ text, className = '', tableScale = 1 }: MathRendererProps) {
    const segmentsFromString = useMemo(() => {
        if (Array.isArray(text) || !text) return null
        try {
            const parsed = JSON.parse(text)
            if (Array.isArray(parsed)) {
                return parseContent(parsed)
            }
        } catch {
            // Not JSON; treat as legacy string
        }
        return null
    }, [text])
    const segments = useMemo(() => (Array.isArray(text) ? text : segmentsFromString), [text, segmentsFromString])
    const normalized = useMemo(() => {
        if (!text || segments || typeof text !== 'string') return ''
        if (text.includes('<span') || text.includes('data-structure')) {
            return legacyMathHtmlToLatex(text)
        }
        return text
    }, [text, segments])
    const containerRef = useRef<HTMLDivElement>(null)
    const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const isRenderingRef = useRef(false)

    useEffect(() => {
        const mathWindow = typeof window !== 'undefined' ? (window as MathJaxWindow) : undefined
        if ((!normalized && (!segments || segments.length === 0)) || !mathWindow) {
            if (containerRef.current) {
                containerRef.current.innerHTML = ''
            }
            return
        }

        if (renderTimeoutRef.current) {
            clearTimeout(renderTimeoutRef.current)
        }
        if (isRenderingRef.current) return

        const ensureMathJax = (): Promise<void> => {
            const mathJax = mathWindow.MathJax
            if (mathJax?.startup?.ready || mathJax?.typesetPromise) {
                return Promise.resolve()
            }

            return new Promise<void>((resolve) => {
                if (!mathWindow.MathJax) {
                    mathWindow.MathJax = {
                        tex: {
                            inlineMath: [['$', '$']],
                            displayMath: [['$$', '$$']],
                        },
                    }
                }

                let mathJaxScript = document.getElementById('MathJax-script') as HTMLScriptElement | null
                if (!mathJaxScript) {
                    mathJaxScript = document.createElement('script')
                    mathJaxScript.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js'
                    mathJaxScript.async = true
                    mathJaxScript.id = 'MathJax-script'
                    document.head.appendChild(mathJaxScript)
                }

                let attempts = 0
                const maxAttempts = 50
                const checkReady = setInterval(() => {
                    attempts++
                    const ready = mathWindow.MathJax?.startup?.ready || mathWindow.MathJax?.typesetPromise
                    if (ready || attempts >= maxAttempts) {
                        clearInterval(checkReady)
                        resolve()
                    }
                }, 100)
            })
        }

        const renderMath = async () => {
            isRenderingRef.current = true
            try {
                await ensureMathJax()
                if (!containerRef.current) {
                    isRenderingRef.current = false
                    return
                }

                const parts: (string | HTMLElement)[] = []

                const availableWidth = containerRef.current?.getBoundingClientRect().width ?? maxExamSheetWidth
                const baseScale = typeof tableScale === 'number' && Number.isFinite(tableScale)
                    ? Math.max(0.25, tableScale)
                    : null
                const fitScale = tableScale === 'fit'
                    ? Math.min(1, availableWidth / maxExamSheetWidth)
                    : 1
                const inlineScale = baseScale ?? Math.max(1, fitScale) * 1.15
                const appendSegments = (value: ContentSegment[], container: HTMLElement) => {
                    value.forEach((segment) => {
                        if (segment.type === 'text') {
                            container.appendChild(document.createTextNode(segment.text))
                            return
                        }
                        if (segment.type === 'math') {
                            const span = document.createElement('span')
                            span.className = 'math-inline'
                            const formatted = formatLatexForMathJax(segment.latex)
                            if (formatted.needsDisplay) {
                                span.classList.add('math-inline-display')
                            }
                            if (inlineScale !== 1) {
                                span.style.fontSize = `${inlineScale}em`
                            }
                            span.textContent = formatted.text
                            container.appendChild(span)
                            return
                        }
                        if (segment.type === 'graph') {
                            const graphWrapper = document.createElement('div')
                            graphWrapper.style.display = 'block'
                            graphWrapper.style.margin = '8px 0'
                            graphWrapper.style.width = 'max-content'
                            graphWrapper.style.maxWidth = '100%'
                            const scale = baseScale ?? 1
                            renderGraphInto(graphWrapper, segment, { maxWidth: availableWidth, scale })
                            container.appendChild(graphWrapper)
                            return
                        }

                        let colWidths = segment.colWidths ?? []
                        if (colWidths.length > 0) {
                            const totalWidth = colWidths.reduce((sum, width) => sum + (Number(width) || 0), 0)
                            if (totalWidth > maxExamSheetWidth) {
                                const scale = maxExamSheetWidth / totalWidth
                                colWidths = colWidths.map((width) => Math.max(24, (Number(width) || 0) * scale))
                            }
                        }

                        const scale = baseScale ?? fitScale

                        const tableWrapper = document.createElement('div')
                        tableWrapper.style.display = 'inline-block'

                        const table = document.createElement('table')
                        table.style.borderCollapse = 'collapse'
                        table.style.width = '100%'
                        table.style.tableLayout = 'fixed'
                        table.className = 'my-2'
                        if (scale !== 1) {
                            table.style.fontSize = `${scale}em`
                        }
                        if (colWidths.length > 0) {
                            const colgroup = document.createElement('colgroup')
                            colWidths.forEach((width) => {
                                const col = document.createElement('col')
                                const scaled = Math.max(24 * scale, (Number(width) || 0) * scale)
                                col.style.width = `${scaled}px`
                                colgroup.appendChild(col)
                            })
                            table.appendChild(colgroup)
                        }

                        const tbody = document.createElement('tbody')
                        segment.rows.forEach((row, rowIndex) => {
                            const tr = document.createElement('tr')
                            if (segment.rowHeights?.[rowIndex]) {
                                const scaledHeight = Math.max(24 * scale, (Number(segment.rowHeights[rowIndex]) || 0) * scale)
                                tr.style.height = `${scaledHeight}px`
                            }
                            row.forEach((cell) => {
                                const td = document.createElement('td')
                                td.style.border = '1px solid #e5e7eb'
                                td.style.padding = '6px'
                                td.style.verticalAlign = 'top'
                                td.style.whiteSpace = 'pre-wrap'
                                appendSegments(cell, td)
                                tr.appendChild(td)
                            })
                            tbody.appendChild(tr)
                        })
                        table.appendChild(tbody)
                        tableWrapper.appendChild(table)
                        container.appendChild(tableWrapper)
                    })
                }

                const trimTrailingEmptyTextAfterTable = (value: ContentSegment[]) => {
                    let end = value.length
                    while (end > 0) {
                        const seg = value[end - 1]
                        if (seg.type !== 'text') break
                        const cleaned = seg.text?.replace(/\u200B/g, '') ?? ''
                        if (cleaned.trim().length > 0) break
                        end -= 1
                    }

                    if (end < value.length && end > 0 && (value[end - 1].type === 'table' || value[end - 1].type === 'graph')) {
                        return value.slice(0, end)
                    }

                    return value
                }

                const trimLeadingEmptyTextBeforeTable = (value: ContentSegment[]) => {
                    let start = 0
                    while (start < value.length) {
                        const seg = value[start]
                        if (seg.type !== 'text') break
                        const cleaned = seg.text?.replace(/\u200B/g, '') ?? ''
                        if (cleaned.trim().length > 0) break
                        start += 1
                    }

                    if (start > 0 && start < value.length && (value[start].type === 'table' || value[start].type === 'graph')) {
                        return value.slice(start)
                    }

                    return value
                }

                if (segments) {
                    const container = document.createElement('div')
                    container.style.whiteSpace = 'pre-wrap'
                    appendSegments(trimTrailingEmptyTextAfterTable(trimLeadingEmptyTextBeforeTable(segments)), container)
                    parts.push(container)
                } else {
                    const regex = /\$([^$]+)\$/g
                    let lastIndex = 0
                    let match: RegExpExecArray | null

                    while ((match = regex.exec(normalized)) !== null) {
                        if (match.index > lastIndex) {
                            parts.push(normalized.substring(lastIndex, match.index))
                        }
                        const span = document.createElement('span')
                        span.className = 'math-inline'
                        const formatted = formatLatexForMathJax(match[1])
                        if (formatted.needsDisplay) {
                            span.classList.add('math-inline-display')
                        }
                        span.textContent = formatted.text
                        parts.push(span)
                        lastIndex = regex.lastIndex
                    }

                    if (lastIndex < normalized.length) {
                        parts.push(normalized.substring(lastIndex))
                    }
                }

                if (containerRef.current) {
                    containerRef.current.innerHTML = ''
                    parts.forEach((part) => {
                        if (typeof part === 'string') {
                            containerRef.current?.appendChild(document.createTextNode(part))
                        } else {
                            containerRef.current?.appendChild(part)
                        }
                    })
                }

                if (containerRef.current && (mathWindow.MathJax?.tex2chtml || mathWindow.MathJax?.tex2chtmlPromise)) {
                    const displayNodes = Array.from(containerRef.current.querySelectorAll('.math-inline-display'))
                    displayNodes.forEach(async (node) => {
                        const el = node as HTMLElement
                        const rawLatex = el.textContent || ''
                        const latex = stripMathDelimiters(rawLatex)
                        if (!latex) return
                        try {
                            const rendered = mathWindow.MathJax!.tex2chtmlPromise
                                ? await mathWindow.MathJax!.tex2chtmlPromise(latex, { display: true })
                                : mathWindow.MathJax!.tex2chtml!(latex, { display: true })
                            el.innerHTML = ''
                            el.appendChild(rendered)
                        } catch (error) {
                            console.error('MathJax display render error:', error)
                        }
                    })
                }

                if (renderTimeoutRef.current) {
                    clearTimeout(renderTimeoutRef.current)
                }

                renderTimeoutRef.current = setTimeout(() => {
                    if (!containerRef.current) {
                        isRenderingRef.current = false
                        return
                    }
                    const mathJax = mathWindow.MathJax
                    try {
                        if (mathJax?.typesetPromise) {
                            mathJax.typesetPromise([containerRef.current]).finally(() => {
                                isRenderingRef.current = false
                            })
                        } else if (mathJax?.typeset) {
                            mathJax.typeset([containerRef.current])
                            isRenderingRef.current = false
                        } else {
                            isRenderingRef.current = false
                        }
                    } catch (error) {
                        console.error('MathJax typeset error:', error)
                        isRenderingRef.current = false
                    }
                }, 300)
            } catch (error) {
                console.error('Math render error:', error)
                isRenderingRef.current = false
            }
        }

        renderMath()

        return () => {
            if (renderTimeoutRef.current) {
                clearTimeout(renderTimeoutRef.current)
            }
            isRenderingRef.current = false
        }
    }, [normalized, segments, tableScale])

    if (!normalized && (!segments || segments.length === 0)) return null

    return (
        <div
            ref={containerRef}
            className={`whitespace-pre-wrap ${className}`}
            style={{ minHeight: '1.5rem' }}
        />
    )
}
