export type QuestionType = 'TEXT' | 'MCQ' | 'CODE'

export type TableCell = ContentSegment[]

export type StudentMathSymbolSet = 'basic' | 'full'

export type StudentToolsConfig = {
    math?: {
        enabled?: boolean
        symbolSet?: StudentMathSymbolSet
    }
    table?: {
        enabled?: boolean
        maxRows?: number | null
        maxCols?: number | null
        allowMath?: boolean
    }
    graph?: {
        enabled?: boolean
        allowPoints?: boolean
        allowLines?: boolean
        allowCurves?: boolean
        allowFunctions?: boolean
        allowAreas?: boolean
        allowText?: boolean
    }
}

export type TableSegment = {
    id: string
    type: 'table'
    rows: TableCell[][]
    colWidths?: number[]
    rowHeights?: number[]
}

export type GraphAxes = {
    xMin: number
    xMax: number
    yMin: number
    yMax: number
    xLabel?: string
    yLabel?: string
    xLabelIsMath?: boolean
    yLabelIsMath?: boolean
    xLabelSegments?: ContentSegment[]
    yLabelSegments?: ContentSegment[]
    showGrid?: boolean
    xStep?: number
    yStep?: number
    gridStep?: number
}

export type GraphAnchor =
    | { type: 'point'; pointId: string }
    | { type: 'coord'; x: number; y: number }

export type GraphStrokeStyle = {
    color?: string
    width?: number
    dashed?: boolean
    opacity?: number
}

export type GraphFillStyle = {
    color?: string
    opacity?: number
}

export type GraphPointAnchor =
    | { type: 'coord' }
    | { type: 'line'; lineId: string; t: number }
    | { type: 'curve'; curveId: string; t: number }
    | { type: 'function'; functionId: string; x: number }

export type GraphPoint = {
    id: string
    x: number
    y: number
    anchor?: GraphPointAnchor
    label?: string
    labelIsMath?: boolean
    labelSegments?: ContentSegment[]
    showLabel?: boolean
    labelPos?: { x: number; y: number }
    labelSize?: number
    color?: string
    size?: number
    filled?: boolean
}

export type GraphLine = {
    id: string
    label?: string
    labelIsMath?: boolean
    labelSegments?: ContentSegment[]
    showLabel?: boolean
    labelPos?: { x: number; y: number }
    start: GraphAnchor
    end: GraphAnchor
    kind: 'segment' | 'line' | 'ray'
    style?: GraphStrokeStyle
}

export type GraphCurve = {
    id: string
    label?: string
    labelIsMath?: boolean
    labelSegments?: ContentSegment[]
    showLabel?: boolean
    labelPos?: { x: number; y: number }
    start: GraphAnchor
    end: GraphAnchor
    curvature: number
    style?: GraphStrokeStyle
}

export type GraphFunction = {
    id: string
    label?: string
    labelIsMath?: boolean
    labelSegments?: ContentSegment[]
    showLabel?: boolean
    labelPos?: { x: number; y: number }
    expression: string
    domain?: { min?: number; max?: number }
    /** Horizontal offset for translating the function (shifts the curve right) */
    offsetX?: number
    /** Vertical offset for translating the function (shifts the curve up) */
    offsetY?: number
    /** Vertical scale factor (controls opening angle for parabolas, default 1) */
    scaleY?: number
    style?: GraphStrokeStyle
}

export type GraphArea = {
    id: string
    /** Display label for the area (e.g., "A" or "\mathcal{A}") */
    label?: string
    /** If true, label is rendered as LaTeX math */
    labelIsMath?: boolean
    labelSegments?: ContentSegment[]
    /** Whether to show the label (default: true) */
    showLabel?: boolean
    /** Position of the label/control point in graph coordinates */
    labelPos?: { x: number; y: number }
    /**
     * How the area polygon is determined:
     * - 'polygon': Direct point list
     * - 'under-function': Area between function and y=0
     * - 'between-functions': Area between two functions
     * - 'between-line-and-function': Area between a line and function
     * - 'bounded-region': Area bounded by mix of functions, lines, axes
     */
    mode: 'polygon' | 'under-function' | 'between-functions' | 'between-line-and-function' | 'bounded-region'
    /** Direct polygon points (used when mode='polygon' or as cached result) */
    points?: GraphAnchor[]
    /** Primary function ID (for under-function, between-functions, between-line-and-function) */
    functionId?: string
    /** Secondary function ID (for between-functions mode) */
    functionId2?: string
    /** Line ID (for between-line-and-function mode) */
    lineId?: string
    /** All element IDs that bound this area (for bounded-region mode) */
    boundaryIds?: string[]
    /** X-axis domain for area calculation */
    domain?: { min?: number; max?: number }
    /** Fill style (color, opacity) */
    fill?: GraphFillStyle
    /**
     * Element IDs to ignore as boundaries (for "extend" feature).
     * When set, area extends across these boundaries to fill adjacent regions.
     */
    ignoredBoundaries?: string[]
}

