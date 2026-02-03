'use client'

import React, { useCallback } from 'react'
import { GraphArea } from '@/types/exams'

interface AreaPropertiesPanelProps {
  area: GraphArea
  onUpdate: (updated: GraphArea) => void
  locale?: string
}

const PRESET_COLORS = [
  { id: 'purple', hex: '#8b5cf6', name: { fr: 'Violet', en: 'Purple' } },
  { id: 'blue', hex: '#3b82f6', name: { fr: 'Bleu', en: 'Blue' } },
  { id: 'green', hex: '#22c55e', name: { fr: 'Vert', en: 'Green' } },
  { id: 'yellow', hex: '#eab308', name: { fr: 'Jaune', en: 'Yellow' } },
  { id: 'red', hex: '#ef4444', name: { fr: 'Rouge', en: 'Red' } },
  { id: 'gray', hex: '#6b7280', name: { fr: 'Gris', en: 'Gray' } },
]

export const AreaPropertiesPanel = React.memo<AreaPropertiesPanelProps>(({
  area,
  onUpdate,
  locale = 'fr',
}) => {
  const isFrench = locale === 'fr'

  // Current values
  const currentColor = area.fill?.color || '#8b5cf6'
  const currentOpacity = Math.round((area.fill?.opacity ?? 0.35) * 100)
  const currentLabel = area.label || ''
  const labelIsMath = area.labelIsMath ?? false
  const showLabel = area.showLabel ?? false

  // Handlers
  const handleLabelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({
      ...area,
      label: e.target.value,
    })
  }, [area, onUpdate])

  const handleMathToggle = useCallback(() => {
    onUpdate({
      ...area,
      labelIsMath: !labelIsMath,
    })
  }, [area, labelIsMath, onUpdate])

  const handleShowLabelToggle = useCallback(() => {
    onUpdate({
      ...area,
      showLabel: !showLabel,
    })
  }, [area, showLabel, onUpdate])

  const handleColorChange = useCallback((color: string) => {
    onUpdate({
      ...area,
      fill: {
        ...area.fill,
        color,
      },
    })
  }, [area, onUpdate])

  const handleOpacityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const percentage = Number(e.target.value)
    onUpdate({
      ...area,
      fill: {
        ...area.fill,
        opacity: percentage / 100,
      },
    })
  }, [area, onUpdate])

  return (
    <div className="flex-1 space-y-3 text-sm">
      {/* Label section */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-medium text-gray-600 uppercase">
          {isFrench ? 'Étiquette' : 'Label'}
        </h4>
        <input
          type="text"
          value={currentLabel}
          onChange={handleLabelChange}
          placeholder={isFrench ? 'Ex: A, Région 1' : 'Ex: A, Region 1'}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={labelIsMath}
              onChange={handleMathToggle}
              className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs text-gray-600">
              {isFrench ? 'Formule math' : 'Math formula'}
            </span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showLabel}
              onChange={handleShowLabelToggle}
              className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs text-gray-600">
              {isFrench ? 'Afficher' : 'Show'}
            </span>
          </label>
        </div>
      </div>

      {/* Color section */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-medium text-gray-600 uppercase">
          {isFrench ? 'Couleur' : 'Color'}
        </h4>
        <div className="flex gap-2">
          {PRESET_COLORS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleColorChange(preset.hex)}
              className={`w-6 h-6 rounded border-2 transition-all ${
                currentColor === preset.hex
                  ? 'border-gray-700 scale-110 shadow-md'
                  : 'border-gray-300 hover:border-gray-500'
              }`}
              style={{ backgroundColor: preset.hex }}
              title={isFrench ? preset.name.fr : preset.name.en}
              aria-label={isFrench ? preset.name.fr : preset.name.en}
            />
          ))}
        </div>
      </div>

      {/* Opacity section */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-gray-600 uppercase">
            {isFrench ? 'Opacité' : 'Opacity'}
          </h4>
          <span className="text-xs text-gray-500 font-medium">
            {currentOpacity}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={currentOpacity}
          onChange={handleOpacityChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  )
})

AreaPropertiesPanel.displayName = 'AreaPropertiesPanel'
