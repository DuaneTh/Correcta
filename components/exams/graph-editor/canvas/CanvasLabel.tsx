'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Image as KonvaImage, Text as KonvaText, Group } from 'react-konva'

interface CanvasLabelProps {
    x: number                // Position pixel X
    y: number                // Position pixel Y
    label: string
    isMath?: boolean
    fontSize?: number
    color?: string
    offsetX?: number         // Pixel offset from position
    offsetY?: number
    listening?: boolean
}

// Cache for rendered KaTeX images to avoid re-rendering
const katexImageCache = new Map<string, HTMLImageElement>()

/**
 * Renders a label on the Konva canvas.
 * For math labels, converts KaTeX-rendered HTML to an image.
 * For regular labels, uses KonvaText.
 */
export const CanvasLabel = React.memo<CanvasLabelProps>(({
    x,
    y,
    label,
    isMath = false,
    fontSize = 12,
    color = '#111827',
    offsetX = 8,
    offsetY = -8,
    listening = false,
}) => {
    const [image, setImage] = useState<HTMLImageElement | null>(null)
    const isMounted = useRef(true)

    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    useEffect(() => {
        if (!isMath || !label) {
            setImage(null)
            return
        }

        const cacheKey = `${label}-${fontSize}-${color}`
        const cached = katexImageCache.get(cacheKey)
        if (cached) {
            setImage(cached)
            return
        }

        // Dynamically import KaTeX and render
        const renderKatex = async () => {
            try {
                const katex = await import('katex')

                // Create a temporary container
                const container = document.createElement('div')
                container.style.position = 'absolute'
                container.style.left = '-9999px'
                container.style.top = '0'
                container.style.fontSize = `${fontSize}px`
                container.style.color = color
                container.style.background = 'transparent'
                document.body.appendChild(container)

                // Render KaTeX
                katex.default.render(label, container, {
                    throwOnError: false,
                    displayMode: false,
                })

                // Wait for fonts to load
                await document.fonts.ready

                // Use html2canvas or SVG approach to convert to image
                // For simplicity, we'll use a foreignObject SVG approach
                const rect = container.getBoundingClientRect()
                const width = Math.ceil(rect.width) + 4
                const height = Math.ceil(rect.height) + 4

                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
                svg.setAttribute('width', String(width))
                svg.setAttribute('height', String(height))
                svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

                const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject')
                foreignObject.setAttribute('width', String(width))
                foreignObject.setAttribute('height', String(height))
                foreignObject.setAttribute('x', '0')
                foreignObject.setAttribute('y', '0')

                // Clone the container content
                const clone = container.cloneNode(true) as HTMLElement
                clone.style.position = 'static'
                clone.style.left = '0'
                clone.style.margin = '2px'
                foreignObject.appendChild(clone)
                svg.appendChild(foreignObject)

                // Add KaTeX styles inline
                const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
                style.textContent = `
                    .katex { font-size: ${fontSize}px; color: ${color}; }
                    .katex .mord, .katex .mbin, .katex .mrel, .katex .mop, .katex .minner { color: inherit; }
                `
                svg.insertBefore(style, svg.firstChild)

                // Serialize to data URL
                const serializer = new XMLSerializer()
                const svgStr = serializer.serializeToString(svg)
                const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`

                // Load as image
                const img = new Image()
                img.onload = () => {
                    if (isMounted.current) {
                        katexImageCache.set(cacheKey, img)
                        setImage(img)
                    }
                }
                img.onerror = () => {
                    // Fallback: just use text
                    if (isMounted.current) {
                        setImage(null)
                    }
                }
                img.src = dataUrl

                // Cleanup
                document.body.removeChild(container)
            } catch (err) {
                console.error('Failed to render KaTeX label:', err)
                if (isMounted.current) {
                    setImage(null)
                }
            }
        }

        renderKatex()
    }, [label, isMath, fontSize, color])

    if (!label) return null

    // For math labels with rendered image
    if (isMath && image) {
        return (
            <KonvaImage
                x={x + offsetX}
                y={y + offsetY - image.height / 2}
                image={image}
                listening={listening}
            />
        )
    }

    // For non-math labels or fallback
    return (
        <KonvaText
            x={x + offsetX}
            y={y + offsetY}
            text={isMath ? label : label}
            fontSize={fontSize}
            fill={color}
            listening={listening}
        />
    )
})

CanvasLabel.displayName = 'CanvasLabel'

/**
 * Hook to get label position for different element types.
 * Returns pixel coordinates for label placement.
 */
export function useLabelPosition(
    elementType: 'point' | 'line' | 'curve' | 'function' | 'area',
    basePosition: { x: number; y: number },
    customLabelPos?: { x: number; y: number }
): { x: number; y: number } {
    // If custom position is provided, use it
    if (customLabelPos) {
        return customLabelPos
    }

    // Default offsets by element type
    switch (elementType) {
        case 'point':
            return { x: basePosition.x + 8, y: basePosition.y - 8 }
        case 'line':
        case 'curve':
        case 'function':
        case 'area':
            return { x: basePosition.x, y: basePosition.y - 12 }
        default:
            return basePosition
    }
}
