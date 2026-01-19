'use client'

import { useEffect, useRef } from 'react'
import katex from 'katex'

interface KaTeXRendererProps {
    /** The LaTeX string to render */
    latex: string
    /** Block (true) vs inline (false, default) display mode */
    displayMode?: boolean
    /** Additional CSS classes */
    className?: string
    /** Color for error messages (default: '#cc0000') */
    errorColor?: string
    /** Whether to throw on invalid LaTeX (default: false) */
    throwOnError?: boolean
}

/**
 * Strip MathLive placeholder syntax and replace with empty box
 */
function stripPlaceholders(latex: string): string {
    return latex.replace(/\\placeholder(\{[^}]*\})?/g, '\\square')
}

/**
 * KaTeX configuration options
 */
function getKatexOptions(
    displayMode: boolean,
    throwOnError: boolean,
    errorColor: string
): katex.KatexOptions {
    return {
        displayMode,
        throwOnError,
        errorColor,
        strict: false,
        trust: true,
        output: 'html',
        macros: {},
    }
}

/**
 * React component for rendering LaTeX using KaTeX
 */
export function KaTeXRenderer({
    latex,
    displayMode = false,
    className = '',
    errorColor = '#cc0000',
    throwOnError = false,
}: KaTeXRendererProps) {
    const containerRef = useRef<HTMLSpanElement>(null)

    useEffect(() => {
        if (!containerRef.current) return

        const processedLatex = stripPlaceholders(latex || '')

        try {
            katex.render(processedLatex, containerRef.current, getKatexOptions(displayMode, throwOnError, errorColor))
        } catch (error) {
            if (throwOnError) {
                throw error
            }
            // Graceful degradation: show original LaTeX in error color
            if (containerRef.current) {
                containerRef.current.innerHTML = `<span style="color: ${errorColor}">${latex || ''}</span>`
            }
        }
    }, [latex, displayMode, throwOnError, errorColor])

    return (
        <span
            ref={containerRef}
            className={className}
            style={{ display: displayMode ? 'block' : 'inline' }}
        />
    )
}

/**
 * Render LaTeX to HTML string (for server-side or PDF export)
 * @param latex - The LaTeX string to render
 * @param displayMode - Block (true) vs inline (false, default)
 * @returns HTML string of rendered math
 */
export function renderLatexToString(latex: string, displayMode: boolean = false): string {
    const processedLatex = stripPlaceholders(latex || '')

    try {
        return katex.renderToString(processedLatex, {
            displayMode,
            throwOnError: false,
            strict: false,
            trust: true,
            output: 'html',
            macros: {},
        })
    } catch {
        // Return original latex wrapped in error span
        return `<span style="color: #cc0000">${latex || ''}</span>`
    }
}

export default KaTeXRenderer
