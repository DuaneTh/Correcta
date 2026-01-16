/**
 * Helpers to convert legacy rich-text math HTML into portable LaTeX strings.
 * The previous editor stored custom <span data-structure="..."> nodes that
 * cannot be rendered reliably outside the builder. To keep backward
 * compatibility we attempt to translate these structures to LaTeX so the new
 * renderer can handle them uniformly.
 */

const PLACEHOLDER_CHAR = '□'

const serializeLegacyNode = (node: ChildNode, wrapWithDollar = true): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const el = node as HTMLElement
  const structure = el.dataset.structure

  const wrap = (latex: string) => (wrapWithDollar ? `$${latex}$` : latex)

  if (structure === 'fraction') {
    const numerator = el.querySelector('[class*="math-fraction__numerator"]') ?? el.children[0]
    const denominator = el.querySelector('[class*="math-fraction__denominator"]') ?? el.children[2]
    return wrap(`\\frac{${serializeChildren(numerator, false)}}{${serializeChildren(denominator, false)}}`)
  }

  if (structure === 'sum') {
    const upper = el.querySelector('[data-placeholder][class*="Upper"]') ?? el.children[0]
    const lower = el.querySelector('[data-placeholder][class*="Lower"]') ?? el.children[2]
    return wrap(`\\sum_{${serializeChildren(lower, false)}}^{${serializeChildren(upper, false)}}`)
  }

  if (structure === 'integral') {
    const upper = el.querySelector('[data-placeholder][class*="Upper"]') ?? el.children[0]
    const lower = el.querySelector('[data-placeholder][class*="Lower"]') ?? el.children[2]
    return wrap(`\\int_{${serializeChildren(lower, false)}}^{${serializeChildren(upper, false)}}`)
  }

  if (structure === 'sqrt') {
    const content = el.querySelector('[data-placeholder]') ?? el.lastElementChild
    return wrap(`\\sqrt{${serializeChildren(content, false)}}`)
  }

  if (structure === 'cbrt') {
    const index = el.querySelector('[class*="mathCbrtIndex"]') ?? el.firstElementChild
    const content = el.querySelector('[data-placeholder]') ?? el.lastElementChild
    return wrap(`\\sqrt[${serializeChildren(index, false)}]{${serializeChildren(content, false)}}`)
  }

  if (structure === 'superscript') {
    const base = el.querySelector('[class*="Base"]') ?? el.children[0]
    const exp = el.querySelector('[class*="Exp"]') ?? el.children[1]
    return wrap(`${serializeChildren(base, false)}^{${serializeChildren(exp, false)}}`)
  }

  if (structure === 'subscript') {
    const base = el.querySelector('[class*="Base"]') ?? el.children[0]
    const sub = el.querySelector('[class*="Sub"]') ?? el.children[1]
    return wrap(`${serializeChildren(base, false)}_{${serializeChildren(sub, false)}}`)
  }

  // Not a known structure, fall back to concatenating children
  return serializeChildren(el, wrapWithDollar)
}

const serializeChildren = (node: Element | null, wrapWithDollar = true): string => {
  if (!node) return ''
  return Array.from(node.childNodes).map((child) => serializeLegacyNode(child, wrapWithDollar)).join('')
}

/**
 * Convert the legacy HTML (from the old math editor) to a portable LaTeX-ish
 * string. Unknown nodes are flattened to their text content. Placeholders are
 * kept as □ so that the new editor can Tab through them.
 */
export const legacyMathHtmlToLatex = (html: string): string => {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const body = doc.body
    const latex = Array.from(body.childNodes)
      .map((child) => serializeLegacyNode(child))
      .join('')
      .replace(/\u00a0/g, ' ')
    return latex.trim()
  } catch (error) {
    console.warn('Failed to parse legacy math HTML', error)
    // Fallback to stripping tags
    return html.replace(/<[^>]+>/g, '').replace(/\u00a0/g, ' ')
  }
}

/**
 * Normalize any stored value to the format expected by the new math system:
 * plain text with inline LaTeX wrapped in $...$ and placeholders kept as □.
 */
export const normalizeMathValue = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return ''

  // If it already contains TeX delimiters, leave it as-is
  if (value.includes('$')) return value

  // If it looks like legacy HTML from the previous editor, attempt conversion
  if (value.includes('<span') || value.includes('data-structure')) {
    return legacyMathHtmlToLatex(value)
  }

  return value
}

export { PLACEHOLDER_CHAR }
