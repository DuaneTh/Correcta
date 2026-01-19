'use client'

import { useMemo } from 'react'
import MathRenderer from '@/components/exams/MathRenderer'

interface QuestionPreviewProps {
  /** Content with Markdown-style images and $...$ math delimiters */
  content: string
  /** Optional class for the container */
  className?: string
  /** Locale for empty state message */
  locale?: 'fr' | 'en'
}

const messages = {
  fr: {
    empty: 'Aucun contenu',
  },
  en: {
    empty: 'No content',
  },
}

/**
 * Parse markdown image syntax and render as images
 * Format: ![alt](url)
 */
function parseImagesAndText(text: string): Array<{ type: 'text' | 'image'; content: string; alt?: string }> {
  const result: Array<{ type: 'text' | 'image'; content: string; alt?: string }> = []
  // Regex to match ![alt](url) pattern
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = imageRegex.exec(text)) !== null) {
    // Add text before image
    if (match.index > lastIndex) {
      result.push({ type: 'text', content: text.substring(lastIndex, match.index) })
    }
    // Add image
    result.push({ type: 'image', content: match[2], alt: match[1] })
    lastIndex = imageRegex.lastIndex
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push({ type: 'text', content: text.substring(lastIndex) })
  }

  return result
}

/**
 * QuestionPreview - Renders question content with math and images
 *
 * Supports:
 * - Math notation with $...$ delimiters (via MathRenderer)
 * - Images with markdown syntax ![alt](url)
 * - Plain text
 */
export default function QuestionPreview({
  content,
  className = '',
  locale = 'fr',
}: QuestionPreviewProps) {
  const t = messages[locale]

  const parsedContent = useMemo(() => {
    if (!content || !content.trim()) {
      return null
    }
    return parseImagesAndText(content)
  }, [content])

  if (!parsedContent) {
    return (
      <div className={`text-sm text-gray-400 italic ${className}`}>
        {t.empty}
      </div>
    )
  }

  return (
    <div className={`whitespace-pre-wrap ${className}`}>
      {parsedContent.map((part, index) => {
        if (part.type === 'image') {
          return (
            <span key={index} className="inline-block my-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={part.content}
                alt={part.alt || 'Image'}
                className="max-w-full max-h-64 rounded border border-gray-200"
              />
            </span>
          )
        }
        // Text parts - render with MathRenderer to handle $...$ syntax
        return (
          <MathRenderer
            key={index}
            text={part.content}
            className="inline"
          />
        )
      })}
    </div>
  )
}
