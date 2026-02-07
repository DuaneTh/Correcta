'use client'

import React, { useCallback, useState } from 'react'
import { GraphStrokeStyle } from '@/types/exams'

interface StrokePropertiesPanelProps {
  style?: GraphStrokeStyle
  onStyleChange: (style: GraphStrokeStyle) => void
  locale?: string
}

const PRESET_COLORS = [
  { id: 'black', hex: '#000000', name: { fr: 'Noir', en: 'Black' } },
  { id: 'purple', hex: '#8b5cf6', name: { fr: 'Violet', en: 'Purple' } },
  { id: 'blue', hex: '#3b82f6', name: { fr: 'Bleu', en: 'Blue' } },
  { id: 'green', hex: '#22c55e', name: { fr: 'Vert', en: 'Green' } },
  { id: 'red', hex: '#ef4444', name: { fr: 'Rouge', en: 'Red' } },
  { id: 'gray', hex: '#6b7280', name: { fr: 'Gris', en: 'Gray' } },
]

export const StrokePropertiesPanel = React.memo<StrokePropertiesPanelProps>(({
  style,
  onStyleChange,
  locale = 'fr',
}) => {
  const isFrench = locale === 'fr'
  const currentColor = style?.color || '#000000'
  const currentWidth = style?.width ?? 2
  const isDashed = style?.dashed ?? false

  const handleColorChange = useCallback((color: string) => {
    onStyleChange({ ...style, color })
  }, [style, onStyleChange])

  const handleDashedToggle = useCallback(() => {
    onStyleChange({ ...style, dashed: !isDashed })
  }, [style, isDashed, onStyleChange])

  // Local state for free-form keyboard editing of width
  const [widthInput, setWidthInput] = useState<string | null>(null)

  const handleWidthInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setWidthInput(raw)
    const w = Number(raw)
    if (!isNaN(w) && w >= 0.5 && w <= 8) {
      onStyleChange({ ...style, width: w })
    }
  }, [style, onStyleChange])

  const handleWidthBlur = useCallback(() => {
    const w = Number(widthInput)
    if (!isNaN(w) && w >= 0.5 && w <= 8) {
      onStyleChange({ ...style, width: w })
    }
    setWidthInput(null)
  }, [widthInput, style, onStyleChange])

  return (
    <div className="flex-1 flex items-center gap-4 flex-wrap">
      {/* Color presets */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-gray-600">
          {isFrench ? 'Couleur' : 'Color'}
        </span>
        {PRESET_COLORS.map(preset => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handleColorChange(preset.hex)}
            className={`w-5 h-5 rounded-full border-2 transition-all ${
              currentColor === preset.hex
                ? 'border-gray-700 scale-110 shadow-sm'
                : 'border-gray-300 hover:border-gray-500'
            }`}
            style={{ backgroundColor: preset.hex }}
            title={isFrench ? preset.name.fr : preset.name.en}
          />
        ))}
        <input
          type="color"
          value={currentColor}
          onInput={(e) => handleColorChange((e.target as HTMLInputElement).value)}
          onChange={(e) => handleColorChange(e.target.value)}
          className="w-5 h-5 rounded cursor-pointer border border-gray-300"
          title={isFrench ? 'Couleur personnalisée' : 'Custom color'}
        />
      </div>

      {/* Dashed toggle */}
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={isDashed}
          onChange={handleDashedToggle}
          className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-xs text-gray-600">
          {isFrench ? 'Pointillés' : 'Dashed'}
        </span>
      </label>

      {/* Width */}
      <label className="flex items-center gap-1.5">
        <span className="text-xs text-gray-600">
          {isFrench ? 'Épaisseur' : 'Width'}
        </span>
        <input
          type="number"
          value={widthInput ?? currentWidth}
          onChange={handleWidthInput}
          onBlur={handleWidthBlur}
          onFocus={(e) => setWidthInput(e.target.value)}
          min={0.5}
          max={8}
          step={0.5}
          className="w-14 border border-gray-200 rounded px-1 py-0.5 text-xs"
        />
      </label>
    </div>
  )
})

StrokePropertiesPanel.displayName = 'StrokePropertiesPanel'
