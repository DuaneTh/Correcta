'use client'

import { useCallback, useRef, useState } from 'react'
import { Eye, EyeOff, ImagePlus, Calculator, ChevronDown, ChevronUp } from 'lucide-react'
import MathToolbar from '@/components/exams/MathToolbar'
import ImageUpload from '@/components/ui/ImageUpload'
import QuestionPreview from './QuestionPreview'
import MathLivePopup from './MathLivePopup'

interface RichTextEditorProps {
  /** Current value */
  value: string
  /** Callback when value changes */
  onChange: (value: string) => void
  /** Placeholder text */
  placeholder?: string
  /** Label for the field */
  label?: string
  /** Whether to show the math toolbar */
  showMathToolbar?: boolean
  /** Whether to show image upload option */
  showImageUpload?: boolean
  /** Whether the editor is disabled */
  disabled?: boolean
  /** Locale for labels */
  locale?: 'fr' | 'en'
  /** Minimum height in rows */
  rows?: number
  /** Custom class for the container */
  className?: string
  /** ID for the textarea (for labels) */
  id?: string
  /** Whether to show preview by default */
  defaultShowPreview?: boolean
}

const messages = {
  fr: {
    preview: 'Apercu',
    hidePreview: 'Masquer',
    addImage: 'Ajouter une image',
    uploadImage: 'Envoyer une image',
    mathTip: 'Cliquez sur un symbole pour l\'inserer',
    imageTip: 'L\'image sera inseree a la position du curseur',
    mathSymbols: 'Symboles math',
    showMath: 'Afficher les symboles',
    hideMath: 'Masquer les symboles',
  },
  en: {
    preview: 'Preview',
    hidePreview: 'Hide',
    addImage: 'Add image',
    uploadImage: 'Upload image',
    mathTip: 'Click a symbol to insert it',
    imageTip: 'Image will be inserted at cursor position',
    mathSymbols: 'Math symbols',
    showMath: 'Show symbols',
    hideMath: 'Hide symbols',
  },
}

