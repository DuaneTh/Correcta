import { PREDEFINED_SHAPES, ShapeTemplate } from './predefinedShapes'

/**
 * Shape categories for organizing predefined shapes.
 */
export type ShapeCategory = 'functions' | 'lines' | 'points' | 'geometric'

/**
 * Localized labels for each category.
 */
export const CATEGORY_LABELS: Record<ShapeCategory, { label: string; labelFr: string }> = {
    functions: {
        label: 'Functions',
        labelFr: 'Fonctions',
    },
    lines: {
        label: 'Lines',
        labelFr: 'Lignes',
    },
    points: {
        label: 'Points',
        labelFr: 'Points',
    },
    geometric: {
        label: 'Geometric',
        labelFr: 'Géométrique',
    },
}

/**
 * Predefined shapes grouped by category.
 */
export const SHAPES_BY_CATEGORY: Record<ShapeCategory, ShapeTemplate[]> = {
    functions: PREDEFINED_SHAPES.filter((shape) => shape.category === 'functions'),
    lines: PREDEFINED_SHAPES.filter((shape) => shape.category === 'lines'),
    points: PREDEFINED_SHAPES.filter((shape) => shape.category === 'points'),
    geometric: PREDEFINED_SHAPES.filter((shape) => shape.category === 'geometric'),
}
