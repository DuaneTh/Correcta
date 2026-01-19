/**
 * Math Symbol Definitions for MathToolbar
 *
 * This library provides centralized symbol definitions for the persistent math toolbar.
 * Symbols use MathLive placeholder syntax:
 * - #@ : Cursor position (where cursor starts)
 * - #0 : Next placeholder (Tab navigates to)
 */

export interface MathSymbol {
  /** Visual representation for button display */
  label: string
  /** LaTeX code to insert (with MathLive placeholders) */
  latex: string
  /** Category this symbol belongs to */
  category: SymbolCategory
  /** Description for accessibility/tooltip */
  tooltip: {
    en: string
    fr: string
  }
}

export type SymbolCategory =
  | 'basic'
  | 'fractions'
  | 'powers'
  | 'greek'
  | 'calculus'
  | 'relations'
  | 'sets'

export interface CategoryMetadata {
  id: SymbolCategory
  label: {
    en: string
    fr: string
  }
  /** Lucide icon name */
  icon: string
}

/**
 * Category metadata for toolbar tabs
 */
export const symbolCategories: CategoryMetadata[] = [
  {
    id: 'basic',
    label: { en: 'Basic', fr: 'Base' },
    icon: 'Calculator',
  },
  {
    id: 'fractions',
    label: { en: 'Fractions', fr: 'Fractions' },
    icon: 'Divide',
  },
  {
    id: 'powers',
    label: { en: 'Powers', fr: 'Puissances' },
    icon: 'Superscript',
  },
  {
    id: 'greek',
    label: { en: 'Greek', fr: 'Grec' },
    icon: 'Type',
  },
  {
    id: 'calculus',
    label: { en: 'Calculus', fr: 'Analyse' },
    icon: 'Sigma',
  },
  {
    id: 'relations',
    label: { en: 'Relations', fr: 'Relations' },
    icon: 'Equal',
  },
  {
    id: 'sets',
    label: { en: 'Sets', fr: 'Ensembles' },
    icon: 'Layers',
  },
]

/**
 * All math symbols organized by category
 */
