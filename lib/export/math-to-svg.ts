/**
 * MathJax server-side LaTeX to SVG conversion + react-pdf transformation
 *
 * Used for PDF export where KaTeX HTML output is not suitable.
 * MathJax produces self-contained SVG, which we parse and convert
 * to react-pdf Svg primitives (Svg, G, Path, Rect, etc.).
 */

import { mathjax } from 'mathjax-full/js/mathjax.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { SVG } from 'mathjax-full/js/output/svg.js'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js'
import { parse as parseSvg, type RootNode, type ElementNode, type TextNode } from 'svg-parser'
import * as React from 'react'
import {
  Svg,
  G,
  Path,
  Rect,
  Line,
  Circle,
  Ellipse,
  Polygon,
  Polyline,
  Text as SvgText,
  Tspan,
  Defs,
  ClipPath,
} from '@react-pdf/renderer'

// Initialize MathJax once (module-level singleton)
const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)

const tex = new TeX({ packages: AllPackages })
const svg = new SVG({ fontCache: 'none' })  // No font cache for standalone SVG
const html = mathjax.document('', { InputJax: tex, OutputJax: svg })

/**
 * Convert LaTeX string to SVG string
 * @param latex - LaTeX expression (without $ delimiters)
 * @param display - true for display mode (centered), false for inline
 * @returns SVG string or error placeholder
 */
export function latexToSvg(latex: string, display: boolean = false): string {
  try {
    if (!latex || latex.trim() === '') {
      return ''
    }

    const node = html.convert(latex, { display })
    const svgString = adaptor.innerHTML(node)

    return svgString
  } catch (error) {
    console.error('[MathJax] Error converting LaTeX:', latex, error)
    // Return placeholder for failed conversion
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20"><text x="5" y="15" fill="red" font-size="12">[Math Error]</text></svg>`
  }
}

/**
 * Parse content string with $...$ math delimiters
 * Returns array of parts with type 'text' or 'math'
 */
export interface ContentPart {
  type: 'text' | 'math'
  content: string
}

export function parseMathContent(content: string): ContentPart[] {
  if (!content) return []

  const parts: ContentPart[] = []
  // Match both $...$ (inline) and $$...$$ (display) - display first to avoid partial matches
  const regex = /\$\$([^$]+)\$\$|\$([^$]+)\$/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index)
      if (text) {
        parts.push({ type: 'text', content: text })
      }
    }

    // Add math part (match[1] is display $$, match[2] is inline $)
    const latex = match[1] ?? match[2] ?? ''
    if (latex) {
      parts.push({ type: 'math', content: latex })
    }

    lastIndex = regex.lastIndex
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex)
    if (text) {
      parts.push({ type: 'text', content: text })
    }
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: content }]
}

/**
 * Extract SVG dimensions from SVG string for react-pdf sizing
 */
export function extractSvgDimensions(svgString: string): { width: number; height: number; viewBox?: string } {
  // MathJax SVGs have width/height in ex units, we need to convert
  const widthMatch = svgString.match(/width="([0-9.]+)ex"/)
  const heightMatch = svgString.match(/height="([0-9.]+)ex"/)
  const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/)

  // 1ex ~= 8px at 12pt font (standard approximation)
  const exToPx = 8
  const width = widthMatch ? parseFloat(widthMatch[1]) * exToPx : 50
  const height = heightMatch ? parseFloat(heightMatch[1]) * exToPx : 20
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : undefined

  return { width, height, viewBox }
}

/**
 * Convert parsed SVG AST node to react-pdf element
 * This is the core transformation from svg-parser output to react-pdf components
 */
