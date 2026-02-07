'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { GraphPayload, EditorMode } from './types'
import { GraphEditorWrapper } from './GraphEditorWrapper'

interface GraphEditorPopupProps {
    value: GraphPayload
    onChangeDraft: (payload: GraphPayload) => void
    onConfirm: () => void
    onCancel: () => void
    onDelete: () => void
    anchorRef: React.RefObject<HTMLDivElement | null>
    locale?: string
    initialMode?: EditorMode
}

/**
 * GraphEditorPopup wraps GraphEditorWrapper in a positioned popup overlay.
 * Handles positioning relative to anchor element and click-outside detection.
 */
export function GraphEditorPopup({
    value,
    onChangeDraft,
    onConfirm,
    onCancel,
    onDelete,
    anchorRef,
    locale = 'fr',
    initialMode = 'simple',
}: GraphEditorPopupProps) {
    const editorRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState({ top: 0, left: 0 })

    // Position popup relative to anchor element
    useLayoutEffect(() => {
        if (!anchorRef.current || !editorRef.current) return

        const updatePosition = () => {
            const anchorRect = anchorRef.current?.getBoundingClientRect()
            const editorRect = editorRef.current?.getBoundingClientRect()
            if (!anchorRect || !editorRect) return

            const editorWidth = editorRect.width || 896 // w-[56rem] = 896px
            const editorHeight = editorRect.height || 600
            const margin = 8

            let left = anchorRect.left
            let top = anchorRect.bottom + 4

            // Keep popup within viewport horizontally
            if (left + editorWidth > window.innerWidth - margin) {
                left = window.innerWidth - editorWidth - margin
            }
            if (left < margin) left = margin

            // Keep popup within viewport vertically
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

    // Handle click outside to confirm
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

    return (
        <div
            ref={editorRef}
            className="inline-graph-editor-popup fixed z-[9999] w-[56rem] max-h-[85vh]"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
            }}
        >
            <GraphEditorWrapper
                value={value}
                onChange={onChangeDraft}
                onConfirm={onConfirm}
                onCancel={onCancel}
                onDelete={onDelete}
                locale={locale}
                initialMode={initialMode}
            />
        </div>
    )
}