export const mathSymbols: Record<SymbolCategory, MathSymbol[]> = {
  basic: [
    { label: '+', latex: '+', category: 'basic', tooltip: { en: 'Plus', fr: 'Plus' } },
    { label: '-', latex: '-', category: 'basic', tooltip: { en: 'Minus', fr: 'Moins' } },
    { label: '\u00d7', latex: '\\times', category: 'basic', tooltip: { en: 'Multiply', fr: 'Multiplier' } },
    { label: '\u00f7', latex: '\\div', category: 'basic', tooltip: { en: 'Divide', fr: 'Diviser' } },
    { label: '=', latex: '=', category: 'basic', tooltip: { en: 'Equals', fr: 'Egal' } },
    { label: '(', latex: '(', category: 'basic', tooltip: { en: 'Left parenthesis', fr: 'Parenthese gauche' } },
    { label: ')', latex: ')', category: 'basic', tooltip: { en: 'Right parenthesis', fr: 'Parenthese droite' } },
    { label: '[', latex: '[', category: 'basic', tooltip: { en: 'Left bracket', fr: 'Crochet gauche' } },
    { label: ']', latex: ']', category: 'basic', tooltip: { en: 'Right bracket', fr: 'Crochet droit' } },
    { label: '{', latex: '\\{', category: 'basic', tooltip: { en: 'Left brace', fr: 'Accolade gauche' } },
    { label: '}', latex: '\\}', category: 'basic', tooltip: { en: 'Right brace', fr: 'Accolade droite' } },
    { label: '\u00b1', latex: '\\pm', category: 'basic', tooltip: { en: 'Plus or minus', fr: 'Plus ou moins' } },
    { label: '\u2213', latex: '\\mp', category: 'basic', tooltip: { en: 'Minus or plus', fr: 'Moins ou plus' } },
    { label: '\u00b7', latex: '\\cdot', category: 'basic', tooltip: { en: 'Dot product', fr: 'Produit scalaire' } },
  ],

  fractions: [
    { label: 'a/b', latex: '\\frac{#@}{#0}', category: 'fractions', tooltip: { en: 'Fraction', fr: 'Fraction' } },
    { label: 'a\u2044b', latex: '\\tfrac{#@}{#0}', category: 'fractions', tooltip: { en: 'Small fraction', fr: 'Petite fraction' } },
    { label: '\u2202/\u2202x', latex: '\\frac{\\partial}{\\partial #0}', category: 'fractions', tooltip: { en: 'Partial derivative', fr: 'Derivee partielle' } },
    { label: 'd/dx', latex: '\\frac{d}{d#0}', category: 'fractions', tooltip: { en: 'Derivative', fr: 'Derivee' } },
    { label: '\u0394y/\u0394x', latex: '\\frac{\\Delta #@}{\\Delta #0}', category: 'fractions', tooltip: { en: 'Difference quotient', fr: 'Taux de variation' } },
  ],

  powers: [
    { label: 'x\u00b2', latex: '^{2}', category: 'powers', tooltip: { en: 'Square', fr: 'Carre' } },
    { label: 'x\u00b3', latex: '^{3}', category: 'powers', tooltip: { en: 'Cube', fr: 'Cube' } },
    { label: 'x\u207f', latex: '^{#0}', category: 'powers', tooltip: { en: 'Exponent', fr: 'Exposant' } },
    { label: 'x\u2099', latex: '_{#0}', category: 'powers', tooltip: { en: 'Subscript', fr: 'Indice' } },
    { label: 'x\u207f\u2099', latex: '_{#@}^{#0}', category: 'powers', tooltip: { en: 'Subscript and superscript', fr: 'Indice et exposant' } },
    { label: '\u221a', latex: '\\sqrt{#0}', category: 'powers', tooltip: { en: 'Square root', fr: 'Racine carree' } },
    { label: '\u221b', latex: '\\sqrt[3]{#0}', category: 'powers', tooltip: { en: 'Cube root', fr: 'Racine cubique' } },
    { label: '\u207f\u221a', latex: '\\sqrt[#@]{#0}', category: 'powers', tooltip: { en: 'Nth root', fr: 'Racine n-ieme' } },
    { label: 'e\u02e3', latex: 'e^{#0}', category: 'powers', tooltip: { en: 'Exponential', fr: 'Exponentielle' } },
    { label: '10\u02e3', latex: '10^{#0}', category: 'powers', tooltip: { en: 'Power of 10', fr: 'Puissance de 10' } },
    { label: 'ln', latex: '\\ln\\left(#0\\right)', category: 'powers', tooltip: { en: 'Natural logarithm', fr: 'Logarithme naturel' } },
    { label: 'log', latex: '\\log_{#@}\\left(#0\\right)', category: 'powers', tooltip: { en: 'Logarithm', fr: 'Logarithme' } },
    { label: 'log\u2081\u2080', latex: '\\log_{10}\\left(#0\\right)', category: 'powers', tooltip: { en: 'Logarithm base 10', fr: 'Logarithme base 10' } },
    { label: '|x|', latex: '\\left|#0\\right|', category: 'powers', tooltip: { en: 'Absolute value', fr: 'Valeur absolue' } },
  ],

  greek: [
    // Lowercase Greek letters
    { label: '\u03b1', latex: '\\alpha', category: 'greek', tooltip: { en: 'Alpha', fr: 'Alpha' } },
    { label: '\u03b2', latex: '\\beta', category: 'greek', tooltip: { en: 'Beta', fr: 'Beta' } },
    { label: '\u03b3', latex: '\\gamma', category: 'greek', tooltip: { en: 'Gamma', fr: 'Gamma' } },
    { label: '\u03b4', latex: '\\delta', category: 'greek', tooltip: { en: 'Delta', fr: 'Delta' } },
    { label: '\u03b5', latex: '\\epsilon', category: 'greek', tooltip: { en: 'Epsilon', fr: 'Epsilon' } },
    { label: '\u03b6', latex: '\\zeta', category: 'greek', tooltip: { en: 'Zeta', fr: 'Zeta' } },
    { label: '\u03b7', latex: '\\eta', category: 'greek', tooltip: { en: 'Eta', fr: 'Eta' } },
    { label: '\u03b8', latex: '\\theta', category: 'greek', tooltip: { en: 'Theta', fr: 'Theta' } },
    { label: '\u03b9', latex: '\\iota', category: 'greek', tooltip: { en: 'Iota', fr: 'Iota' } },
    { label: '\u03ba', latex: '\\kappa', category: 'greek', tooltip: { en: 'Kappa', fr: 'Kappa' } },
    { label: '\u03bb', latex: '\\lambda', category: 'greek', tooltip: { en: 'Lambda', fr: 'Lambda' } },
    { label: '\u03bc', latex: '\\mu', category: 'greek', tooltip: { en: 'Mu', fr: 'Mu' } },
    { label: '\u03bd', latex: '\\nu', category: 'greek', tooltip: { en: 'Nu', fr: 'Nu' } },
    { label: '\u03be', latex: '\\xi', category: 'greek', tooltip: { en: 'Xi', fr: 'Xi' } },
    { label: '\u03c0', latex: '\\pi', category: 'greek', tooltip: { en: 'Pi', fr: 'Pi' } },
    { label: '\u03c1', latex: '\\rho', category: 'greek', tooltip: { en: 'Rho', fr: 'Rho' } },
    { label: '\u03c3', latex: '\\sigma', category: 'greek', tooltip: { en: 'Sigma', fr: 'Sigma' } },
    { label: '\u03c4', latex: '\\tau', category: 'greek', tooltip: { en: 'Tau', fr: 'Tau' } },
    { label: '\u03c5', latex: '\\upsilon', category: 'greek', tooltip: { en: 'Upsilon', fr: 'Upsilon' } },
    { label: '\u03c6', latex: '\\phi', category: 'greek', tooltip: { en: 'Phi', fr: 'Phi' } },
    { label: '\u03c7', latex: '\\chi', category: 'greek', tooltip: { en: 'Chi', fr: 'Chi' } },
    { label: '\u03c8', latex: '\\psi', category: 'greek', tooltip: { en: 'Psi', fr: 'Psi' } },
    { label: '\u03c9', latex: '\\omega', category: 'greek', tooltip: { en: 'Omega', fr: 'Omega' } },
    // Uppercase Greek letters
    { label: '\u0393', latex: '\\Gamma', category: 'greek', tooltip: { en: 'Gamma (uppercase)', fr: 'Gamma majuscule' } },
    { label: '\u0394', latex: '\\Delta', category: 'greek', tooltip: { en: 'Delta (uppercase)', fr: 'Delta majuscule' } },
    { label: '\u0398', latex: '\\Theta', category: 'greek', tooltip: { en: 'Theta (uppercase)', fr: 'Theta majuscule' } },
    { label: '\u039b', latex: '\\Lambda', category: 'greek', tooltip: { en: 'Lambda (uppercase)', fr: 'Lambda majuscule' } },
    { label: '\u039e', latex: '\\Xi', category: 'greek', tooltip: { en: 'Xi (uppercase)', fr: 'Xi majuscule' } },
    { label: '\u03a0', latex: '\\Pi', category: 'greek', tooltip: { en: 'Pi (uppercase)', fr: 'Pi majuscule' } },
    { label: '\u03a3', latex: '\\Sigma', category: 'greek', tooltip: { en: 'Sigma (uppercase)', fr: 'Sigma majuscule' } },
    { label: '\u03a6', latex: '\\Phi', category: 'greek', tooltip: { en: 'Phi (uppercase)', fr: 'Phi majuscule' } },
    { label: '\u03a8', latex: '\\Psi', category: 'greek', tooltip: { en: 'Psi (uppercase)', fr: 'Psi majuscule' } },
    { label: '\u03a9', latex: '\\Omega', category: 'greek', tooltip: { en: 'Omega (uppercase)', fr: 'Omega majuscule' } },
  ],

  calculus: [
    { label: '\u222b', latex: '\\int_{#@}^{#0}', category: 'calculus', tooltip: { en: 'Definite integral', fr: 'Integrale definie' } },
    { label: '\u222b', latex: '\\int', category: 'calculus', tooltip: { en: 'Indefinite integral', fr: 'Integrale indefinie' } },
    { label: '\u222c', latex: '\\iint_{#0}', category: 'calculus', tooltip: { en: 'Double integral', fr: 'Integrale double' } },
    { label: '\u222d', latex: '\\iiint_{#0}', category: 'calculus', tooltip: { en: 'Triple integral', fr: 'Integrale triple' } },
    { label: '\u222e', latex: '\\oint_{#0}', category: 'calculus', tooltip: { en: 'Contour integral', fr: 'Integrale de contour' } },
    { label: '\u2211', latex: '\\sum_{#@}^{#0}', category: 'calculus', tooltip: { en: 'Summation', fr: 'Somme' } },
    { label: '\u220f', latex: '\\prod_{#@}^{#0}', category: 'calculus', tooltip: { en: 'Product', fr: 'Produit' } },
    { label: 'lim', latex: '\\lim_{#@ \\to #0}', category: 'calculus', tooltip: { en: 'Limit', fr: 'Limite' } },
    { label: 'lim\u2080\u207a', latex: '\\lim_{#0 \\to 0^+}', category: 'calculus', tooltip: { en: 'Right limit', fr: 'Limite a droite' } },
    { label: 'lim\u2080\u207b', latex: '\\lim_{#0 \\to 0^-}', category: 'calculus', tooltip: { en: 'Left limit', fr: 'Limite a gauche' } },
    { label: 'lim\u221e', latex: '\\lim_{#0 \\to \\infty}', category: 'calculus', tooltip: { en: 'Limit to infinity', fr: 'Limite a l\'infini' } },
    { label: '\u2202', latex: '\\partial', category: 'calculus', tooltip: { en: 'Partial derivative symbol', fr: 'Symbole derivee partielle' } },
    { label: '\u2207', latex: '\\nabla', category: 'calculus', tooltip: { en: 'Nabla (gradient)', fr: 'Nabla (gradient)' } },
    { label: '\u221e', latex: '\\infty', category: 'calculus', tooltip: { en: 'Infinity', fr: 'Infini' } },
    { label: 'sin', latex: '\\sin\\left(#0\\right)', category: 'calculus', tooltip: { en: 'Sine', fr: 'Sinus' } },
    { label: 'cos', latex: '\\cos\\left(#0\\right)', category: 'calculus', tooltip: { en: 'Cosine', fr: 'Cosinus' } },
    { label: 'tan', latex: '\\tan\\left(#0\\right)', category: 'calculus', tooltip: { en: 'Tangent', fr: 'Tangente' } },
    { label: 'sin\u207b\u00b9', latex: '\\arcsin\\left(#0\\right)', category: 'calculus', tooltip: { en: 'Arcsine', fr: 'Arcsinus' } },
    { label: 'cos\u207b\u00b9', latex: '\\arccos\\left(#0\\right)', category: 'calculus', tooltip: { en: 'Arccosine', fr: 'Arccosinus' } },
    { label: 'tan\u207b\u00b9', latex: '\\arctan\\left(#0\\right)', category: 'calculus', tooltip: { en: 'Arctangent', fr: 'Arctangente' } },
  ],

  relations: [
    { label: '<', latex: '<', category: 'relations', tooltip: { en: 'Less than', fr: 'Inferieur a' } },
    { label: '>', latex: '>', category: 'relations', tooltip: { en: 'Greater than', fr: 'Superieur a' } },
    { label: '\u2264', latex: '\\leq', category: 'relations', tooltip: { en: 'Less than or equal', fr: 'Inferieur ou egal' } },
    { label: '\u2265', latex: '\\geq', category: 'relations', tooltip: { en: 'Greater than or equal', fr: 'Superieur ou egal' } },
    { label: '\u2260', latex: '\\neq', category: 'relations', tooltip: { en: 'Not equal', fr: 'Different de' } },
    { label: '\u2248', latex: '\\approx', category: 'relations', tooltip: { en: 'Approximately equal', fr: 'Approximativement egal' } },
    { label: '\u2261', latex: '\\equiv', category: 'relations', tooltip: { en: 'Equivalent', fr: 'Equivalent' } },
    { label: '\u223c', latex: '\\sim', category: 'relations', tooltip: { en: 'Similar to', fr: 'Similaire a' } },
    { label: '\u221d', latex: '\\propto', category: 'relations', tooltip: { en: 'Proportional to', fr: 'Proportionnel a' } },
    { label: '\u226a', latex: '\\ll', category: 'relations', tooltip: { en: 'Much less than', fr: 'Beaucoup plus petit' } },
    { label: '\u226b', latex: '\\gg', category: 'relations', tooltip: { en: 'Much greater than', fr: 'Beaucoup plus grand' } },
    { label: '\u2192', latex: '\\to', category: 'relations', tooltip: { en: 'Arrow right', fr: 'Fleche droite' } },
    { label: '\u21d2', latex: '\\Rightarrow', category: 'relations', tooltip: { en: 'Implies', fr: 'Implique' } },
    { label: '\u21d4', latex: '\\Leftrightarrow', category: 'relations', tooltip: { en: 'If and only if', fr: 'Si et seulement si' } },
    { label: '\u21a6', latex: '\\mapsto', category: 'relations', tooltip: { en: 'Maps to', fr: 'Applique a' } },
    { label: '\u2200', latex: '\\forall', category: 'relations', tooltip: { en: 'For all', fr: 'Pour tout' } },
    { label: '\u2203', latex: '\\exists', category: 'relations', tooltip: { en: 'There exists', fr: 'Il existe' } },
    { label: '\u00ac', latex: '\\neg', category: 'relations', tooltip: { en: 'Negation', fr: 'Negation' } },
    { label: '\u2227', latex: '\\land', category: 'relations', tooltip: { en: 'Logical and', fr: 'Et logique' } },
    { label: '\u2228', latex: '\\lor', category: 'relations', tooltip: { en: 'Logical or', fr: 'Ou logique' } },
  ],

  sets: [
    { label: '\u2282', latex: '\\subset', category: 'sets', tooltip: { en: 'Subset', fr: 'Sous-ensemble' } },
    { label: '\u2283', latex: '\\supset', category: 'sets', tooltip: { en: 'Superset', fr: 'Sur-ensemble' } },
    { label: '\u2286', latex: '\\subseteq', category: 'sets', tooltip: { en: 'Subset or equal', fr: 'Sous-ensemble ou egal' } },
    { label: '\u2287', latex: '\\supseteq', category: 'sets', tooltip: { en: 'Superset or equal', fr: 'Sur-ensemble ou egal' } },
    { label: '\u222a', latex: '\\cup', category: 'sets', tooltip: { en: 'Union', fr: 'Union' } },
    { label: '\u2229', latex: '\\cap', category: 'sets', tooltip: { en: 'Intersection', fr: 'Intersection' } },
    { label: '\u2208', latex: '\\in', category: 'sets', tooltip: { en: 'Element of', fr: 'Element de' } },
    { label: '\u2209', latex: '\\notin', category: 'sets', tooltip: { en: 'Not element of', fr: 'N\'appartient pas' } },
    { label: '\u2205', latex: '\\emptyset', category: 'sets', tooltip: { en: 'Empty set', fr: 'Ensemble vide' } },
    { label: '\u2115', latex: '\\mathbb{N}', category: 'sets', tooltip: { en: 'Natural numbers', fr: 'Nombres naturels' } },
    { label: '\u2124', latex: '\\mathbb{Z}', category: 'sets', tooltip: { en: 'Integers', fr: 'Entiers relatifs' } },
    { label: '\u211a', latex: '\\mathbb{Q}', category: 'sets', tooltip: { en: 'Rational numbers', fr: 'Nombres rationnels' } },
    { label: '\u211d', latex: '\\mathbb{R}', category: 'sets', tooltip: { en: 'Real numbers', fr: 'Nombres reels' } },
    { label: '\u2102', latex: '\\mathbb{C}', category: 'sets', tooltip: { en: 'Complex numbers', fr: 'Nombres complexes' } },
    { label: '\u211d\u207a', latex: '\\mathbb{R}^+', category: 'sets', tooltip: { en: 'Positive reals', fr: 'Reels positifs' } },
    { label: '\u211d*', latex: '\\mathbb{R}^*', category: 'sets', tooltip: { en: 'Non-zero reals', fr: 'Reels non nuls' } },
  ],
}

/**
 * Quick-access symbols for the always-visible row
 */
export const quickAccessSymbols: MathSymbol[] = [
  mathSymbols.fractions[0], // fraction
  mathSymbols.powers[5],    // sqrt
  mathSymbols.powers[2],    // exponent
  mathSymbols.powers[3],    // subscript
  mathSymbols.greek[14],    // pi
  mathSymbols.calculus[0],  // integral
  mathSymbols.calculus[5],  // sum
  mathSymbols.relations[4], // not equal
]

/**
 * Helper function to get symbols by category
 */
export function getSymbolsByCategory(category: SymbolCategory): MathSymbol[] {
  return mathSymbols[category] || []
}

/**
 * Get all symbols flattened into a single array
 */
export function getAllSymbols(): MathSymbol[] {
  return Object.values(mathSymbols).flat()
}

/**
 * Search symbols by label or tooltip
 */
export function searchSymbols(query: string, locale: 'en' | 'fr' = 'en'): MathSymbol[] {
  const lowerQuery = query.toLowerCase()
  return getAllSymbols().filter(
    (symbol) =>
      symbol.label.toLowerCase().includes(lowerQuery) ||
      symbol.tooltip[locale].toLowerCase().includes(lowerQuery)
  )
}
