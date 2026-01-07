'use client'

import { useMemo, useCallback, useRef, useEffect } from 'react'
import SegmentedMathField from './SegmentedMathField'
import { parseContent, serializeContent, stringToSegments, segmentsToLatexString } from '@/lib/content'
import { ContentSegment } from '@/types/exams'

/**
 * StringMathField - A wrapper around SegmentedMathField for string-based values.
 * 
 * This component provides the same WYSIWYG math editing experience as SegmentedMathField,
 * but accepts and returns plain strings (with $...$ for math expressions).
 * 
 * Use this for fields that store data as strings rather than ContentSegment arrays,
 * such as correction notes, perfect answer examples, and MCQ options.
 */

interface StringMathFieldProps {
    value: string
    onChange: (value: string) => void
    onBlur?: (currentValue: string) => void
    placeholder?: string
    disabled?: boolean
    className?: string
    minRows?: number
    showMathButton?: boolean
    showTableButton?: boolean
    showGraphButton?: boolean
    toolbarRightSlot?: React.ReactNode
    toolbarSize?: 'sm' | 'md'
    editorSize?: 'sm' | 'md'
    locale?: string
    mathQuickSymbols?: { label: string; latex: string }[]
    tableConfig?: { maxRows?: number | null; maxCols?: number | null; allowMath?: boolean }
    graphConfig?: { allowPoints?: boolean; allowLines?: boolean; allowCurves?: boolean; allowFunctions?: boolean; allowAreas?: boolean; allowText?: boolean }
}

export default function StringMathField({
    value,
    onChange,
    onBlur,
    placeholder,
    disabled,
    className = '',
    minRows = 2,
    showMathButton = true,
    showTableButton = false,
    showGraphButton = showTableButton,
    toolbarRightSlot,
    toolbarSize,
    editorSize,
    locale = 'fr',
    mathQuickSymbols,
    tableConfig,
    graphConfig,
}: StringMathFieldProps) {
    // Keep track of segments to preserve IDs across renders
    const previousSegmentsRef = useRef<ContentSegment[]>([])
    // Keep track of the current string value to pass to onBlur
    const currentValueRef = useRef(value || '')
    
    // Convert string value to segments, reusing previous segment IDs where possible
    const segments = useMemo(() => {
        const raw = value || ''
        let newSegments: ContentSegment[]
        try {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) {
                newSegments = parseContent(parsed)
            } else {
                newSegments = stringToSegments(raw, previousSegmentsRef.current)
            }
        } catch {
            newSegments = stringToSegments(raw, previousSegmentsRef.current)
        }
        previousSegmentsRef.current = newSegments
        return newSegments
    }, [value])

    // Update refs when value/segments change
    useEffect(() => {
        previousSegmentsRef.current = segments
        currentValueRef.current = value || ''
    }, [segments, value])

    // Convert segments back to string on change
    const handleChange = useCallback((newSegments: ContentSegment[]) => {
        previousSegmentsRef.current = newSegments
        const hasStructured = newSegments.some((segment) => segment.type === 'table' || segment.type === 'graph')
        const newValue = hasStructured ? serializeContent(newSegments) : segmentsToLatexString(newSegments)
        currentValueRef.current = newValue
        onChange(newValue)
    }, [onChange])

    // Pass the current value to onBlur so the parent doesn't need to read from stale state
    const handleBlur = useCallback(() => {
        onBlur?.(currentValueRef.current)
    }, [onBlur])

    return (
        <SegmentedMathField
            value={segments}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={className}
            minRows={minRows}
            showMathButton={showMathButton}
            showTableButton={showTableButton}
            showGraphButton={showGraphButton}
            toolbarRightSlot={toolbarRightSlot}
            toolbarSize={toolbarSize}
            editorSize={editorSize}
            locale={locale}
            mathQuickSymbols={mathQuickSymbols}
            tableConfig={tableConfig}
            graphConfig={graphConfig}
        />
    )
}