function astNodeToReactPdf(node: ElementNode | TextNode, key: number): React.ReactElement | string | null {
  // Handle text nodes
  if (node.type === 'text') {
    const textValue = (node as TextNode).value
    // TextNode.value can be string | number | true, convert to string
    return textValue != null ? String(textValue) : null
  }

  const elem = node as ElementNode
  const tagName = elem.tagName
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: any = { key }

  // Convert attributes to props
  if (elem.properties) {
    for (const [attr, value] of Object.entries(elem.properties)) {
      // Convert hyphenated attributes to camelCase for react-pdf
      const propName = attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

      // Skip certain attributes that don't apply to react-pdf
      if (['xmlns', 'xmlns:xlink', 'xml:space', 'version'].includes(attr)) {
        continue
      }

      // Handle special attribute mappings
      if (attr === 'xlink:href') {
        props['xlinkHref'] = value
      } else if (attr === 'class') {
        // Skip class attributes (react-pdf uses style objects)
        continue
      } else if (attr === 'style' && typeof value === 'string') {
        // Parse inline style string to object
        const styleObj: Record<string, string> = {}
        value.split(';').forEach(rule => {
          const [prop, val] = rule.split(':').map(s => s.trim())
          if (prop && val) {
            const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
            styleObj[camelProp] = val
          }
        })
        props['style'] = styleObj
      } else {
        props[propName] = value
      }
    }
  }

  // Recursively process children
  const children = elem.children
    ?.map((child, idx) => astNodeToReactPdf(child as ElementNode | TextNode, idx))
    .filter(Boolean) || []

  // Map SVG tags to react-pdf components
  switch (tagName) {
    case 'svg':
      // For nested SVG, use G group instead
      return React.createElement(G, props, ...children)
    case 'g':
      return React.createElement(G, props, ...children)
    case 'path':
      return React.createElement(Path, props)
    case 'rect':
      return React.createElement(Rect, props)
    case 'line':
      return React.createElement(Line, props)
    case 'circle':
      return React.createElement(Circle, props)
    case 'ellipse':
      return React.createElement(Ellipse, props)
    case 'polygon':
      return React.createElement(Polygon, props)
    case 'polyline':
      return React.createElement(Polyline, props)
    case 'text':
      return React.createElement(SvgText, props, ...children)
    case 'tspan':
      // react-pdf has Tspan for text spans
      return React.createElement(Tspan, props, ...children)
    case 'defs':
      return React.createElement(Defs, props, ...children)
    case 'use':
      // react-pdf doesn't support <use>, skip it (SVG defs references)
      return null
    case 'clipPath':
      return React.createElement(ClipPath, props, ...children)
    case 'title':
    case 'desc':
      // Skip metadata elements
      return null
    default:
      // For unknown elements, try to render as G with children
      if (children.length > 0) {
        return React.createElement(G, props, ...children)
      }
      return null
  }
}

/**
 * Convert SVG string to react-pdf Svg component
 * This is the main function used by pdf-generator.tsx
 */
export function svgToReactPdf(svgString: string): React.ReactElement | null {
  if (!svgString || svgString.trim() === '') {
    return null
  }

  try {
    // Parse SVG string to AST
    const parsed = parseSvg(svgString) as RootNode

    if (!parsed.children || parsed.children.length === 0) {
      return null
    }

    // Find the root SVG element
    const svgRoot = parsed.children.find(
      (child): child is ElementNode =>
        child.type === 'element' && child.tagName === 'svg'
    )

    if (!svgRoot) {
      return null
    }

    // Extract dimensions
    const { width, height, viewBox } = extractSvgDimensions(svgString)

    // Build props for root Svg element
    const svgProps: Record<string, unknown> = {
      width,
      height,
    }

    if (viewBox) {
      svgProps.viewBox = viewBox
    }

    // Convert children
    const svgChildren = svgRoot.children
      ?.map((child, idx) => astNodeToReactPdf(child as ElementNode | TextNode, idx))
      .filter(Boolean) || []

    return React.createElement(Svg, svgProps, ...svgChildren)
  } catch (error) {
    console.error('[svgToReactPdf] Error parsing SVG:', error)
    return null
  }
}

/**
 * Convert LaTeX directly to react-pdf Svg element
 * Convenience function combining latexToSvg + svgToReactPdf
 */
export function latexToReactPdf(latex: string, display: boolean = false): React.ReactElement | null {
  const svgString = latexToSvg(latex, display)
  return svgToReactPdf(svgString)
}