/**
 * RichTextEditor - Text area with MathToolbar and ImageUpload integration
 *
 * Features:
 * - MathToolbar integration for inserting math symbols
 * - ImageUpload integration for adding images via markdown syntax
 * - Live preview with math rendering
 * - Cursor position tracking for insertions
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  label,
  showMathToolbar = true,
  showImageUpload = true,
  disabled = false,
  locale = 'fr',
  rows = 4,
  className = '',
  id,
  defaultShowPreview = false,
}: RichTextEditorProps) {
  const t = messages[locale]
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mathButtonRef = useRef<HTMLButtonElement>(null)
  const [showPreview, setShowPreview] = useState(defaultShowPreview)
  const [showImageModal, setShowImageModal] = useState(false)
  const [showMathToolbarExpanded, setShowMathToolbarExpanded] = useState(false)
  const [mathToolbarHovered, setMathToolbarHovered] = useState(false)
  const [showMathPopup, setShowMathPopup] = useState(false)
  const [mathPopupInitialLatex, setMathPopupInitialLatex] = useState('')

  // Toolbar is visible when explicitly expanded OR when hovered
  const isMathToolbarVisible = showMathToolbarExpanded || mathToolbarHovered

  // Insert text at current cursor position
  const insertAtCursor = useCallback(
    (text: string) => {
      const textarea = textareaRef.current
      if (!textarea) {
        // Fallback: append to end
        onChange(value + text)
        return
      }

      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      // Build new value with insertion
      const before = value.substring(0, start)
      const after = value.substring(end)
      const newValue = before + text + after

      onChange(newValue)

      // Restore focus and set cursor after inserted text
      // Use requestAnimationFrame to ensure the DOM has updated
      requestAnimationFrame(() => {
        textarea.focus()
        const newCursorPos = start + text.length
        textarea.setSelectionRange(newCursorPos, newCursorPos)
      })
    },
    [value, onChange]
  )

  // Handle math symbol insertion from toolbar - opens MathLive popup for editing
  const handleMathInsert = useCallback(
    (latex: string) => {
      // Clean MathLive placeholders
      const cleanedLatex = latex.replace(/#[@0]/g, '')
      // Open MathLive popup with this latex as initial value
      setMathPopupInitialLatex(cleanedLatex)
      setShowMathPopup(true)
    },
    []
  )

  // Handle MathLive popup result - insert the final latex
  const handleMathPopupInsert = useCallback(
    (latex: string) => {
      // Wrap in $ delimiters for math rendering
      insertAtCursor(`$${latex}$`)
      setShowMathPopup(false)
      setMathPopupInitialLatex('')
    },
    [insertAtCursor]
  )

  // Close math popup
  const handleMathPopupClose = useCallback(() => {
    setShowMathPopup(false)
    setMathPopupInitialLatex('')
  }, [])

  // Handle image upload completion
  const handleImageUpload = useCallback(
    (url: string | null) => {
      if (url) {
        // Insert markdown image syntax
        insertAtCursor(`![image](${url})`)
      }
      setShowImageModal(false)
    },
    [insertAtCursor]
  )

  return (
    <div className={className}>
      {/* Label and controls row */}
      {(label || showImageUpload) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <label htmlFor={id} className="block text-sm font-medium text-gray-700">
              {label}
            </label>
          )}
          <div className="flex items-center gap-2">
            {showImageUpload && (
              <button
                type="button"
                onClick={() => setShowImageModal(!showImageModal)}
                disabled={disabled}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600 hover:text-brand-700 hover:bg-brand-50 rounded transition-colors disabled:opacity-50"
                title={t.addImage}
              >
                <ImagePlus className="w-4 h-4" />
                <span className="hidden sm:inline">{t.addImage}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600 hover:text-brand-700 hover:bg-brand-50 rounded transition-colors"
              title={showPreview ? t.hidePreview : t.preview}
            >
              {showPreview ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  <span className="hidden sm:inline">{t.hidePreview}</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">{t.preview}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Math Toolbar - Collapsible */}
      {showMathToolbar && (
        <div
          className="mb-2"
          onMouseEnter={() => setMathToolbarHovered(true)}
          onMouseLeave={() => setMathToolbarHovered(false)}
        >
          {/* Toggle button - always visible */}
          <button
            ref={mathButtonRef}
            type="button"
            onClick={() => setShowMathToolbarExpanded(!showMathToolbarExpanded)}
            disabled={disabled}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-all ${
              isMathToolbarVisible
                ? 'bg-brand-50 border-brand-300 text-brand-700'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
            } disabled:opacity-50`}
          >
            <Calculator className="w-4 h-4" />
            <span>{t.mathSymbols}</span>
            {showMathToolbarExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {/* Toolbar - visible when expanded or hovered */}
          <div
            className={`mt-2 transition-all duration-200 ${
              isMathToolbarVisible
                ? 'opacity-100 max-h-[500px]'
                : 'opacity-0 max-h-0 overflow-hidden'
            }`}
          >
            <MathToolbar
              onInsert={handleMathInsert}
              disabled={disabled}
              locale={locale}
              size="sm"
              showCategories={true}
            />
          </div>
        </div>
      )}

      {/* Image Upload Modal */}
      {showImageModal && (
        <div className="mb-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
          <ImageUpload
            value={null}
            onChange={handleImageUpload}
            label={t.uploadImage}
            disabled={disabled}
            locale={locale}
          />
          <p className="mt-2 text-xs text-gray-500">{t.imageTip}</p>
        </div>
      )}

      {/* Editor and Preview side by side on larger screens */}
      <div className={`grid gap-4 ${showPreview ? 'lg:grid-cols-2' : ''}`}>
        {/* Textarea */}
        <div>
          <textarea
            ref={textareaRef}
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y font-mono text-sm disabled:opacity-50 disabled:bg-gray-100"
          />
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="border border-gray-200 rounded-lg p-4 bg-white min-h-[120px]">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">{t.preview}</p>
            <QuestionPreview content={value} locale={locale} />
          </div>
        )}
      </div>

      {/* MathLive Popup for WYSIWYG math editing */}
      <MathLivePopup
        isOpen={showMathPopup}
        onClose={handleMathPopupClose}
        onInsert={handleMathPopupInsert}
        initialLatex={mathPopupInitialLatex}
        locale={locale}
        anchorElement={mathButtonRef.current}
      />
    </div>
  )
}
