'use client'

import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronRight } from 'lucide-react'

interface MathEditorProps {
    isOpen: boolean
    onClose: () => void
    onInsert: (latex: string) => void
    locale?: string
    anchorElement?: HTMLElement | null
}

const mathSymbols = {
    operations: [
        { symbol: '+', latex: '+' },
        { symbol: '−', latex: '-' },
        { symbol: '×', latex: '\\times' },
        { symbol: '÷', latex: '\\div' },
        { symbol: '±', latex: '\\pm' },
        { symbol: '∓', latex: '\\mp' },
        { symbol: '√', latex: '\\sqrt{x}', display: '\\sqrt{x}' },
        { symbol: '∛', latex: '\\sqrt[3]{x}', display: '\\sqrt[3]{x}' },
        { symbol: '∑', latex: '\\sum', display: '\\sum_{i=1}^{n}' },
        { symbol: '∏', latex: '\\prod', display: '\\prod_{i=1}^{n}' },
        { symbol: '∫', latex: '\\int', display: '\\int_{a}^{b}' },
        { symbol: '∂', latex: '\\partial' },
    ],
    relations: [
        { symbol: '=', latex: '=' },
        { symbol: '≠', latex: '\\neq' },
        { symbol: '≈', latex: '\\approx' },
        { symbol: '≤', latex: '\\leq' },
        { symbol: '≥', latex: '\\geq' },
        { symbol: '<', latex: '<' },
        { symbol: '>', latex: '>' },
        { symbol: '≪', latex: '\\ll' },
        { symbol: '≫', latex: '\\gg' },
        { symbol: '≡', latex: '\\equiv' },
        { symbol: '∝', latex: '\\propto' },
        { symbol: '∼', latex: '\\sim' },
    ],
    greek: [
        { symbol: 'α', latex: '\\alpha' },
        { symbol: 'β', latex: '\\beta' },
        { symbol: 'γ', latex: '\\gamma' },
        { symbol: 'δ', latex: '\\delta' },
        { symbol: 'ε', latex: '\\epsilon' },
        { symbol: 'ζ', latex: '\\zeta' },
        { symbol: 'η', latex: '\\eta' },
        { symbol: 'θ', latex: '\\theta' },
        { symbol: 'ι', latex: '\\iota' },
        { symbol: 'κ', latex: '\\kappa' },
        { symbol: 'λ', latex: '\\lambda' },
        { symbol: 'μ', latex: '\\mu' },
        { symbol: 'ν', latex: '\\nu' },
        { symbol: 'ξ', latex: '\\xi' },
        { symbol: 'π', latex: '\\pi' },
        { symbol: 'ρ', latex: '\\rho' },
        { symbol: 'σ', latex: '\\sigma' },
        { symbol: 'τ', latex: '\\tau' },
        { symbol: 'υ', latex: '\\upsilon' },
        { symbol: 'φ', latex: '\\phi' },
        { symbol: 'χ', latex: '\\chi' },
        { symbol: 'ψ', latex: '\\psi' },
        { symbol: 'ω', latex: '\\omega' },
        { symbol: 'Γ', latex: '\\Gamma' },
        { symbol: 'Δ', latex: '\\Delta' },
        { symbol: 'Θ', latex: '\\Theta' },
        { symbol: 'Λ', latex: '\\Lambda' },
        { symbol: 'Π', latex: '\\Pi' },
        { symbol: 'Σ', latex: '\\Sigma' },
        { symbol: 'Φ', latex: '\\Phi' },
        { symbol: 'Ω', latex: '\\Omega' },
    ],
    sets: [
        { symbol: '∈', latex: '\\in' },
        { symbol: '∉', latex: '\\notin' },
        { symbol: '⊂', latex: '\\subset' },
        { symbol: '⊃', latex: '\\supset' },
        { symbol: '⊆', latex: '\\subseteq' },
        { symbol: '⊇', latex: '\\supseteq' },
        { symbol: '∪', latex: '\\cup' },
        { symbol: '∩', latex: '\\cap' },
        { symbol: '∅', latex: '\\emptyset' },
        { symbol: 'ℕ', latex: '\\mathbb{N}' },
        { symbol: 'ℤ', latex: '\\mathbb{Z}' },
        { symbol: 'ℚ', latex: '\\mathbb{Q}' },
        { symbol: 'ℝ', latex: '\\mathbb{R}' },
        { symbol: 'ℂ', latex: '\\mathbb{C}' },
    ],
    arrows: [
        { symbol: '→', latex: '\\rightarrow' },
        { symbol: '←', latex: '\\leftarrow' },
        { symbol: '↔', latex: '\\leftrightarrow' },
        { symbol: '⇒', latex: '\\Rightarrow' },
        { symbol: '⇐', latex: '\\Leftarrow' },
        { symbol: '⇔', latex: '\\Leftrightarrow' },
        { symbol: '↑', latex: '\\uparrow' },
        { symbol: '↓', latex: '\\downarrow' },
        { symbol: '↗', latex: '\\nearrow' },
        { symbol: '↘', latex: '\\searrow' },
    ],
    functions: [
        { symbol: 'sin', latex: '\\sin', display: '\\sin(x)' },
        { symbol: 'cos', latex: '\\cos', display: '\\cos(x)' },
        { symbol: 'tan', latex: '\\tan', display: '\\tan(x)' },
        { symbol: 'log', latex: '\\log', display: '\\log(x)' },
        { symbol: 'ln', latex: '\\ln', display: '\\ln(x)' },
        { symbol: 'exp', latex: '\\exp', display: '\\exp(x)' },
        { symbol: 'lim', latex: '\\lim', display: '\\lim_{x \\to 0}' },
        { symbol: 'max', latex: '\\max', display: '\\max(x,y)' },
        { symbol: 'min', latex: '\\min', display: '\\min(x,y)' },
    ],
    fractions: [
        { symbol: 'a/b', latex: '\\frac{a}{b}', display: '\\frac{a}{b}' },
        { symbol: 'x²', latex: 'x^{2}', display: 'x^{2}' },
        { symbol: 'xⁿ', latex: 'x^{n}', display: 'x^{n}' },
        { symbol: 'x₁', latex: 'x_{1}', display: 'x_{1}' },
        { symbol: 'xₙ', latex: 'x_{n}', display: 'x_{n}' },
    ],
    matrices: [
        { symbol: '()', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', display: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
        { symbol: '[]', latex: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', display: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}' },
    ],
}

const categoryLabels = {
    fr: {
        operations: 'Opérations',
        relations: 'Relations',
        greek: 'Lettres grecques',
        sets: 'Ensembles',
        arrows: 'Flèches',
        functions: 'Fonctions',
        fractions: 'Puissances & Indices',
        matrices: 'Matrices',
    },
    en: {
        operations: 'Operations',
        relations: 'Relations',
        greek: 'Greek Letters',
        sets: 'Sets',
        arrows: 'Arrows',
        functions: 'Functions',
        fractions: 'Powers & Indices',
        matrices: 'Matrices',
    },
}

export default function MathEditor({ isOpen, onClose, onInsert, locale = 'fr', anchorElement }: MathEditorProps) {
    const [activeCategory, setActiveCategory] = useState<keyof typeof mathSymbols>('operations')
    const [position, setPosition] = useState({ top: 0, left: 0 })
    const popupRef = useRef<HTMLDivElement>(null)
    const labels = categoryLabels[locale as 'fr' | 'en'] || categoryLabels.fr

    // Calculate position relative to anchor element
    useLayoutEffect(() => {
        if (isOpen && anchorElement && popupRef.current) {
            const rect = anchorElement.getBoundingClientRect()
            const popupWidth = 384 // w-96 = 384px
            const popupHeight = 500 // max-h-[500px]
            
            // Use viewport coordinates (getBoundingClientRect already gives viewport coordinates)
            let top = rect.bottom + 8
            let left = rect.right - popupWidth
            
            // Adjust if it would go off screen
            if (left < 8) {
                left = Math.max(8, rect.left)
            }
            if (top + popupHeight > window.innerHeight) {
                top = Math.max(8, rect.top - popupHeight - 8)
            }
            if (top < 8) {
                top = 8
            }
            // Position update is intentional inside effect for portal placement
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPosition({ top, left })
        }
    }, [isOpen, anchorElement])

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return

        const handleClickOutside = (event: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(event.target as Node) && 
                anchorElement && !anchorElement.contains(event.target as Node)) {
                onClose()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen, anchorElement, onClose])

    if (typeof document === 'undefined' || !isOpen) return null

    const handleSymbolClick = (symbol: { symbol: string; latex: string; display?: string }) => {
        const latexToInsert = symbol.display || symbol.latex
        onInsert(`$${latexToInsert}$`)
    }

    const popupContent = (
        <>
            {/* Backdrop - only if no anchor element */}
            {!anchorElement && (
                <div 
                    className="fixed inset-0 z-40 bg-black bg-opacity-20" 
                    onClick={onClose}
                />
            )}
            
            {/* Popup */}
            <div
                ref={popupRef}
                className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 w-96 max-h-[500px] flex flex-col"
                style={{
                    top: `${position.top}px`,
                    left: `${Math.max(8, position.left)}px`,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900">
                        {locale === 'fr' ? 'Symboles mathématiques' : 'Math Symbols'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex">
                    {/* Categories Sidebar */}
                    <div className="w-32 border-r border-gray-200 bg-gray-50 overflow-y-auto">
                        {Object.keys(mathSymbols).map((category) => (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category as keyof typeof mathSymbols)}
                                className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                                    activeCategory === category
                                        ? 'bg-brand-900 text-white'
                                        : 'text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span>{labels[category as keyof typeof labels]}</span>
                                    {activeCategory === category && <ChevronRight className="w-3 h-3" />}
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Symbols Grid */}
                    <div className="flex-1 p-2 overflow-y-auto bg-white">
                        <div className="grid grid-cols-4 gap-1.5">
                            {mathSymbols[activeCategory].map((symbol, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSymbolClick(symbol)}
                                    className="flex flex-col items-center justify-center p-2 border border-gray-200 rounded hover:border-brand-900 hover:bg-brand-50 transition-all group"
                                    title={symbol.latex}
                                >
                                    <span className="text-xl font-medium text-gray-700 group-hover:text-brand-900">
                                        {symbol.symbol}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )

    return createPortal(popupContent, document.body)
}
