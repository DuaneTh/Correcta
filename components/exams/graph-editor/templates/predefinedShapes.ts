import { GraphAxes } from '@/types/exams'
import { GraphPayload } from '../types'
import { ShapeCategory } from './shapeCategories'

/**
 * Utility to generate unique IDs for graph elements.
 */
function createId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return `seg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Template for creating predefined shapes.
 */
export interface ShapeTemplate {
    id: string
    category: ShapeCategory
    label: string
    labelFr: string
    icon: string
    description: string
    descriptionFr: string
    createElements: (axes: GraphAxes) => Partial<GraphPayload>
}

/**
 * Library of 12 predefined shapes across 4 categories.
 */
export const PREDEFINED_SHAPES: ShapeTemplate[] = [
    // Functions (4)
    {
        id: 'parabola',
        category: 'functions',
        label: 'Parabola',
        labelFr: 'Parabole',
        icon: '∩',
        description: 'Quadratic function: x²',
        descriptionFr: 'Fonction quadratique : x²',
        createElements: (axes) => ({
            functions: [
                {
                    id: createId(),
                    expression: 'x^2',
                    domain: { min: axes.xMin, max: axes.xMax },
                    style: { color: '#2563eb', width: 1.5 },
                },
            ],
        }),
    },
    {
        id: 'sine',
        category: 'functions',
        label: 'Sine Wave',
        labelFr: 'Sinusoïde',
        icon: '∿',
        description: 'Trigonometric function: sin(x)',
        descriptionFr: 'Fonction trigonométrique : sin(x)',
        createElements: (axes) => ({
            functions: [
                {
                    id: createId(),
                    expression: 'sin(x)',
                    domain: { min: axes.xMin, max: axes.xMax },
                    style: { color: '#2563eb', width: 1.5 },
                },
            ],
        }),
    },
    {
        id: 'linear',
        category: 'functions',
        label: 'Linear',
        labelFr: 'Linéaire',
        icon: '/',
        description: 'Linear function: x',
        descriptionFr: 'Fonction linéaire : x',
        createElements: (axes) => ({
            functions: [
                {
                    id: createId(),
                    expression: 'x',
                    domain: { min: axes.xMin, max: axes.xMax },
                    style: { color: '#2563eb', width: 1.5 },
                },
            ],
        }),
    },
    {
        id: 'exponential',
        category: 'functions',
        label: 'Exponential',
        labelFr: 'Exponentielle',
        icon: 'eˣ',
        description: 'Exponential function: exp(x)',
        descriptionFr: 'Fonction exponentielle : exp(x)',
        createElements: (axes) => ({
            functions: [
                {
                    id: createId(),
                    expression: 'exp(x)',
                    domain: { min: axes.xMin, max: axes.xMax },
                    style: { color: '#2563eb', width: 1.5 },
                },
            ],
        }),
    },

    // Lines (3)
    {
        id: 'vertical-asymptote',
        category: 'lines',
        label: 'Vertical Asymptote',
        labelFr: 'Asymptote verticale',
        icon: '|',
        description: 'Dashed vertical line at x=0',
        descriptionFr: 'Ligne verticale pointillée à x=0',
        createElements: (axes) => ({
            lines: [
                {
                    id: createId(),
                    kind: 'line',
                    start: { type: 'coord', x: 0, y: axes.yMin },
                    end: { type: 'coord', x: 0, y: axes.yMax },
                    style: { color: '#111827', width: 1.5, dashed: true, opacity: 0.7 },
                },
            ],
        }),
    },
    {
        id: 'horizontal-asymptote',
        category: 'lines',
        label: 'Horizontal Asymptote',
        labelFr: 'Asymptote horizontale',
        icon: '—',
        description: 'Dashed horizontal line at y=0',
        descriptionFr: 'Ligne horizontale pointillée à y=0',
        createElements: (axes) => ({
            lines: [
                {
                    id: createId(),
                    kind: 'line',
                    start: { type: 'coord', x: axes.xMin, y: 0 },
                    end: { type: 'coord', x: axes.xMax, y: 0 },
                    style: { color: '#111827', width: 1.5, dashed: true, opacity: 0.7 },
                },
            ],
        }),
    },
    {
        id: 'segment',
        category: 'lines',
        label: 'Segment',
        labelFr: 'Segment',
        icon: '—',
        description: 'Line segment from (-2,0) to (2,0)',
        descriptionFr: 'Segment de ligne de (-2,0) à (2,0)',
        createElements: () => ({
            lines: [
                {
                    id: createId(),
                    kind: 'segment',
                    start: { type: 'coord', x: -2, y: 0 },
                    end: { type: 'coord', x: 2, y: 0 },
                    style: { color: '#111827', width: 1.5 },
                },
            ],
        }),
    },

    // Points (2)
    {
        id: 'filled-point',
        category: 'points',
        label: 'Filled Point',
        labelFr: 'Point simple',
        icon: '●',
        description: 'Filled point at origin',
        descriptionFr: 'Point rempli à l\'origine',
        createElements: () => ({
            points: [
                {
                    id: createId(),
                    x: 0,
                    y: 0,
                    color: '#111827',
                    size: 4,
                    filled: true,
                    label: '',
                },
            ],
        }),
    },
    {
        id: 'open-point',
        category: 'points',
        label: 'Open Point',
        labelFr: 'Point ouvert',
        icon: '○',
        description: 'Unfilled point at origin',
        descriptionFr: 'Point vide à l\'origine',
        createElements: () => ({
            points: [
                {
                    id: createId(),
                    x: 0,
                    y: 0,
                    color: '#111827',
                    size: 4,
                    filled: false,
                    label: '',
                },
            ],
        }),
    },

    // Geometric (3)
    {
        id: 'bezier-curve',
        category: 'geometric',
        label: 'Bezier Curve',
        labelFr: 'Courbe de Bézier',
        icon: '⌢',
        description: 'Curved line from (-3,-1) to (3,1)',
        descriptionFr: 'Courbe de (-3,-1) à (3,1)',
        createElements: () => ({
            curves: [
                {
                    id: createId(),
                    start: { type: 'coord', x: -3, y: -1 },
                    end: { type: 'coord', x: 3, y: 1 },
                    curvature: 2,
                    style: { color: '#7c3aed', width: 1.5 },
                },
            ],
        }),
    },
    {
        id: 'polygon-triangle',
        category: 'geometric',
        label: 'Polygon Surface',
        labelFr: 'Surface polygone',
        icon: '▲',
        description: 'Triangular shaded area',
        descriptionFr: 'Surface triangulaire',
        createElements: () => ({
            areas: [
                {
                    id: createId(),
                    mode: 'polygon',
                    points: [
                        { type: 'coord', x: -2, y: 0 },
                        { type: 'coord', x: 0, y: 2 },
                        { type: 'coord', x: 2, y: 0 },
                    ],
                    fill: { color: '#6366f1', opacity: 0.2 },
                },
            ],
        }),
    },
    {
        id: 'area-under-curve',
        category: 'geometric',
        label: 'Area Under Curve',
        labelFr: 'Surface sous courbe',
        icon: '⌠',
        description: 'Shaded area under x² function',
        descriptionFr: 'Surface sous la fonction x²',
        createElements: (axes) => {
            const functionId = createId()
            return {
                functions: [
                    {
                        id: functionId,
                        expression: 'x^2',
                        domain: { min: axes.xMin, max: axes.xMax },
                        style: { color: '#2563eb', width: 1.5 },
                    },
                ],
                areas: [
                    {
                        id: createId(),
                        mode: 'under-function',
                        functionId,
                        domain: { min: -2, max: 2 },
                        fill: { color: '#2563eb', opacity: 0.2 },
                    },
                ],
            }
        },
    },
]
