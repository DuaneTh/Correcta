'use client'

import React from 'react'
import { ShapeTemplate } from './templates/predefinedShapes'
import { SHAPES_BY_CATEGORY, CATEGORY_LABELS, ShapeCategory } from './templates/shapeCategories'

interface ShapePaletteProps {
    onAddShape: (template: ShapeTemplate) => void
    locale?: string
}

/**
 * ShapePalette displays categorized predefined shapes for quick insertion.
 * Renders shapes grouped by category with localized labels.
 */
export const ShapePalette: React.FC<ShapePaletteProps> = ({ onAddShape, locale = 'fr' }) => {
    const isFrench = locale === 'fr'
    const categories: ShapeCategory[] = ['functions', 'lines', 'points', 'geometric']

    return (
        <div className="w-48 border-r border-gray-200 bg-white overflow-y-auto max-h-full p-3 space-y-4">
            <div className="text-sm font-medium text-gray-800 mb-2">
                {isFrench ? 'Palette de formes' : 'Shape Palette'}
            </div>

            {categories.map((category) => {
                const shapes = SHAPES_BY_CATEGORY[category]
                if (!shapes || shapes.length === 0) return null

                const categoryLabel = isFrench
                    ? CATEGORY_LABELS[category].labelFr
                    : CATEGORY_LABELS[category].label

                return (
                    <div key={category} className="space-y-2">
                        <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                            {categoryLabel}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {shapes.map((shape) => {
                                const label = isFrench ? shape.labelFr : shape.label
                                return (
                                    <button
                                        key={shape.id}
                                        type="button"
                                        onClick={() => onAddShape(shape)}
                                        className="flex flex-col items-center justify-center p-2 border border-gray-200 rounded hover:bg-gray-50 hover:border-indigo-300 transition-colors"
                                        title={isFrench ? shape.descriptionFr : shape.description}
                                    >
                                        <span className="text-2xl mb-1">{shape.icon}</span>
                                        <span className="text-[10px] text-gray-700 text-center leading-tight">
                                            {label}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
