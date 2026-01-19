'use client'

import { useState, useCallback } from 'react'
import {
  Calculator,
  Divide,
  Superscript,
  Type,
  Sigma,
  Equal,
  Layers,
} from 'lucide-react'
import {
  mathSymbols,
  symbolCategories,
  quickAccessSymbols,
  type SymbolCategory,
  type MathSymbol,
} from '@/lib/math/symbols'

interface MathToolbarProps {
  /** Callback to insert LaTeX into the editor */
  onInsert: (latex: string) => void
  /** Whether the toolbar is disabled */
  disabled?: boolean
  /** Current locale for labels */
  locale?: 'fr' | 'en'
  /** Button size */
  size?: 'sm' | 'md'
  /** Optional override for quick-access symbols */
  quickSymbols?: MathSymbol[]
  /** Whether to show category tabs (default true) */
  showCategories?: boolean
}

/** Map category ID to Lucide icon component */
const categoryIcons: Record<SymbolCategory, typeof Calculator> = {
  basic: Calculator,
  fractions: Divide,
  powers: Superscript,
  greek: Type,
  calculus: Sigma,
  relations: Equal,
  sets: Layers,
}

export default function MathToolbar({
  onInsert,
  disabled = false,
  locale = 'fr',
  size = 'sm',
  quickSymbols = quickAccessSymbols,
  showCategories = true,
}: MathToolbarProps) {
  const [activeCategory, setActiveCategory] = useState<SymbolCategory>('basic')

  const handleSymbolClick = useCallback(
    (symbol: MathSymbol) => {
      if (!disabled) {
        onInsert(symbol.latex)
      }
    },
    [onInsert, disabled]
  )

  const buttonSizeClasses = size === 'sm' ? 'w-7 h-7 text-sm' : 'w-8 h-8 text-base'
  const iconSize = size === 'sm' ? 14 : 16

  return (
    <div className="math-toolbar border border-gray-200 rounded-lg bg-white shadow-sm">
      {/* Quick-access row - always visible */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-100 bg-gray-50 rounded-t-lg">
        <span className="text-[10px] text-gray-400 mr-1 shrink-0">
          {locale === 'fr' ? 'Rapide' : 'Quick'}:
        </span>
        <div className="flex flex-wrap gap-0.5">
          {quickSymbols.map((symbol, index) => (
            <button
              key={`quick-${symbol.latex}-${index}`}
              type="button"
              onClick={() => handleSymbolClick(symbol)}
              disabled={disabled}
              className={`${buttonSizeClasses} flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-brand-50 hover:border-brand-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              title={symbol.tooltip[locale]}
              style={{ fontFamily: 'Cambria Math, STIX Two Math, Latin Modern Math, serif' }}
            >
              {symbol.label}
            </button>
          ))}
        </div>
      </div>

      {showCategories && (
        <>
          {/* Category tabs */}
          <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-100">
            {symbolCategories.map((category) => {
              const Icon = categoryIcons[category.id]
              const isActive = activeCategory === category.id
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  disabled={disabled}
                  className={`flex items-center justify-center rounded px-2 py-1 text-xs transition-colors ${
                    isActive
                      ? 'bg-brand-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={category.label[locale]}
                >
                  <Icon className="shrink-0" size={iconSize} />
                  <span className="ml-1 hidden sm:inline">{category.label[locale]}</span>
                </button>
              )
            })}
          </div>

          {/* Symbol grid for active category */}
          <div className="p-2 max-h-48 overflow-y-auto">
            <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1">
              {mathSymbols[activeCategory].map((symbol, index) => (
                <button
                  key={`${activeCategory}-${symbol.latex}-${index}`}
                  type="button"
                  onClick={() => handleSymbolClick(symbol)}
                  disabled={disabled}
                  className={`${buttonSizeClasses} flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-brand-50 hover:border-brand-300 hover:text-brand-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed group`}
                  title={symbol.tooltip[locale]}
                  style={{ fontFamily: 'Cambria Math, STIX Two Math, Latin Modern Math, serif' }}
                >
                  <span className="group-hover:scale-110 transition-transform">
                    {symbol.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export { type MathToolbarProps }
