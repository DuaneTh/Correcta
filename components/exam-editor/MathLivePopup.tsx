'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check } from 'lucide-react'

interface MathfieldElement extends HTMLElement {
  value: string
  getValue: (format?: string) => string
  setValue: (latex: string) => void
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
    tip: 'Tapez une formule. Utilisez / pour fraction, ^ pour exposant, _ pour indice.',
  },
  en: {
    title: 'Formula Editor',
    insert: 'Insert',
    cancel: 'Cancel',
    tip: 'Type a formula. Use / for fraction, ^ for superscript, _ for subscript.',
  },
}

/**
 * MathLivePopup - A WYSIWYG math editor popup using MathLive
 *
 * Features:
 * - Arrow key navigation within formulas
 * - Tab to move between fields (numerator/denominator, etc.)
 * - Built-in virtual keyboard for math symbols
 * - Ctrl+Enter to insert, Escape to cancel
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
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState({ top: 100, left: 100 })
  const hasInsertedRef = useRef(false)

  // Track mounted state for portal
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // Calculate position when popup opens
  useEffect(() => {
    if (!isOpen || !anchorElement) return

    const rect = anchorElement.getBoundingClientRect()
    const popupWidth = 420
    const popupHeight = 180

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

  // Create and configure MathLive field
  useEffect(() => {
    if (!isOpen || !containerRef.current) return

    // Reset insert flag when opening
    hasInsertedRef.current = false

    // Clear any existing content
    containerRef.current.innerHTML = ''

    // Dynamically import MathLive
    import('mathlive').then((module) => {
      if (!containerRef.current || !isOpen) return

      // Configure fonts directory
      const mfe = (module as { MathfieldElement?: { fontsDirectory?: string } }).MathfieldElement
      if (mfe) {
        mfe.fontsDirectory = 'https://unpkg.com/mathlive/fonts/'
      }

      // Create math-field element
      const mf = document.createElement('math-field') as MathfieldElement

      // Set initial value
      if (initialLatex) {
        mf.value = initialLatex
      }

      // Style the math field
      mf.style.display = 'block'
      mf.style.width = '100%'
      mf.style.minHeight = '50px'
      mf.style.padding = '12px'
      mf.style.fontSize = '1.25rem'
      mf.style.border = '2px solid #6366f1'
      mf.style.borderRadius = '8px'
      mf.style.backgroundColor = 'white'
      mf.style.outline = 'none'

      // Configure MathLive options via attributes
      mf.setAttribute('virtual-keyboard-mode', 'manual')
      mf.setAttribute('math-virtual-keyboard-policy', 'manual')

      // Store reference
      mathFieldRef.current = mf

      // Keyboard shortcuts
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          e.stopPropagation()
          handleInsertClick()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }
      }

      mf.addEventListener('keydown', handleKeyDown)

      // Append to container
      containerRef.current.appendChild(mf)

      // Focus after a short delay
      setTimeout(() => {
        if (mf && document.body.contains(mf)) {
          mf.focus()
          if (initialLatex) {
            mf.executeCommand('moveToMathfieldEnd')
          }
        }
      }, 100)
    }).catch(console.error)

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
      mathFieldRef.current = null
    }
  }, [isOpen]) // Only depend on isOpen, not initialLatex or callbacks

  // Handle insert button click
  const handleInsertClick = useCallback(() => {
    if (hasInsertedRef.current) return

    const mf = mathFieldRef.current
    if (mf) {
      const latex = mf.getValue('latex')
      if (latex && latex.trim()) {
        hasInsertedRef.current = true
        onInsert(latex)
      }
    }
    onClose()
  }, [onInsert, onClose])

  // Close on click outside
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
    }, 150)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Show virtual keyboard
  const showVirtualKeyboard = useCallback(() => {
    if (typeof window !== 'undefined' && (window as unknown as { mathVirtualKeyboard?: { show: () => void } }).mathVirtualKeyboard) {
      (window as unknown as { mathVirtualKeyboard: { show: () => void } }).mathVirtualKeyboard.show()
    }
  }, [])

  if (!mounted || !isOpen) return null

  const popupContent = (
    <div
      ref={popupRef}
      className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200"
      style={{ top: position.top, left: position.left, width: 420 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50 rounded-t-xl">
        <h3 className="text-sm font-semibold text-gray-900">{t.title}</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
          type="button"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Editor */}
      <div className="p-4">
        <div ref={containerRef} className="mb-3" />

        {/* Virtual keyboard button */}
        <button
          type="button"
          onClick={showVirtualKeyboard}
          className="mb-3 text-xs text-brand-600 hover:text-brand-700 hover:underline"
        >
          {locale === 'fr' ? 'Afficher le clavier virtuel' : 'Show virtual keyboard'}
        </button>

        {/* Tips */}
        <p className="text-xs text-gray-500 mb-3">{t.tip}</p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400">
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">Ctrl+Enter</kbd>
            {locale === 'fr' ? ' inserer' : ' insert'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleInsertClick}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            >
              <Check className="w-4 h-4" />
              {t.insert}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(popupContent, document.body)
}
