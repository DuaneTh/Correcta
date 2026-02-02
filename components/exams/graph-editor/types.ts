import {
    GraphAxes,
    GraphPoint,
    GraphLine,
    GraphCurve,
    GraphFunction,
    GraphArea,
    GraphText,
    GraphSegment,
    GraphAnchor,
    GraphStrokeStyle,
    GraphFillStyle,
} from '@/types/exams'

/**
 * Editor mode for the graph editor.
 * - 'simple': Visual drag-and-drop canvas-based editor
 * - 'advanced': Form-based editor with precise numeric controls
 */
export type EditorMode = 'simple' | 'advanced'

/**
 * GraphPayload represents the data structure for graph content,
 * matching GraphSegment but without the 'id' and 'type' fields.
 */
export type GraphPayload = Omit<GraphSegment, 'id' | 'type'>

/**
 * Props interface for both Simple and Advanced graph editors.
 */
export interface GraphEditorProps {
    value: GraphPayload
    onChange: (payload: GraphPayload) => void
    locale?: string
}

// Re-export types from @/types/exams for convenience
export type {
    GraphAxes,
    GraphPoint,
    GraphLine,
    GraphCurve,
    GraphFunction,
    GraphArea,
    GraphText,
    GraphAnchor,
    GraphStrokeStyle,
    GraphFillStyle,
}
