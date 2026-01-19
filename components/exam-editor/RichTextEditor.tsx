'use client'

import { useCallback, useRef, useState } from 'react'
import { Eye, EyeOff, ImagePlus, Sigma } from 'lucide-react'
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
  /** Whether to show the math button */
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
    addImage: 'Image',
    uploadImage: 'Envoyer une image',
    imageTip: 'L\'image sera inseree a la position du curseur',
    math: 'Maths',
  },
  en: {
    preview: 'Preview',
    hidePreview: 'Hide',
    addImage: 'Image',
    uploadImage: 'Upload image',
    imageTip: 'Image will be inserted at cursor position',
    math: 'Math',
  },
}

/**
 * RichTextEditor - Text area with math editor and image upload
 *
 * Features:
 * - Simple "Maths" button that opens MathLive WYSIWYG editor
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
  const [showMathPopup, setShowMathPopup] = useState(false)

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
      requestAnimationFrame(() => {
        textarea.focus()
        const newCursorPos = start + text.length
        textarea.setSelectionRange(newCursorPos, newCursorPos)
      })
    },
    [value, onChange]
  )

  // Handle MathLive popup result - insert the final latex
  const handleMathPopupInsert = useCallback(
    (latex: string) => {
      // Wrap in $ delimiters for math rendering
      insertAtCursor(`$${latex}$`)
      setShowMathPopup(false)
    },
    [insertAtCursor]
  )

  // Close math popup
  const handleMathPopupClose = useCallback(() => {
    setShowMathPopup(false)
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
      {(label || showImageUpload || showMathToolbar) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <label htmlFor={id} className="block text-sm font-medium text-gray-700">
              {label}
            </label>
          )}
          <div className="flex items-center gap-1">
            {/* Math button - opens MathLive popup */}
            {showMathToolbar && (
              <button
                ref={mathButtonRef}
                type="button"
                onClick={() => setShowMathPopup(true)}
                disabled={disabled}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600 hover:text-brand-700 hover:bg-brand-50 rounded transition-colors disabled:opacity-50"
                title={t.math}
              >
                <Sigma className="w-4 h-4" />
                <span>{t.math}</span>
              </button>
            )}
            {showImageUpload && (
              <button
                type="button"
                onClick={() => setShowImageModal(!showImageModal)}
                disabled={disabled}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600 hover:text-brand-700 hover:bg-brand-50 rounded transition-colors disabled:opacity-50"
                title={t.addImage}
              >
                <ImagePlus className="w-4 h-4" />
                <span>{t.addImage}</span>
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
                  <span>{t.hidePreview}</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  <span>{t.preview}</span>
                </>
              )}
            </button>
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
        initialLatex=""
        locale={locale}
        anchorElement={mathButtonRef.current}
      />
    </div>
  )
}
