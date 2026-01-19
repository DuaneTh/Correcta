'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check } from 'lucide-react'

interface MathfieldElement extends HTMLElement {
  value: string
  getValue: (format?: string) => string
  setValue: (latex: string) => void
  insert: (latex: string, options?: { focus?: boolean; feedback?: boolean }) => void
  focus: () => void
  executeCommand: (command: string) => void
}

interface MathLivePopupProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (latex: string) => void
  initialLatex?: string
  locale?: 'fr' | 'en'
  anchorElement?: HTMLElement | null
}

const messages = {
  fr: {
    title: 'Editeur de formule',
    insert: 'Inserer',
    cancel: 'Annuler',
    tip: 'Utilisez les fleches pour naviguer dans la formule. Tab pour passer au champ suivant.',
    emptyTip: 'Tapez une formule ou utilisez les raccourcis: / pour fraction, ^ pour exposant, _ pour indice',
  },
  en: {
    title: 'Formula Editor',
    insert: 'Insert',
    cancel: 'Cancel',
    tip: 'Use arrow keys to navigate within the formula. Tab to move to next field.',
    emptyTip: 'Type a formula or use shortcuts: / for fraction, ^ for superscript, _ for subscript',
  },
}

/**
 * MathLivePopup - A WYSIWYG math editor popup using MathLive
 *
 * Features:
 * - Arrow key navigation within formulas
 * - Tab to move between fields (numerator/denominator, etc.)
 * - Ctrl+Enter to insert
 * - Escape to cancel
 */
export default function MathLivePopup({
  isOpen,
  onClose,
  onInsert,
  initialLatex = '',
  locale = 'fr',
  anchorElement,
}: MathLivePopupProps) {
  const t = messages[locale]
  const containerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const mathFieldRef = useRef<MathfieldElement | null>(null)
  const [mathLiveLoaded, setMathLiveLoaded] = useState(false)
  const [currentLatex, setCurrentLatex] = useState(initialLatex)
  const [position, setPosition] = useState({ top: 100, left: 100 })

  // Load MathLive
  useEffect(() => {
    if (typeof window === 'undefined') return

    import('mathlive').then((module) => {
      if ((module as unknown as { MathfieldElement?: { fontsDirectory?: string } }).MathfieldElement) {
        const mfe = (module as unknown as { MathfieldElement: { fontsDirectory?: string } }).MathfieldElement
        mfe.fontsDirectory = 'https://unpkg.com/mathlive/fonts/'
        setMathLiveLoaded(true)
      }
    }).catch(console.error)
  }, [])

  // Calculate position
  useEffect(() => {
    if (!isOpen || !anchorElement || !popupRef.current) return

    const rect = anchorElement.getBoundingClientRect()
    const popupWidth = 400
    const popupHeight = 200

    let top = rect.bottom + 8
    let left = rect.left

    // Adjust if would go off screen
    if (left + popupWidth > window.innerWidth - 16) {
      left = window.innerWidth - popupWidth - 16
    }
    if (left < 16) left = 16

    if (top + popupHeight > window.innerHeight - 16) {
      top = rect.top - popupHeight - 8
    }
    if (top < 16) top = 16

    setPosition({ top, left })
  }, [isOpen, anchorElement])

  // Create MathLive field
  useEffect(() => {
    if (!isOpen || !mathLiveLoaded || !containerRef.current) return

    // Clear previous
    containerRef.current.innerHTML = ''

    const mf = document.createElement('math-field') as MathfieldElement
    mf.value = initialLatex

    // Style
    mf.style.display = 'block'
    mf.style.width = '100%'
    mf.style.minHeight = '60px'
    mf.style.padding = '12px'
    mf.style.fontSize = '1.25rem'
    mf.style.border = '2px solid #6366f1'
    mf.style.borderRadius = '8px'
    mf.style.backgroundColor = 'white'
    mf.style.outline = 'none'

    // Input handler
    mf.addEventListener('input', () => {
      setCurrentLatex(mf.getValue('latex'))
    })

    // Keyboard handler
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        e.stopImmediatePropagation()
        const latex = mf.getValue('latex')
        if (latex.trim()) {
          onInsert(latex)
        }
        onClose()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onClose()
      }
    }
    mf.addEventListener('keydown', handleKeyDown, { capture: true })

    containerRef.current.appendChild(mf)
    mathFieldRef.current = mf

    // Focus after mount
    setTimeout(() => {
      mf.focus()
      if (initialLatex) {
        mf.executeCommand('moveToMathfieldEnd')
      }
    }, 50)

    return () => {
      if (containerRef.current && mf.parentNode === containerRef.current) {
        containerRef.current.removeChild(mf)
      }
      mathFieldRef.current = null
    }
  }, [isOpen, mathLiveLoaded, initialLatex, onClose, onInsert])

  // Handle insert
  const handleInsert = useCallback(() => {
    if (currentLatex.trim()) {
      onInsert(currentLatex)
    }
    onClose()
  }, [currentLatex, onInsert, onClose])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // Delay to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (typeof document === 'undefined' || !isOpen) return null

  const popupContent = (
    <div
      ref={popupRef}
      className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 w-[400px]"
      style={{ top: position.top, left: position.left }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-xl">
        <h3 className="text-sm font-semibold text-gray-900">{t.title}</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Editor */}
      <div className="p-4">
        <div ref={containerRef} className="mb-3" />

        {/* Tips */}
        <p className="text-xs text-gray-500 mb-4">
          {currentLatex ? t.tip : t.emptyTip}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleInsert}
            disabled={!currentLatex.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            {t.insert}
          </button>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="px-4 py-2 bg-gray-50 rounded-b-xl border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">Ctrl</kbd>
          {' + '}
          <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">Enter</kbd>
          {locale === 'fr' ? ' pour inserer' : ' to insert'}
          {' • '}
          <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">Esc</kbd>
          {locale === 'fr' ? ' pour annuler' : ' to cancel'}
        </p>
      </div>
    </div>
  )

  return createPortal(popupContent, document.body)
}
