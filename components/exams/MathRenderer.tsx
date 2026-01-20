'use client'

import { useMemo, Fragment } from 'react'
import { legacyMathHtmlToLatex } from '@/lib/math/legacy'
import { parseContent } from '@/lib/content'
import { ContentSegment } from '@/types/exams'
import { renderGraphInto } from './graph-utils'
import { KaTeXRenderer, renderLatexToString } from './KaTeXRenderer'

const maxExamSheetWidth = 820

/**
 * Check if LaTeX contains big operators that need display mode for proper limits
 */
function needsDisplayMode(latex: string): boolean {
    return /\\(sum|prod|coprod|bigcup|bigcap|bigsqcup|bigvee|bigwedge|bigodot|bigotimes|bigoplus|biguplus|lim)(?![A-Za-z])/.test(latex)
}

/**
 * Trim trailing empty text segments after tables/graphs
 */
function trimTrailingEmptyTextAfterTable(value: ContentSegment[]): ContentSegment[] {
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

/**
 * Trim leading empty text segments before tables/graphs
 */
function trimLeadingEmptyTextBeforeTable(value: ContentSegment[]): ContentSegment[] {
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

interface MathRendererProps {
    text: string | ContentSegment[]
    className?: string
    tableScale?: number | 'fit'
}

/**
 * Render a math segment using KaTeX
 */
function MathSegment({ latex, scale }: { latex: string; scale: number }) {
    const displayMode = needsDisplayMode(latex)

    return (
        <span
            className={`math-inline ${displayMode ? 'math-inline-display' : ''}`}
            style={scale !== 1 ? { fontSize: `${scale}em` } : undefined}
        >
            <KaTeXRenderer latex={latex} displayMode={displayMode} />
        </span>
    )
}

/**
 * Render a table segment with cells containing math
 */
function TableSegment({
    segment,
    scale,
    availableWidth,
}: {
    segment: ContentSegment & { type: 'table' }
    scale: number
    availableWidth: number
}) {
    let colWidths = segment.colWidths ?? []
    if (colWidths.length > 0) {
        const totalWidth = colWidths.reduce((sum, width) => sum + (Number(width) || 0), 0)
        if (totalWidth > maxExamSheetWidth) {
            const scaleDown = maxExamSheetWidth / totalWidth
            colWidths = colWidths.map((width) => Math.max(24, (Number(width) || 0) * scaleDown))
        }
    }

    return (
        <div className="table-preview" style={{ display: 'inline-block' }}>
            <table
                className="my-2"
                style={{
                    borderCollapse: 'collapse',
                    width: '100%',
                    tableLayout: 'fixed',
                    fontSize: scale !== 1 ? `${scale}em` : undefined,
                }}
            >
                {colWidths.length > 0 && (
                    <colgroup>
                        {colWidths.map((width, i) => {
                            const scaled = Math.max(24 * scale, (Number(width) || 0) * scale)
                            return <col key={i} style={{ width: `${scaled}px` }} />
                        })}
                    </colgroup>
                )}
                <tbody>
                    {segment.rows.map((row, rowIndex) => {
                        const rowHeight = segment.rowHeights?.[rowIndex]
                        const scaledHeight = rowHeight ? Math.max(24 * scale, (Number(rowHeight) || 0) * scale) : undefined

                        return (
                            <tr key={rowIndex} style={scaledHeight ? { height: `${scaledHeight}px` } : undefined}>
                                {row.map((cell, cellIndex) => (
                                    <td
                                        key={cellIndex}
                                        style={{
                                            border: '1px solid #e5e7eb',
                                            padding: '6px',
                                            verticalAlign: 'top',
                                            whiteSpace: 'pre-wrap',
                                        }}
                                    >
                                        <SegmentList segments={cell} scale={scale} availableWidth={availableWidth} />
                                    </td>
                                ))}
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

/**
 * Render a graph segment
 */
function GraphSegment({
    segment,
    scale,
    availableWidth,
}: {
    segment: ContentSegment & { type: 'graph' }
    scale: number
    availableWidth: number
}) {
    const containerRef = useMemo(() => {
        // Create a temporary container for the graph
        const container = document.createElement('div')
        container.style.display = 'block'
        container.style.margin = '8px 0'
        container.style.width = 'max-content'
        container.style.maxWidth = '100%'
        renderGraphInto(container, segment, { maxWidth: availableWidth, scale })
        return container.innerHTML
    }, [segment, scale, availableWidth])

    return (
        <div
            style={{
                display: 'block',
                margin: '8px 0',
                width: 'max-content',
                maxWidth: '100%',
            }}
            dangerouslySetInnerHTML={{ __html: containerRef }}
        />
    )
}

/**
 * Render a list of content segments
 */
function SegmentList({
    segments,
    scale,
    availableWidth,
}: {
    segments: ContentSegment[]
    scale: number
    availableWidth: number
}) {
    return (
        <>
            {segments.map((segment, index) => {
                if (segment.type === 'text') {
                    return <Fragment key={segment.id || index}>{segment.text}</Fragment>
                }
                if (segment.type === 'math') {
                    return <MathSegment key={segment.id || index} latex={segment.latex} scale={scale} />
                }
                if (segment.type === 'graph') {
                    return (
                        <GraphSegment
                            key={segment.id || index}
                            segment={segment}
                            scale={scale}
                            availableWidth={availableWidth}
                        />
                    )
                }
                if (segment.type === 'table') {
                    return (
                        <TableSegment
                            key={segment.id || index}
                            segment={segment}
                            scale={scale}
                            availableWidth={availableWidth}
                        />
                    )
                }
                return null
            })}
        </>
    )
}

/**
 * Parse a string with $...$ delimiters into segments
 */
function parseStringWithMath(text: string): Array<{ type: 'text' | 'math'; content: string }> {
    const result: Array<{ type: 'text' | 'math'; content: string }> = []
    const regex = /\$([^$]+)\$/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            result.push({ type: 'text', content: text.substring(lastIndex, match.index) })
        }
        result.push({ type: 'math', content: match[1] })
        lastIndex = regex.lastIndex
    }

    if (lastIndex < text.length) {
        result.push({ type: 'text', content: text.substring(lastIndex) })
    }

    return result
}

/**
 * MathRenderer - Renders math content using KaTeX
 *
 * Supports:
 * - ContentSegment[] (structured content with text, math, tables, graphs)
 * - JSON-encoded ContentSegment[] string
 * - Legacy HTML strings (converted via legacyMathHtmlToLatex)
 * - Plain strings with $...$ delimiters
 */
export default function MathRenderer({ text, className = '', tableScale = 1 }: MathRendererProps) {
    // Parse segments from string if needed
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

    const segments = useMemo(
        () => (Array.isArray(text) ? text : segmentsFromString),
        [text, segmentsFromString]
    )

    // Normalize legacy string content
    const normalized = useMemo(() => {
        if (!text || segments || typeof text !== 'string') return ''
        if (text.includes('<span') || text.includes('data-structure')) {
            return legacyMathHtmlToLatex(text)
        }
        return text
    }, [text, segments])

    // Calculate scale
    const availableWidth = maxExamSheetWidth
    const baseScale =
        typeof tableScale === 'number' && Number.isFinite(tableScale) ? Math.max(0.25, tableScale) : null
    const fitScale = tableScale === 'fit' ? Math.min(1, availableWidth / maxExamSheetWidth) : 1
    const inlineScale = baseScale ?? Math.max(1, fitScale) * 1.15

    // Early return if no content
    if (!normalized && (!segments || segments.length === 0)) return null

    // Render segments if available
    if (segments) {
        const trimmedSegments = trimTrailingEmptyTextAfterTable(trimLeadingEmptyTextBeforeTable(segments))

        return (
            <div className={`whitespace-pre-wrap ${className}`} style={{ minHeight: '1.5rem' }}>
                <SegmentList segments={trimmedSegments} scale={inlineScale} availableWidth={availableWidth} />
            </div>
        )
    }

    // Render legacy string with $...$ delimiters
    const parsedParts = parseStringWithMath(normalized)

    return (
        <div className={`whitespace-pre-wrap ${className}`} style={{ minHeight: '1.5rem' }}>
            {parsedParts.map((part, index) => {
                if (part.type === 'text') {
                    return <Fragment key={index}>{part.content}</Fragment>
                }
                return <MathSegment key={index} latex={part.content} scale={inlineScale} />
            })}
        </div>
    )
}

// Re-export renderLatexToString for use in other modules (e.g., PDF export)
export { renderLatexToString }