export type GraphText = {
    id: string
    x: number
    y: number
    text: string
    isMath?: boolean
    textSegments?: ContentSegment[]
}

export type GraphSegment = {
    id: string
    type: 'graph'
    axes: GraphAxes
    points: GraphPoint[]
    lines: GraphLine[]
    curves: GraphCurve[]
    functions: GraphFunction[]
    areas: GraphArea[]
    texts: GraphText[]
    width?: number
    height?: number
    background?: string
}

export type ImageSegment = {
    id: string
    type: 'image'
    url: string
    alt?: string
}

export type ContentSegment =
    | { id: string; type: 'text'; text: string }
    | { id: string; type: 'math'; latex: string }
    | ImageSegment
    | TableSegment
    | GraphSegment

export type ContentSegments = ContentSegment[]

export interface RubricLevel {
    label?: string
    description?: string
    points?: number
}

export interface Rubric {
    id: string
    criteria: string
    levels: RubricLevel[]
    examples?: string[] | string
}

export interface Segment {
    id: string
    order?: number
    instruction: string
    maxPoints: number | null
    isCorrect?: boolean
    rubric?: Rubric | null
}

export interface Question {
    id: string
    content: ContentSegments
    answerTemplate?: ContentSegments
    answerTemplateLocked?: boolean
    studentTools?: StudentToolsConfig | null
    shuffleOptions?: boolean
    type: QuestionType
    order: number
    customLabel?: string | null
    requireAllCorrect?: boolean
    maxPoints?: number | null
    segments: Segment[]
}

export interface Section {
    id: string
    title: string
    order: number
    isDefault?: boolean
    customLabel?: string | null
    introContent?: ContentSegment[] | string | null
    questions: Question[]
}

export interface Exam {
    id: string
    title: string
    startAt: string | null
    endAt?: string | null
    durationMinutes: number | null
    updatedAt?: string | Date
    status?: 'DRAFT' | 'PUBLISHED'
    parentExamId?: string | null
    classId?: string | null
    classIds?: string[]
    className?: string | null
    variants?: Array<{
        id: string
        classId: string
        className: string | null
        startAt: string | null
        endAt?: string | null
        durationMinutes: number | null
        status?: 'DRAFT' | 'PUBLISHED'
    }>
    draftVariantsCount?: number
    draftVariantsBySection?: Array<{
        id: string
        classId: string
        title: string
        updatedAt: string | Date
        className?: string | null
    }>
    baseExamId?: string | null
    baseExamTitle?: string | null
    courseSections?: Array<{
        id: string
        name: string
        canEdit?: boolean
    }>
    canEdit?: boolean
    courseId: string
    course: {
        code: string
        name: string
        teacherName?: string | null
    }
    author?: {
        id: string
        name: string | null
        email: string
    } | null
    requireHonorCommitment?: boolean
    allowedMaterials?: string | null
    gradingConfig?: {
        correctionReleaseEnabled?: boolean
        correctionReleaseOnEnd?: boolean
        correctionReleaseAt?: string | null
        correctionReleasedAt?: string | null
        gradesReleased?: boolean
        gradesReleasedAt?: string | null
    } | null
    changes?: ExamChange[]
    sections: Section[]
}

export type ExamChange = {
    id: string
    entityType: 'EXAM' | 'SECTION' | 'QUESTION' | 'SEGMENT'
    entityId: string
    entityLabel?: string | null
    field: string
    beforeValue?: unknown
    afterValue?: unknown
    createdAt: string
}

export interface ValidationErrors {
    title?: boolean
    date?: boolean
    datePast?: boolean
    duration?: boolean
    correctionReleaseAtInvalid?: boolean
    correctionReleaseAtPast?: boolean
    correctionReleaseAtBeforeStart?: boolean
    correctionReleaseAtBeforeEnd?: boolean
    hasQuestions?: boolean
    questions: Array<{
        questionId: string
        sectionId: string
        missingContent?: boolean
        missingLabel?: boolean
        missingPoints?: boolean
        missingMcqOptions?: boolean
        missingMcqOptionText?: Array<{ segmentId: string }>
        missingMcqOptionPoints?: Array<{ segmentId: string }>
        mcqTotalPointsMismatch?: boolean
        mcqMissingCorrectOptions?: boolean
    }>
}
