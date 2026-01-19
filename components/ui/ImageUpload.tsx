'use client'

import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react'
import { Upload, X, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react'

interface ImageUploadProps {
  /** Current image URL (null if no image) */
  value: string | null
  /** Callback when image is uploaded or removed */
  onChange: (url: string | null) => void
  /** Optional label above the dropzone */
  label?: string
  /** Whether upload is disabled */
  disabled?: boolean
  /** Locale for messages */
  locale?: 'fr' | 'en'
  /** Custom class for the container */
  className?: string
}

const messages = {
  fr: {
    dragDrop: 'Glissez une image ou',
    clickToUpload: 'cliquez pour parcourir',
    uploading: 'Envoi en cours...',
    remove: 'Supprimer',
    maxSize: 'Max 10 Mo - JPEG, PNG, GIF, WebP, SVG',
    errorGeneric: "Erreur lors de l'envoi",
    errorType: 'Type de fichier non autorise',
    errorSize: 'Fichier trop volumineux',
    errorAuth: 'Authentification requise',
  },
  en: {
    dragDrop: 'Drag and drop an image or',
    clickToUpload: 'click to browse',
    uploading: 'Uploading...',
    remove: 'Remove',
    maxSize: 'Max 10 MB - JPEG, PNG, GIF, WebP, SVG',
    errorGeneric: 'Upload failed',
    errorType: 'Invalid file type',
    errorSize: 'File too large',
    errorAuth: 'Authentication required',
  },
}

export default function ImageUpload({
  value,
  onChange,
  label,
  disabled = false,
  locale = 'fr',
  className = '',
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const t = messages[locale]

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const uploadFile = useCallback(async (file: File) => {
    setError(null)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        if (response.status === 401) {
          throw new Error(t.errorAuth)
        }
        if (response.status === 400 && data.error?.includes('type')) {
          throw new Error(t.errorType)
        }
        if (response.status === 400 && data.error?.includes('large')) {
          throw new Error(t.errorSize)
        }
        throw new Error(data.error || t.errorGeneric)
      }

      const { url } = await response.json()
      onChange(url)
    } catch (err) {
      const message = err instanceof Error ? err.message : t.errorGeneric
      setError(message)
    } finally {
      setIsUploading(false)
    }
  }, [onChange, t])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled || isUploading) return

    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      uploadFile(files[0])
    }
  }, [disabled, isUploading, uploadFile])

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      uploadFile(files[0])
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }, [uploadFile])

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click()
    }
  }, [disabled, isUploading])

  const handleRemove = useCallback(() => {
    onChange(null)
    setError(null)
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }, [handleClick])

  // If we have an image, show preview
  if (value) {
    return (
      <div className={className}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {label}
          </label>
        )}
        <div className="relative group rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
          <img
            src={value}
            alt="Uploaded"
            className="w-full max-h-64 object-contain"
          />
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-full shadow-sm border border-gray-200 text-gray-600 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
              title={t.remove}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // Empty state - show dropzone
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`
          relative flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed transition-colors cursor-pointer
          ${isDragging ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${error ? 'border-red-300 bg-red-50' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {isUploading ? (
          <>
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-2" />
            <span className="text-sm text-gray-600">{t.uploading}</span>
          </>
        ) : error ? (
          <>
            <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
            <span className="text-sm text-red-600">{error}</span>
            <span className="text-xs text-gray-500 mt-1">{t.maxSize}</span>
          </>
        ) : (
          <>
            {isDragging ? (
              <ImageIcon className="w-8 h-8 text-brand-500 mb-2" />
            ) : (
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
            )}
            <span className="text-sm text-gray-600">
              {t.dragDrop}{' '}
              <span className="text-brand-600 font-medium">{t.clickToUpload}</span>
            </span>
            <span className="text-xs text-gray-400 mt-1">{t.maxSize}</span>
          </>
        )}
      </div>
    </div>
  )
}

export { type ImageUploadProps }
