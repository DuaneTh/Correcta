import { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback, type ReactNode } from 'react'
import { ChevronDown, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { Exam, Question, QuestionType, ValidationErrors, Segment, ContentSegment, StudentToolsConfig, StudentMathSymbolSet } from '@/types/exams'
import SegmentedMathField from '@/components/exams/SegmentedMathField'
import StringMathField from '@/components/exams/StringMathField'
import { PreviewToggle } from '@/components/exams/builder/PreviewToggle'
import { parseContent, segmentsToPlainText } from '@/lib/content'

interface SectionListProps {
    viewMode: 'default' | 'focus'
    onViewModeChange: (mode: 'default' | 'focus') => void
    onSelectedNodeChange: (nodeId: string | null) => void
    focusPreview?: ReactNode
    liveExam: Exam
    dict: Record<string, string>
    locale: string
    isLocked: boolean
    loading: boolean
    validationDetails: ValidationErrors | null
    showValidationUI: boolean
    previewEnabled: boolean
    onPreviewToggle: (enabled: boolean) => void
    addSection: (atTop?: boolean, afterQuestionId?: string, afterSectionId?: string, isDefault?: boolean) => Promise<string | null>
    addQuestion: (
        sectionId?: string,
        type?: QuestionType,
        atTop?: boolean,
        afterQuestionId?: string,
        outsideSection?: boolean
    ) => Promise<void>
    addSegment: (questionId: string) => Promise<void>
    updateSection: (sectionId: string, data: { title?: string; customLabel?: string | null; order?: number; introContent?: ContentSegment[] | string | null }) => Promise<void>
    updateQuestion: (sectionId: string, questionId: string, data: Partial<Question> & { targetSectionId?: string; targetOrder?: number }) => Promise<void>
    updateSegment: (questionId: string, segmentId: string, data: { instruction?: string; maxPoints?: number | null; rubric?: Segment['rubric'] }) => Promise<void>
    deleteSegment: (questionId: string, segmentId: string) => Promise<void>
    deleteQuestion: (sectionId: string, questionId: string) => Promise<void>
    deleteSection: (sectionId: string) => Promise<void>
    updateLiveQuestionContent: (sectionId: string, questionId: string, content: ContentSegment[]) => void
    updateLiveQuestionLabel: (sectionId: string, questionId: string, label: string | null) => void
    updateLiveQuestionMaxPoints: (sectionId: string, questionId: string, maxPoints: number | null) => void
    updateLiveQuestionRequireAllCorrect: (sectionId: string, questionId: string, requireAllCorrect: boolean) => void
    updateLiveQuestionShuffleOptions: (sectionId: string, questionId: string, shuffleOptions: boolean) => void
    updateLiveQuestionAnswerTemplate: (sectionId: string, questionId: string, answerTemplate: ContentSegment[]) => void
    updateLiveQuestionAnswerTemplateLocked: (sectionId: string, questionId: string, answerTemplateLocked: boolean) => void
    updateLiveQuestionStudentTools: (sectionId: string, questionId: string, studentTools: Question['studentTools']) => void
    updateLiveSegmentInstruction: (sectionId: string, questionId: string, segmentId: string, instruction: string) => void
    updateLiveSegmentOrder: (sectionId: string, questionId: string, segmentId: string, order: number) => void
    updateLiveSegmentPoints: (sectionId: string, questionId: string, segmentId: string, points: number | null | undefined) => void
    updateLiveSegmentCorrect: (sectionId: string, questionId: string, segmentId: string, isCorrect: boolean) => void
    updateLiveSegmentCriteria: (sectionId: string, questionId: string, segmentId: string, criteria: string) => void
    updateLiveSegmentPerfectAnswer: (sectionId: string, questionId: string, segmentId: string, examples: string[]) => void
    updateLiveSectionTitle: (sectionId: string, title: string) => void
    updateLiveSectionLabel: (sectionId: string, label: string | null) => void
    updateLiveSectionIntro: (sectionId: string, introContent: ContentSegment[]) => void
}

const buildExamplesPayload = (value: string) => {
    if (!value || !value.trim()) return []
    return [value.trim()]
}

const defaultStudentTools: StudentToolsConfig = {
    math: { enabled: true, symbolSet: 'full' },
    table: { enabled: true, maxRows: null, maxCols: null, allowMath: true },
    graph: {
        enabled: true,
        allowPoints: true,
        allowLines: true,
        allowCurves: true,
        allowFunctions: true,
        allowAreas: true,
        allowText: true,
    },
}

const normalizeStudentTools = (tools?: StudentToolsConfig | null): StudentToolsConfig => ({
    math: {
        enabled: tools?.math?.enabled ?? defaultStudentTools.math?.enabled,
        symbolSet: tools?.math?.symbolSet ?? defaultStudentTools.math?.symbolSet,
    },
    table: {
        enabled: tools?.table?.enabled ?? defaultStudentTools.table?.enabled,
        maxRows: tools?.table?.maxRows ?? defaultStudentTools.table?.maxRows,
        maxCols: tools?.table?.maxCols ?? defaultStudentTools.table?.maxCols,
        allowMath: tools?.table?.allowMath ?? defaultStudentTools.table?.allowMath,
    },
    graph: {
        enabled: tools?.graph?.enabled ?? defaultStudentTools.graph?.enabled,
        allowPoints: tools?.graph?.allowPoints ?? defaultStudentTools.graph?.allowPoints,
        allowLines: tools?.graph?.allowLines ?? defaultStudentTools.graph?.allowLines,
        allowCurves: tools?.graph?.allowCurves ?? defaultStudentTools.graph?.allowCurves,
        allowFunctions: tools?.graph?.allowFunctions ?? defaultStudentTools.graph?.allowFunctions,
        allowAreas: tools?.graph?.allowAreas ?? defaultStudentTools.graph?.allowAreas,
        allowText: tools?.graph?.allowText ?? defaultStudentTools.graph?.allowText,
    },
})

type AddInsertMenuItem = {
    label: string
    description?: string
    onSelect: () => void
    disabled?: boolean
}

type AddInsertMenuGroup = {
    label?: string
    items: AddInsertMenuItem[]
}

type AddInsertMenuProps = {
    label: string
    subtitle?: string
    groups: AddInsertMenuGroup[]
    disabled?: boolean
    className?: string
    align?: 'left' | 'right'
    iconOnly?: boolean
    onOpenChange?: (open: boolean) => void
}

type FocusNodeKind = 'part' | 'question' | 'qcm'

type FocusNode = {
    id: string
    kind: FocusNodeKind
    sectionId?: string
    questionId?: string
    parentId?: string
    ref: string
    label: string
    orderIndex: number
}

const AddInsertMenu = ({
    label,
    subtitle,
    groups,
    disabled,
    className,
    align = 'right',
    iconOnly = false,
    onOpenChange,
}: AddInsertMenuProps) => {
    const [open, setOpen] = useState(false)
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null)
    const menuRef = useRef<HTMLDivElement | null>(null)
    const buttonRef = useRef<HTMLButtonElement | null>(null)

    const updatePosition = useCallback(() => {
        if (!buttonRef.current || !menuRef.current) return
        const buttonRect = buttonRef.current.getBoundingClientRect()
        const menuRect = menuRef.current.getBoundingClientRect()
        const padding = 8
        let left = align === 'left' ? buttonRect.left : buttonRect.right - menuRect.width
        if (left < padding) left = padding
        if (left + menuRect.width > window.innerWidth - padding) {
            left = Math.max(padding, window.innerWidth - padding - menuRect.width)
        }
        let top = buttonRect.bottom + padding
        if (top + menuRect.height > window.innerHeight - padding) {
            top = Math.max(padding, buttonRect.top - menuRect.height - padding)
        }
        setMenuStyle({ top, left })
    }, [align])

    useEffect(() => {
        if (onOpenChange) onOpenChange(open)
    }, [open, onOpenChange])

    useEffect(() => {
        if (!open) return
        const handleClickOutside = (event: MouseEvent) => {
            if (!menuRef.current) return
            if (menuRef.current.contains(event.target as Node)) return
            setOpen(false)
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [open])

    useLayoutEffect(() => {
        if (!open) return
        updatePosition()
    }, [open, updatePosition, groups])

    useEffect(() => {
        if (!open) return
        const handleScroll = () => updatePosition()
        const handleResize = () => updatePosition()
        window.addEventListener('scroll', handleScroll, true)
        window.addEventListener('resize', handleResize)
        return () => {
            window.removeEventListener('scroll', handleScroll, true)
            window.removeEventListener('resize', handleResize)
        }
    }, [open, updatePosition])

    return (
        <div ref={menuRef} className={`relative ${className ?? ''}`}>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className={
                    iconOnly
                        ? 'inline-flex h-6 w-6 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-900 hover:bg-brand-100 hover:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-50'
                        : 'inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-sm font-semibold text-brand-900 hover:bg-brand-100 hover:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-50'
                }
                disabled={disabled}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={label}
            >
                <Plus className={iconOnly ? 'h-3 w-3' : 'h-4 w-4'} />
                {iconOnly ? <span className="sr-only">{label}</span> : <span>{label}</span>}
                {!iconOnly && (
                    <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                )}
            </button>
            {open && (
                <div
                    ref={menuRef}
                    role="menu"
                    className="fixed z-50 w-64 rounded-md border border-gray-200 bg-white p-2 shadow-lg"
                    style={menuStyle ?? undefined}
                >
                    {subtitle && (
                        <div className="px-2 pb-2 text-[11px] text-gray-500">
                            {subtitle}
                        </div>
                    )}
                    {groups.map((group, index) => (
                        <div key={`${group.label ?? 'group'}-${index}`} className={index > 0 ? 'border-t border-gray-100 pt-2 mt-2' : ''}>
                            {group.label && (
                                <div className="px-2 pb-1 text-xs font-semibold text-gray-700">
                                    {group.label}
                                </div>
                            )}
                            <div className="flex flex-col gap-1">
                                {group.items.map((item, itemIndex) => (
                                    <button
                                        key={`${item.label}-${itemIndex}`}
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            item.onSelect()
                                            setOpen(false)
                                        }}
                                        className="flex w-full flex-col items-start rounded-md px-2 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                        disabled={disabled || item.disabled}
                                    >
                                        <span className="font-medium">{item.label}</span>
                                        {item.description && <span className="text-xs text-gray-500">{item.description}</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

const basicMathSymbolPreview = ['a/b', '√', 'x^', 'x_', 'π', '∞', '≤', '≥', '≠', '×', '±']
const fullMathSymbolPreview = ['∑', '∫', '∏', 'lim', 'ln', 'log', 'sin', 'cos', 'tan', '∈', '⊂', '→', '∀', '∂', 'ℝ']

const buildCollapsedPreview = (value: string, maxLength = 140) => {
    const trimmed = value.replace(/\s+/g, ' ').trim()
    if (!trimmed) return ''
    if (trimmed.length <= maxLength) return trimmed
    return `${trimmed.slice(0, maxLength - 1)}…`
}

export function SectionList({
    viewMode,
    onViewModeChange,
    onSelectedNodeChange,
    focusPreview,
    liveExam,
    dict,
    locale,
    isLocked,
    loading,
    validationDetails,
    showValidationUI,
    previewEnabled,
    onPreviewToggle,
    addSection,
    addQuestion,
    addSegment,
    updateSection,
    updateQuestion,
    updateSegment,
    deleteSegment,
    deleteQuestion,
    deleteSection,
    updateLiveQuestionContent,
    updateLiveQuestionLabel,
    updateLiveQuestionMaxPoints,
    updateLiveQuestionRequireAllCorrect,
    updateLiveQuestionShuffleOptions,
    updateLiveQuestionAnswerTemplate,
    updateLiveQuestionAnswerTemplateLocked,
    updateLiveQuestionStudentTools,
    updateLiveSegmentInstruction,
    updateLiveSegmentOrder,
    updateLiveSegmentPoints,
    updateLiveSegmentCorrect,
    updateLiveSegmentCriteria,
    updateLiveSegmentPerfectAnswer,
    updateLiveSectionTitle,
    updateLiveSectionLabel,
    updateLiveSectionIntro,
}: SectionListProps) {
    const sectionsToDisplay = useMemo(() => {
        return [...liveExam.sections].sort((a, b) => a.order - b.order)
    }, [liveExam.sections])

    // Hide the default unnamed section when it is empty (e.g., after deleting a standalone question).
    const visibleSections = useMemo(() => {
        return sectionsToDisplay.filter(
            (section) => !(section.isDefault && !section.customLabel && !section.title && section.questions.length === 0)
        )
    }, [sectionsToDisplay])

    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
    const [collapsedParts, setCollapsedParts] = useState<Record<string, boolean>>({})
    const lastSelectedIndexRef = useRef(0)
    const pendingSelectionRef = useRef<{
        kind: FocusNodeKind
        prevQuestionIds: Set<string>
    } | null>(null)

    const noticePlaceholder =
        dict.standaloneNoticePlaceholder ||
        (locale === 'fr'
            ? 'Notice de correction (facultatif mais recommandé)…'
            : 'Grading notes (optional but recommended)…')
    const perfectPlaceholder =
        dict.standalonePerfectAnswerPlaceholder ||
        (locale === 'fr'
            ? 'Exemple de réponse parfaite (envoyé après l’examen si rempli)…'
            : 'Example perfect answer (sent after the exam if filled)…')
    const questionPlaceholder =
        dict.standaloneQuestionTextPlaceholder ||
        (locale === 'fr'
            ? 'Intitulé de la question, consignes, etc. Exemple : “Démontrez que …”'
            : 'Question wording and instructions, e.g. “Show that …”')
    const answerTemplateLabel =
        dict.standaloneAnswerTemplateLabel ||
        (locale === 'fr' ? 'Base de réponse à compléter par l’étudiant (optionnel)' : 'Student-editable answer template (optional)')
    const answerTemplatePlaceholder =
        dict.standaloneAnswerTemplatePlaceholder ||
        (locale === 'fr'
            ? 'Ex. tableau à compléter, graphe à compléter, formule à terminer...'
            : 'E.g. fillable table, graph to complete, formula to finish...')
    const studentToolsLabel =
        locale === 'fr' ? 'Outils disponibles pour l\u2019\u00e9tudiant' : 'Student tools'
    const studentToolsHelper =
        locale === 'fr'
            ? 'Personnalisez les outils d\u2019\u00e9dition pour cette question.'
            : 'Customize the editing tools available for this question.'
    const studentToolsToggleLabel =
        locale === 'fr' ? 'Personnaliser les outils' : 'Customize tools'
    const studentToolsResetLabel =
        locale === 'fr' ? 'Revenir aux outils par d\u00e9faut' : 'Reset to defaults'
    const studentToolsDefaultLabel =
        locale === 'fr' ? 'Outils par d\u00e9faut' : 'Default tools'
    const mathToolsLabel =
        locale === 'fr' ? 'Formules' : 'Formulas'
    const mathSymbolsLabel =
        locale === 'fr' ? 'Symboles' : 'Symbols'
    const mathSymbolsBasicLabel =
        locale === 'fr' ? 'Essentiels' : 'Basic'
    const mathSymbolsFullLabel =
        locale === 'fr' ? 'Complets' : 'Full'
    const tableToolsLabel =
        locale === 'fr' ? 'Tableaux' : 'Tables'
    const tableMaxRowsLabel =
        locale === 'fr' ? 'Lignes max' : 'Max rows'
    const tableMaxColsLabel =
        locale === 'fr' ? 'Colonnes max' : 'Max columns'
    const tableAllowMathLabel =
        locale === 'fr' ? 'Formules dans les cellules' : 'Math inside cells'
    const graphToolsLabel =
        locale === 'fr' ? 'Graphiques' : 'Graphs'
    const graphPointsLabel =
        locale === 'fr' ? 'Points' : 'Points'
    const graphLinesLabel =
        locale === 'fr' ? 'Droites et segments' : 'Lines & segments'
    const graphCurvesLabel =
        locale === 'fr' ? 'Courbes' : 'Curves'
    const graphFunctionsLabel =
        locale === 'fr' ? 'Fonctions' : 'Functions'
    const graphAreasLabel =
        locale === 'fr' ? 'Surfaces' : 'Areas'
    const graphTextLabel =
        locale === 'fr' ? 'Texte' : 'Text'
    const outlineUntitledLabel =
        locale === 'fr' ? 'Sans titre' : 'Untitled'
    const sectionIntroLabel =
        locale === 'fr' ? 'Mention de la partie (facultatif)' : 'Section note (optional)'
    const sectionIntroPlaceholder =
        locale === 'fr'
            ? 'Ex. Consignes globales pour cette partie...'
            : 'e.g. General instructions for this section...'
    const mcqOptionPointsPlaceholder =
        locale === 'fr' ? 'Pts option (ex. 0, +2, -1)' : 'Option pts (e.g. 0, +2, -1)'
    const mcqTotalPointsHint =
        locale === 'fr' ? 'Total = somme des points positifs' : 'Total = sum of positive option points'
    const mcqTotalPointsMismatchText =
        locale === 'fr'
            ? 'Le total doit \u00eatre \u00e9gal \u00e0 la somme des points positifs.'
            : 'Total must match the sum of positive option points.'
    const getQuestionOutlineLabel = useCallback(
        (question: Question) => {
            const content = Array.isArray(question.content) ? question.content : parseContent(question.content || '')
            const preview = buildCollapsedPreview(segmentsToPlainText(content), 48)
            return preview || outlineUntitledLabel
        },
        [outlineUntitledLabel]
    )
    const lockedBlockClass = isLocked ? 'opacity-60 pointer-events-none' : ''

    const deleteSectionLabel =
        dict.deleteSectionTooltip || (locale === 'fr' ? 'Supprimer la partie' : 'Delete section')
    const showDeleteSectionLabel = deleteSectionLabel.trim().length > 0
    const deleteQuestionLabel =
        dict.deleteQuestionTooltip || (locale === 'fr' ? 'Supprimer la question' : 'Delete question')
    const confirmDeleteSectionLabel =
        dict.confirmDeleteSection || (locale === 'fr' ? 'Supprimer cette partie ?' : 'Delete this section?')
    const confirmDeleteSectionAction =
        dict.confirmDeleteSectionAction || (locale === 'fr' ? 'Confirmer' : 'Confirm')
    const confirmDeleteSectionCancel =
        dict.confirmDeleteSectionCancel || (locale === 'fr' ? 'Annuler' : 'Cancel')
    const confirmDeleteQuestionLabel =
        dict.confirmDeleteQuestion || (locale === 'fr' ? 'Supprimer cette question ?' : 'Delete this question?')
    const confirmDeleteQuestionAction =
        dict.confirmDeleteQuestionAction || (locale === 'fr' ? 'Confirmer' : 'Confirm')
    const confirmDeleteQuestionCancel =
        dict.confirmDeleteQuestionCancel || (locale === 'fr' ? 'Annuler' : 'Cancel')
    const deleteOptionLabel = locale === 'fr' ? "Supprimer l'option" : 'Delete option'

    const [sectionPendingDelete, setSectionPendingDelete] = useState<string | null>(null)
    const [sectionDeleteSource, setSectionDeleteSource] = useState<'outline' | 'card' | null>(null)
    const [isDeletingSection, setIsDeletingSection] = useState(false)
    const sectionDeleteConfirmRef = useRef<HTMLDivElement>(null)
    const [questionPendingDelete, setQuestionPendingDelete] = useState<string | null>(null)
    const [questionDeleteSource, setQuestionDeleteSource] = useState<'outline' | 'card' | null>(null)
    const [isDeletingQuestion, setIsDeletingQuestion] = useState(false)
    const questionDeleteConfirmRef = useRef<HTMLDivElement>(null)
    const [mcqManualTotalPoints, setMcqManualTotalPoints] = useState<Record<string, boolean>>({})
    const [mcqOptionPendingDelete, setMcqOptionPendingDelete] = useState<string | null>(null)
    const mcqOptionDeleteConfirmRef = useRef<HTMLDivElement>(null)
    const [isDeletingMcqOption, setIsDeletingMcqOption] = useState(false)
    const [hoveredEditorKey, setHoveredEditorKey] = useState<string | null>(null)
    const [pendingOptionFocusQuestionId, setPendingOptionFocusQuestionId] = useState<string | null>(null)
    const [hoveredOutlineNodeId, setHoveredOutlineNodeId] = useState<string | null>(null)
    const [activeOutlineMenuNodeId, setActiveOutlineMenuNodeId] = useState<string | null>(null)
    const getEditorHoverHandlers = useCallback((key: string) => ({
        onMouseEnter: () => setHoveredEditorKey(key),
        onMouseLeave: (event: any) => {
            const currentTarget = event.currentTarget as HTMLElement | null
            const nextTarget = event.relatedTarget
            if (currentTarget && nextTarget instanceof Node && currentTarget.contains(nextTarget)) return
            setHoveredEditorKey((prev) => (prev === key ? null : prev))
        },
        onFocusCapture: () => setHoveredEditorKey(key),
        onBlurCapture: (event: any) => {
            const currentTarget = event.currentTarget as HTMLElement | null
            const nextTarget = event.relatedTarget
            if (currentTarget && nextTarget instanceof Node && currentTarget.contains(nextTarget)) return
            setHoveredEditorKey((prev) => (prev === key ? null : prev))
        },
    }), [])
    const panelsStorageKey = `examBuilder:panels:${liveExam.id}`
    const buildDefaultPanelsState = (examData: Exam) => {
        const defaults: Record<
            string,
            { template?: boolean; perfect?: boolean; notice?: boolean; tools?: boolean }
        > = {}
        examData.sections.forEach((section) => {
            section.questions.forEach((question) => {
                if (question.type === 'MCQ') return
                const answerTemplate = question.answerTemplate || []
                const primarySegment = question.segments?.[0]
                const correctionNotes = primarySegment?.rubric?.criteria ?? ''
                const examples = primarySegment?.rubric?.examples
                const perfectAnswer = Array.isArray(examples) ? examples.filter(Boolean).join('\n\n') : examples ?? ''
                defaults[question.id] = {
                    template: answerTemplate.length > 0,
                    perfect: Boolean(perfectAnswer.trim()),
                    notice: Boolean(correctionNotes.trim()),
                    tools: true,
                }
            })
        })
        return defaults
    }
    const [classicQuestionPanelsOpen, setClassicQuestionPanelsOpen] = useState<
        Record<string, { template?: boolean; perfect?: boolean; notice?: boolean; tools?: boolean }>
    >(() => buildDefaultPanelsState(liveExam))

    const handleAddOption = useCallback(async (questionId: string) => {
        await addSegment(questionId)
        setPendingOptionFocusQuestionId(questionId)
    }, [addSegment])

    useEffect(() => {
        setClassicQuestionPanelsOpen((prev) => {
            const defaults = buildDefaultPanelsState(liveExam)
            const next: Record<string, { template?: boolean; perfect?: boolean; notice?: boolean; tools?: boolean }> = {
                ...defaults,
            }
            Object.entries(prev).forEach(([questionId, value]) => {
                if (!next[questionId]) return
                next[questionId] = { ...next[questionId], ...value }
            })
            return next
        })
    }, [liveExam.sections])

    useEffect(() => {
        if (!pendingOptionFocusQuestionId) return
        const selector = `[data-question-id="${pendingOptionFocusQuestionId}"] [data-option-editor]`
        const optionNodes = Array.from(document.querySelectorAll(selector)) as HTMLElement[]
        if (optionNodes.length === 0) return
        const lastOption = optionNodes[optionNodes.length - 1]
        const editable = lastOption.querySelector('[contenteditable="true"]') as HTMLElement | null
        if (editable) {
            editable.focus()
        } else {
            const input = lastOption.querySelector('input') as HTMLInputElement | null
            input?.focus()
        }
        setPendingOptionFocusQuestionId(null)
    }, [pendingOptionFocusQuestionId, liveExam])

    useEffect(() => {
        if (typeof window === 'undefined') return
        const stored = window.localStorage.getItem(panelsStorageKey)
        if (!stored) return
        try {
            const parsed = JSON.parse(stored) as Record<
                string,
                { template?: boolean; perfect?: boolean; notice?: boolean; tools?: boolean }
            >
            if (!parsed || typeof parsed !== 'object') return
            setClassicQuestionPanelsOpen((prev) => {
                const next = { ...prev }
                Object.entries(parsed).forEach(([questionId, value]) => {
                    if (!next[questionId] || !value || typeof value !== 'object') return
                    next[questionId] = { ...next[questionId], ...value }
                })
                return next
            })
        } catch {
            // Ignore invalid stored data.
        }
    }, [panelsStorageKey])

    useEffect(() => {
        if (typeof window === 'undefined') return
        window.localStorage.setItem(panelsStorageKey, JSON.stringify(classicQuestionPanelsOpen))
    }, [classicQuestionPanelsOpen, panelsStorageKey])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const path = event.composedPath?.() ?? []
            const insideConfirm = path.some(
                (target) =>
                    target instanceof HTMLElement && target.dataset.deleteConfirm === 'true'
            )
            if (insideConfirm) return
            if (sectionPendingDelete && sectionDeleteConfirmRef.current && !sectionDeleteConfirmRef.current.contains(event.target as Node)) {
                setSectionPendingDelete(null)
            }
            if (questionPendingDelete && questionDeleteConfirmRef.current && !questionDeleteConfirmRef.current.contains(event.target as Node)) {
                setQuestionPendingDelete(null)
            }
            if (mcqOptionPendingDelete && mcqOptionDeleteConfirmRef.current && !mcqOptionDeleteConfirmRef.current.contains(event.target as Node)) {
                setMcqOptionPendingDelete(null)
            }
        }
        if (sectionPendingDelete) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        if (questionPendingDelete) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        if (mcqOptionPendingDelete) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [sectionPendingDelete, questionPendingDelete, mcqOptionPendingDelete])


    const handleDeleteSectionClick = (sectionId: string, source: 'outline' | 'card') => {
        setSectionPendingDelete(sectionId)
        setSectionDeleteSource(source)
    }

    const handleCancelDeleteSection = () => {
        setSectionPendingDelete(null)
        setSectionDeleteSource(null)
        setHoveredOutlineNodeId(null)
        if (typeof document !== 'undefined') {
            ;(document.activeElement as HTMLElement | null)?.blur?.()
        }
    }

    const handleConfirmDeleteSection = async (sectionId: string) => {
        setIsDeletingSection(true)
        try {
            await deleteSection(sectionId)
            setSectionPendingDelete(null)
            setSectionDeleteSource(null)
            setHoveredOutlineNodeId(null)
            if (typeof document !== 'undefined') {
                ;(document.activeElement as HTMLElement | null)?.blur?.()
            }
        } finally {
            setIsDeletingSection(false)
        }
    }

    const handleDeleteQuestionClick = (questionId: string, source: 'outline' | 'card') => {
        setQuestionPendingDelete(questionId)
        setQuestionDeleteSource(source)
    }

    const handleCancelDeleteQuestion = () => {
        setQuestionPendingDelete(null)
        setQuestionDeleteSource(null)
        setHoveredOutlineNodeId(null)
        if (typeof document !== 'undefined') {
            ;(document.activeElement as HTMLElement | null)?.blur?.()
        }
    }

    const handleConfirmDeleteQuestion = async (sectionId: string, questionId: string) => {
        setIsDeletingQuestion(true)
        try {
            await deleteQuestion(sectionId, questionId)
            setQuestionPendingDelete(null)
            setQuestionDeleteSource(null)
            setHoveredOutlineNodeId(null)
            if (typeof document !== 'undefined') {
                ;(document.activeElement as HTMLElement | null)?.blur?.()
            }
        } finally {
            setIsDeletingQuestion(false)
        }
    }

    const handleDeleteMcqOptionClick = (segmentId: string) => {
        setMcqOptionPendingDelete(segmentId)
    }

    const handleCancelDeleteMcqOption = () => {
        setMcqOptionPendingDelete(null)
    }

    const handleConfirmDeleteMcqOption = async (questionId: string, segmentId: string) => {
        setIsDeletingMcqOption(true)
        try {
            await deleteSegment(questionId, segmentId)
            setMcqOptionPendingDelete(null)
        } finally {
            setIsDeletingMcqOption(false)
        }
    }

    const hasQuestionContentError = (questionId: string) =>
        showValidationUI && (validationDetails?.questions.some((q) => q.questionId === questionId && q.missingContent) ?? false)

    const hasQuestionLabelError = (questionId: string) =>
        showValidationUI && (validationDetails?.questions.some((q) => q.questionId === questionId && q.missingLabel) ?? false)

    const hasQuestionPointsError = (questionId: string) =>
        showValidationUI && (validationDetails?.questions.some((q) => q.questionId === questionId && q.missingPoints) ?? false)

    const hasMcqTotalPointsMismatch = (questionId: string) =>
        showValidationUI &&
        (validationDetails?.questions.some((q) => q.questionId === questionId && q.mcqTotalPointsMismatch) ?? false)

    const hasMcqOptionTextError = (questionId: string, segmentId: string) =>
        showValidationUI &&
        (validationDetails?.questions.some(
            (q) => q.questionId === questionId && q.missingMcqOptionText?.some((opt) => opt.segmentId === segmentId)
        ) ?? false)

    const hasMcqOptionPointsError = (questionId: string, segmentId: string) =>
        showValidationUI &&
        (validationDetails?.questions.some(
            (q) => q.questionId === questionId && q.missingMcqOptionPoints?.some((opt) => opt.segmentId === segmentId)
        ) ?? false)

    const handleEmptySectionAdd = async (sectionId: string, scope: 'in' | 'out', type: QuestionType) => {
        if (scope === 'in') {
            await handleAddQuestion(sectionId, type, false)
            return
        }
        // outside: create a new default section right after the current section, then add the question there
        const newSectionId = await handleAddSection(false, undefined, sectionId, true)
        await handleAddQuestion(newSectionId ?? undefined, type, false, undefined, false)
    }

    const getSortedQuestions = useCallback((section: Exam['sections'][number]) => {
        return [...section.questions].sort((a, b) => {
            const orderA = typeof a.order === 'number' ? a.order : 0
            const orderB = typeof b.order === 'number' ? b.order : 0
            if (orderA !== orderB) return orderA - orderB
            return a.id.localeCompare(b.id)
        })
    }, [])

    const outlineData = useMemo(() => {
        const items: Array<{
            node: FocusNode
            depth: number
            collapsed?: boolean
            hasChildren?: boolean
        }> = []
        const nodeMap = new Map<string, FocusNode>()
        const flatIds: string[] = []
        let partIndex = 0
        let rootQuestionIndex = 0
        let rootMcqIndex = 0

        visibleSections.forEach((section) => {
            const sortedQuestions = getSortedQuestions(section)
            const isDefaultWithoutLabel = section.isDefault && !section.customLabel && !section.title

            if (isDefaultWithoutLabel) {
                sortedQuestions.forEach((question) => {
                    const kind: FocusNodeKind = question.type === 'MCQ' ? 'qcm' : 'question'
                    if (kind === 'qcm') {
                        rootMcqIndex += 1
                    } else {
                        rootQuestionIndex += 1
                    }
                    const computedRef = kind === 'qcm' ? `QCM${rootMcqIndex}` : `Q${rootQuestionIndex}`
                    const ref = question.customLabel || computedRef
                    const node: FocusNode = {
                        id: `${kind}:${question.id}`,
                        kind,
                        sectionId: section.id,
                        questionId: question.id,
                        ref,
                        label: getQuestionOutlineLabel(question),
                        orderIndex: flatIds.length,
                    }
                    items.push({ node, depth: 0 })
                    nodeMap.set(node.id, node)
                    flatIds.push(node.id)
                })
                return
            }

            partIndex += 1
            const partNode: FocusNode = {
                id: `part:${section.id}`,
                kind: 'part',
                sectionId: section.id,
                ref: section.customLabel || `P${partIndex}`,
                label: section.customLabel || section.title || outlineUntitledLabel,
                orderIndex: flatIds.length,
            }
            const isCollapsed = collapsedParts[section.id] ?? false
            items.push({
                node: partNode,
                depth: 0,
                collapsed: isCollapsed,
                hasChildren: sortedQuestions.length > 0,
            })
            nodeMap.set(partNode.id, partNode)
            flatIds.push(partNode.id)

            if (!isCollapsed) {
                let questionIndex = 0
                let mcqIndex = 0
                sortedQuestions.forEach((question) => {
                    const kind: FocusNodeKind = question.type === 'MCQ' ? 'qcm' : 'question'
                    if (kind === 'qcm') {
                        mcqIndex += 1
                    } else {
                        questionIndex += 1
                    }
                    const computedRef = kind === 'qcm' ? `QCM${mcqIndex}` : `Q${questionIndex}`
                    const ref = question.customLabel || computedRef
                    const node: FocusNode = {
                        id: `${kind}:${question.id}`,
                        kind,
                        sectionId: section.id,
                        questionId: question.id,
                        parentId: partNode.id,
                        ref,
                        label: getQuestionOutlineLabel(question),
                        orderIndex: flatIds.length,
                    }
                    items.push({ node, depth: 1 })
                    nodeMap.set(node.id, node)
                    flatIds.push(node.id)
                })
            }
        })

        return { items, nodeMap, flatIds }
    }, [collapsedParts, getQuestionOutlineLabel, getSortedQuestions, outlineUntitledLabel, visibleSections])

    const outlineSectionMap = useMemo(() => {
        return new Map(liveExam.sections.map((section) => [section.id, section]))
    }, [liveExam.sections])

    const outlineSectionIndexMap = useMemo(() => {
        return new Map(visibleSections.map((section, index) => [section.id, index]))
    }, [visibleSections])

    const outlineQuestionIndexMap = useMemo(() => {
        const map = new Map<string, Map<string, number>>()
        visibleSections.forEach((section) => {
            const sorted = getSortedQuestions(section)
            map.set(
                section.id,
                new Map(sorted.map((question, index) => [question.id, index]))
            )
        })
        return map
    }, [getSortedQuestions, visibleSections])

    const outlineQuestionCountMap = useMemo(() => {
        return new Map(visibleSections.map((section) => [section.id, getSortedQuestions(section).length]))
    }, [getSortedQuestions, visibleSections])

    useEffect(() => {
        if (viewMode !== 'focus') return
        if (outlineData.flatIds.length === 0) {
            if (selectedNodeId !== null) {
                setSelectedNodeId(null)
            }
            return
        }
        if (!selectedNodeId || !outlineData.nodeMap.has(selectedNodeId)) {
            const fallbackIndex = Math.min(lastSelectedIndexRef.current, outlineData.flatIds.length - 1)
            setSelectedNodeId(outlineData.flatIds[fallbackIndex] || outlineData.flatIds[0] || null)
        }
    }, [outlineData.flatIds, outlineData.nodeMap, selectedNodeId, viewMode])

    useEffect(() => {
        if (viewMode !== 'focus') {
            onSelectedNodeChange(null)
            return
        }
        onSelectedNodeChange(selectedNodeId)
    }, [onSelectedNodeChange, selectedNodeId, viewMode])

    useEffect(() => {
        if (!selectedNodeId) return
        const index = outlineData.flatIds.indexOf(selectedNodeId)
        if (index >= 0) {
            lastSelectedIndexRef.current = index
        }
    }, [outlineData.flatIds, selectedNodeId])

    useEffect(() => {
        const pendingSelection = pendingSelectionRef.current
        if (!pendingSelection || viewMode !== 'focus') return
        const currentIds = new Set(
            liveExam.sections.flatMap((section) => section.questions.map((question) => question.id))
        )
        const newIds = [...currentIds].filter((id) => !pendingSelection.prevQuestionIds.has(id))
        if (newIds.length === 0) return
        const targetId = newIds[0]
        setSelectedNodeId(`${pendingSelection.kind}:${targetId}`)
        pendingSelectionRef.current = null
    }, [liveExam.sections, viewMode])

    const handleOutlineKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (viewMode !== 'focus' || outlineData.flatIds.length === 0) return
            if (!['ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)) return
            event.preventDefault()
            const currentIndex = selectedNodeId ? outlineData.flatIds.indexOf(selectedNodeId) : -1
            if (event.key === 'Enter') {
                if (currentIndex === -1) {
                    setSelectedNodeId(outlineData.flatIds[0])
                }
                return
            }
            const delta = event.key === 'ArrowUp' ? -1 : 1
            const nextIndex = Math.min(
                outlineData.flatIds.length - 1,
                Math.max(0, (currentIndex === -1 ? 0 : currentIndex + delta))
            )
            setSelectedNodeId(outlineData.flatIds[nextIndex])
        },
        [outlineData.flatIds, selectedNodeId, viewMode]
    )

    const getInsertOrder = (section: Exam['sections'][number] | null, position: 'start' | 'end') => {
        if (!section || section.questions.length === 0) return 0
        const sorted = getSortedQuestions(section)
        if (position === 'start') {
            return (sorted[0]?.order ?? 0) - 1
        }
        return (sorted[sorted.length - 1]?.order ?? 0) + 1
    }

    const ensureDefaultSectionBefore = async (sectionIndex: number) => {
        const prevSection = visibleSections[sectionIndex - 1]
        if (prevSection?.isDefault) {
            return { id: prevSection.id, section: prevSection }
        }
        const newId = prevSection
            ? await addSection(false, undefined, prevSection.id, true)
            : await addSection(true, undefined, undefined, true)
        return newId ? { id: newId, section: null } : null
    }

    const ensureDefaultSectionAfter = async (sectionIndex: number) => {
        const nextSection = visibleSections[sectionIndex + 1]
        if (nextSection?.isDefault) {
            return { id: nextSection.id, section: nextSection }
        }
        const current = visibleSections[sectionIndex]
        const newId = current ? await addSection(false, undefined, current.id, true) : null
        return newId ? { id: newId, section: null } : null
    }

    const moveQuestionWithinSection = async (section: Exam['sections'][number], fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return
        const sorted = getSortedQuestions(section)
        const source = sorted[fromIndex]
        const target = sorted[toIndex]
        if (!source || !target) return
        const sourceOrder = source.order ?? fromIndex
        const targetOrder = target.order ?? toIndex
        await updateQuestion(section.id, source.id, { order: targetOrder })
        await updateQuestion(section.id, target.id, { order: sourceOrder })
    }

    const moveQuestionToSection = async (
        fromSectionId: string,
        questionId: string,
        targetSectionId: string,
        targetOrder: number
    ) => {
        await updateQuestion(fromSectionId, questionId, { targetSectionId, targetOrder })
    }

    const moveSection = async (sectionIndex: number, direction: 'up' | 'down') => {
        const current = visibleSections[sectionIndex]
        const target = visibleSections[sectionIndex + (direction === 'up' ? -1 : 1)]
        if (!current || !target || current.isDefault) return
        const targetOrder = typeof target.order === 'number' ? target.order : 0
        const newOrder = direction === 'up' ? targetOrder - 1 : targetOrder + 1
        await updateSection(current.id, { order: newOrder })
    }

    const renderQuestionMoveButtons = ({
        section,
        questionIndex,
        sectionIndex,
    }: {
        section: Exam['sections'][number]
        questionIndex: number
        sectionIndex: number
    }) => {
        const isDefaultSection = section.isDefault
        const sortedQuestions = getSortedQuestions(section)
        const isFirst = questionIndex === 0
        const isLast = questionIndex === sortedQuestions.length - 1
        const prevSection = visibleSections[sectionIndex - 1]
        const nextSection = visibleSections[sectionIndex + 1]
        const hasPrevPart = Boolean(prevSection && !prevSection.isDefault)
        const hasNextPart = Boolean(nextSection && !nextSection.isDefault)
        const disabled = loading || isLocked

        const baseClass = 'rounded border p-1 text-gray-600 hover:bg-gray-50 disabled:opacity-50'
        const specialClass = 'rounded border border-brand-900 bg-brand-50 text-brand-900 hover:bg-brand-100 disabled:opacity-50'

        const buttons: Array<JSX.Element> = []

        if (!isDefaultSection) {
            if (!isFirst) {
                buttons.push(
                    <button
                        key="move-up"
                        type="button"
                        className={baseClass}
                        title={locale === 'fr' ? 'Monter la question' : 'Move question up'}
                        onClick={() => moveQuestionWithinSection(section, questionIndex, questionIndex - 1)}
                        disabled={disabled}
                    >
                        <ArrowUp className="h-3 w-3" />
                    </button>
                )
            }
            if (isFirst) {
                buttons.push(
                    <button
                        key="exit-up"
                        type="button"
                        className={specialClass}
                        title={locale === 'fr' ? 'Sortir de la partie (avant)' : 'Move out of section (before)'}
                        onClick={async () => {
                            const target = await ensureDefaultSectionBefore(sectionIndex)
                            if (!target) return
                            const order = getInsertOrder(target.section, 'end')
                            await moveQuestionToSection(section.id, sortedQuestions[questionIndex].id, target.id, order)
                        }}
                        disabled={disabled}
                    >
                        <ArrowUp className="h-3 w-3" />
                    </button>
                )
            }
            if (!isLast) {
                buttons.push(
                    <button
                        key="move-down"
                        type="button"
                        className={baseClass}
                        title={locale === 'fr' ? 'Descendre la question' : 'Move question down'}
                        onClick={() => moveQuestionWithinSection(section, questionIndex, questionIndex + 1)}
                        disabled={disabled}
                    >
                        <ArrowDown className="h-3 w-3" />
                    </button>
                )
            }
            if (isLast) {
                buttons.push(
                    <button
                        key="exit-down"
                        type="button"
                        className={specialClass}
                        title={locale === 'fr' ? 'Sortir de la partie (apres)' : 'Move out of section (after)'}
                        onClick={async () => {
                            const target = await ensureDefaultSectionAfter(sectionIndex)
                            if (!target) return
                            const order = getInsertOrder(target.section, 'start')
                            await moveQuestionToSection(section.id, sortedQuestions[questionIndex].id, target.id, order)
                        }}
                        disabled={disabled}
                    >
                        <ArrowDown className="h-3 w-3" />
                    </button>
                )
            }
        } else {
            if (!isFirst) {
                buttons.push(
                    <button
                        key="move-up"
                        type="button"
                        className={baseClass}
                        title={locale === 'fr' ? 'Monter la question' : 'Move question up'}
                        onClick={() => moveQuestionWithinSection(section, questionIndex, questionIndex - 1)}
                        disabled={disabled}
                    >
                        <ArrowUp className="h-3 w-3" />
                    </button>
                )
            } else if (prevSection?.isDefault) {
                buttons.push(
                    <button
                        key="move-up-default"
                        type="button"
                        className={baseClass}
                        title={locale === 'fr' ? 'Monter la question' : 'Move question up'}
                        onClick={async () => {
                            const order = getInsertOrder(prevSection, 'end')
                            await moveQuestionToSection(section.id, sortedQuestions[questionIndex].id, prevSection.id, order)
                        }}
                        disabled={disabled}
                    >
                        <ArrowUp className="h-3 w-3" />
                    </button>
                )
            } else if (hasPrevPart && prevSection) {
                buttons.push(
                    <button
                        key="enter-prev-part"
                        type="button"
                        className={specialClass}
                        title={locale === 'fr' ? 'Entrer dans la partie' : 'Move into section'}
                        onClick={async () => {
                            const order = getInsertOrder(prevSection, 'end')
                            await moveQuestionToSection(section.id, sortedQuestions[questionIndex].id, prevSection.id, order)
                        }}
                        disabled={disabled}
                    >
                        <ArrowUp className="h-3 w-3" />
                    </button>
                )
                buttons.push(
                    <button
                        key="before-prev-part"
                        type="button"
                        className={baseClass}
                        title={locale === 'fr' ? 'Placer avant la partie' : 'Move before the section'}
                        onClick={async () => {
                            const target = await ensureDefaultSectionBefore(sectionIndex - 1)
                            if (!target) return
                            const order = getInsertOrder(target.section, 'end')
                            await moveQuestionToSection(section.id, sortedQuestions[questionIndex].id, target.id, order)
                        }}
                        disabled={disabled}
                    >
                        <ArrowUp className="h-3 w-3" />
                    </button>
                )
            }

            if (!isLast) {
                buttons.push(
                    <button
                        key="move-down"
                        type="button"
                        className={baseClass}
                        title={locale === 'fr' ? 'Descendre la question' : 'Move question down'}
                        onClick={() => moveQuestionWithinSection(section, questionIndex, questionIndex + 1)}
                        disabled={disabled}
                    >
                        <ArrowDown className="h-3 w-3" />
                    </button>
                )
            } else if (nextSection?.isDefault) {
                buttons.push(
                    <button
                        key="move-down-default"
                        type="button"
                        className={baseClass}
                        title={locale === 'fr' ? 'Descendre la question' : 'Move question down'}
                        onClick={async () => {
                            const order = getInsertOrder(nextSection, 'start')
                            await moveQuestionToSection(section.id, sortedQuestions[questionIndex].id, nextSection.id, order)
                        }}
                        disabled={disabled}
                    >
                        <ArrowDown className="h-3 w-3" />
                    </button>
                )
            } else if (hasNextPart && nextSection) {
                buttons.push(
                    <button
                        key="enter-next-part"
                        type="button"
                        className={specialClass}
                        title={locale === 'fr' ? 'Entrer dans la partie' : 'Move into section'}
                        onClick={async () => {
                            const order = getInsertOrder(nextSection, 'start')
                            await moveQuestionToSection(section.id, sortedQuestions[questionIndex].id, nextSection.id, order)
                        }}
                        disabled={disabled}
                    >
                        <ArrowDown className="h-3 w-3" />
                    </button>
                )
                buttons.push(
                    <button
                        key="after-next-part"
                        type="button"
                        className={baseClass}
                        title={locale === 'fr' ? 'Placer apres la partie' : 'Move after the section'}
                        onClick={async () => {
                            const target = await ensureDefaultSectionAfter(sectionIndex + 1)
                            if (!target) return
                            const order = getInsertOrder(target.section, 'start')
                            await moveQuestionToSection(section.id, sortedQuestions[questionIndex].id, target.id, order)
                        }}
                        disabled={disabled}
                    >
                        <ArrowDown className="h-3 w-3" />
                    </button>
                )
            }
        }

        if (buttons.length === 0) return null
        return <div className="flex items-center gap-1">{buttons}</div>
    }

    const handleAddSection = useCallback(
        async (...args: Parameters<typeof addSection>) => {
            const id = await addSection(...args)
            if (viewMode === 'focus' && id) {
                setSelectedNodeId(`part:${id}`)
            }
            return id
        },
        [addSection, viewMode]
    )

    const handleAddQuestion = useCallback(
        async (...args: Parameters<typeof addQuestion>) => {
            if (viewMode === 'focus') {
                const prevQuestionIds = new Set(
                    liveExam.sections.flatMap((section) => section.questions.map((question) => question.id))
                )
                const type = args[1] ?? 'TEXT'
                pendingSelectionRef.current = {
                    kind: type === 'MCQ' ? 'qcm' : 'question',
                    prevQuestionIds,
                }
            }
            await addQuestion(...args)
        },
        [addQuestion, liveExam.sections, viewMode]
    )

    const getOutlineInsertGroups = useCallback(
        (node: FocusNode) => {
            const isFrench = locale === 'fr'
            const inSectionLabel = isFrench ? 'Dans cette partie' : 'In this section'
            const outSectionLabel = isFrench ? 'Hors partie' : 'Outside section'
            const addQuestionLabel = isFrench ? 'Question' : 'Question'
            const addMcqLabel = isFrench ? 'QCM' : 'MCQ'
            const addSectionLabel = isFrench ? 'Partie' : 'Section'
            const sectionId = node.sectionId
            const section = sectionId ? outlineSectionMap.get(sectionId) : undefined
            const isDefaultWithoutLabel = Boolean(
                section?.isDefault && !section?.customLabel && !section?.title
            )

            if (node.kind === 'part' && sectionId) {
                return [
                    {
                        label: inSectionLabel,
                        items: [
                            {
                                label: addQuestionLabel,
                                onSelect: () => handleAddQuestion(sectionId, 'TEXT', false),
                            },
                            {
                                label: addMcqLabel,
                                onSelect: () => handleAddQuestion(sectionId, 'MCQ', false),
                            },
                        ],
                    },
                    {
                        label: outSectionLabel,
                        items: [
                            {
                                label: addQuestionLabel,
                                onSelect: () => handleEmptySectionAdd(sectionId, 'out', 'TEXT'),
                            },
                            {
                                label: addMcqLabel,
                                onSelect: () => handleEmptySectionAdd(sectionId, 'out', 'MCQ'),
                            },
                        ],
                    },
                    {
                        items: [
                            {
                                label: addSectionLabel,
                                onSelect: () => handleAddSection(false, undefined, sectionId),
                            },
                        ],
                    },
                ]
            }

            if (node.kind === 'question' || node.kind === 'qcm') {
                const targetSectionId = isDefaultWithoutLabel ? undefined : sectionId
                const outsideSection = Boolean(isDefaultWithoutLabel)
                const totalQuestions = sectionId ? outlineQuestionCountMap.get(sectionId) ?? 0 : 0
                const isLastInSection =
                    sectionId && node.questionId
                        ? (outlineQuestionIndexMap.get(sectionId)?.get(node.questionId) ?? -1) === totalQuestions - 1
                        : false

                if (outsideSection) {
                    return [
                        {
                            items: [
                                {
                                    label: addQuestionLabel,
                                    onSelect: () =>
                                        handleAddQuestion(targetSectionId, 'TEXT', false, node.questionId, outsideSection),
                                },
                                {
                                    label: addMcqLabel,
                                    onSelect: () =>
                                        handleAddQuestion(targetSectionId, 'MCQ', false, node.questionId, outsideSection),
                                },
                            ],
                        },
                        {
                            items: [
                                {
                                    label: addSectionLabel,
                                    onSelect: () => handleAddSection(false, node.questionId),
                                },
                            ],
                        },
                    ]
                }

                if (isLastInSection) {
                    return [
                        {
                            label: inSectionLabel,
                            items: [
                                {
                                    label: addQuestionLabel,
                                    onSelect: () =>
                                        handleAddQuestion(targetSectionId, 'TEXT', false, node.questionId, outsideSection),
                                },
                                {
                                    label: addMcqLabel,
                                    onSelect: () =>
                                        handleAddQuestion(targetSectionId, 'MCQ', false, node.questionId, outsideSection),
                                },
                            ],
                        },
                        {
                            label: outSectionLabel,
                            items: [
                                {
                                    label: addQuestionLabel,
                                    onSelect: () => handleEmptySectionAdd(sectionId ?? '', 'out', 'TEXT'),
                                },
                                {
                                    label: addMcqLabel,
                                    onSelect: () => handleEmptySectionAdd(sectionId ?? '', 'out', 'MCQ'),
                                },
                            ],
                        },
                        {
                            items: [
                                {
                                    label: addSectionLabel,
                                    onSelect: () => handleAddSection(false, node.questionId),
                                },
                            ],
                        },
                    ]
                }

                return [
                    {
                        label: isDefaultWithoutLabel ? outSectionLabel : inSectionLabel,
                        items: [
                            {
                                label: addQuestionLabel,
                                onSelect: () =>
                                    handleAddQuestion(targetSectionId, 'TEXT', false, node.questionId, outsideSection),
                            },
                            {
                                label: addMcqLabel,
                                onSelect: () =>
                                    handleAddQuestion(targetSectionId, 'MCQ', false, node.questionId, outsideSection),
                            },
                        ],
                    },
                    {
                        items: [
                            {
                                label: addSectionLabel,
                                onSelect: () => handleAddSection(false, node.questionId),
                            },
                        ],
                    },
                ]
            }

            return []
        },
        [handleAddQuestion, handleAddSection, handleEmptySectionAdd, locale, outlineQuestionCountMap, outlineQuestionIndexMap, outlineSectionMap]
    )

    const renderActionButtons = ({
        sectionId,
        questionId,
        isStandalone,
        isLastInSection,
    }: {
        sectionId: string
        questionId: string
        isStandalone: boolean
        isLastInSection: boolean
    }) => {
        const isFrench = locale === 'fr'
        const inSectionLabel = isFrench ? 'Dans cette partie' : 'In this section'
        const outSectionLabel = isFrench ? 'Hors partie' : 'Outside section'
        const addQuestionLabel = isFrench ? 'Question' : 'Question'
        const addMcqLabel = isFrench ? 'QCM' : 'MCQ'
        const addSectionLabel = isFrench ? 'Partie' : 'Section'

        const inSectionItems: AddInsertMenuItem[] = [
            {
                label: addQuestionLabel,
                onSelect: () => handleAddQuestion(sectionId, 'TEXT', false, questionId, false),
            },
            {
                label: addMcqLabel,
                onSelect: () => handleAddQuestion(sectionId, 'MCQ', false, questionId, false),
            },
        ]

        const outSectionItems: AddInsertMenuItem[] = [
            {
                label: addQuestionLabel,
                onSelect: () => handleAddQuestion(undefined, 'TEXT', false, questionId, true),
            },
            {
                label: addMcqLabel,
                onSelect: () => handleAddQuestion(undefined, 'MCQ', false, questionId, true),
            },
        ]

        const groups: AddInsertMenuGroup[] = []

        if (isStandalone) {
            groups.push({ items: outSectionItems })
            groups.push({ items: [{ label: addSectionLabel, onSelect: () => handleAddSection(false, questionId) }] })
        } else if (isLastInSection) {
            groups.push({ label: inSectionLabel, items: inSectionItems })
            groups.push({ label: outSectionLabel, items: outSectionItems })
            groups.push({ items: [{ label: addSectionLabel, onSelect: () => handleAddSection(false, questionId) }] })
        } else {
            groups.push({ items: inSectionItems })
        }

        const hideAddMenu = hoveredEditorKey === `question:${questionId}`

        return (
            <div className="pt-2">
                <div className="flex justify-end">
                    <div
                        className={
                            hideAddMenu
                                ? 'opacity-0 pointer-events-none'
                                : 'opacity-0 pointer-events-none transition-opacity group-hover/question:opacity-100 group-hover/question:pointer-events-auto group-focus-within/question:opacity-100 group-focus-within/question:pointer-events-auto'
                        }
                    >
                        <AddInsertMenu
                            label={isFrench ? 'Insérer ici' : 'Insert here'}
                            groups={groups}
                            disabled={loading || isLocked}
                            align="right"
                    />
                    </div>
                </div>
            </div>
        )
    }

    const renderMCQCard = (
        section: Exam['sections'][number],
        question: Question,
        questionIndex: number,
        isLastInSection: boolean,
        isStandalone: boolean,
        sectionIndex: number
    ) => {
        const sectionId = section.id
        const questionEditorKey = `question:${question.id}`
        const liveQuestion = liveExam.sections.find((s) => s.id === sectionId)?.questions.find((q) => q.id === question.id)
        const mcqOptions = liveQuestion?.segments || question.segments || []
        const sortedOptions = [...mcqOptions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        const requireAllCorrect = (liveQuestion?.requireAllCorrect ?? question.requireAllCorrect) === true
        const shuffleOptions = (liveQuestion?.shuffleOptions ?? question.shuffleOptions) === true
        const totalPoints = (liveQuestion?.maxPoints ?? question.maxPoints) ?? null
        const isManualTotal = mcqManualTotalPoints[question.id] === true
        const totalPointsError =
            hasQuestionPointsError(question.id) || (!requireAllCorrect && hasMcqTotalPointsMismatch(question.id))
        const computePositiveSum = (overrideId?: string, overrideValue?: number | null) => {
            return sortedOptions.reduce((sum, option) => {
                const value = option.id === overrideId ? overrideValue : option.maxPoints
                if (typeof value === 'number' && value > 0) return sum + value
                return sum
            }, 0)
        }
        const lockedBlockClass = isLocked ? 'opacity-60 pointer-events-none' : ''

        const handleMoveOption = async (fromIndex: number, toIndex: number) => {
            if (fromIndex === toIndex) return
            const source = sortedOptions[fromIndex]
            const target = sortedOptions[toIndex]
            if (!source || !target) return
            const sourceOrder = source.order ?? fromIndex
            const targetOrder = target.order ?? toIndex
            updateLiveSegmentOrder(sectionId, question.id, source.id, targetOrder)
            updateLiveSegmentOrder(sectionId, question.id, target.id, sourceOrder)
            await updateSegment(question.id, source.id, { order: targetOrder })
            await updateSegment(question.id, target.id, { order: sourceOrder })
        }

        const handleOptionShortcut = (event: React.KeyboardEvent, optionIndex: number) => {
            const isLast = optionIndex === sortedOptions.length - 1
            if (!isLast) return
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault()
                handleAddOption(question.id)
            }
        }

        return (
            <div key={question.id} className="bg-white p-4 space-y-3 group/question" data-question-id={question.id}>
                <div className={`relative flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:flex-nowrap pr-12 ${lockedBlockClass}`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4 md:flex-grow">
                        <div className="flex flex-col min-w-[7rem]">
                            <label className="text-xs font-semibold uppercase text-gray-500 leading-tight">
                                {dict.standaloneQuestionNumberLabel}
                            </label>
                            <input
                                type="text"
                                defaultValue={question.customLabel || ''}
                                placeholder="ex. 1., 1.1, a)"
                                className={`mt-1 w-32 rounded-md border px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:ring-brand-900 exam-placeholder placeholder:opacity-100 ${hasQuestionLabelError(question.id) ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                                disabled={isLocked}
                                onChange={(e) => updateLiveQuestionLabel(sectionId, question.id, e.target.value || null)}
                                onBlur={(e) => updateQuestion(sectionId, question.id, { customLabel: e.target.value.trim() || null })}
                            />
                        </div>
                        <div className="flex flex-col min-w-[8rem]">
                            <label className="text-xs font-semibold uppercase text-gray-500">{dict.standaloneTotalPointsLabel}</label>
                                <input
                                    type="number"
                                    value={totalPoints ?? ''}
                                    placeholder={dict.standaloneTotalPointsPlaceholder}
                                    className={`mt-1 w-32 rounded-md border px-3 py-2 text-sm text-gray-900 focus:outline-none exam-placeholder placeholder:opacity-100 ${totalPointsError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-brand-900 focus:ring-brand-900'}`}
                                    disabled={isLocked}
                                    onChange={(e) => {
                                        const raw = e.target.value
                                        if (raw.trim() === '') {
                                            setMcqManualTotalPoints((prev) => ({ ...prev, [question.id]: false }))
                                            updateLiveQuestionMaxPoints(sectionId, question.id, null)
                                            return
                                        }
                                        const value = Number(raw)
                                        if (Number.isFinite(value)) {
                                            setMcqManualTotalPoints((prev) => ({ ...prev, [question.id]: true }))
                                            updateLiveQuestionMaxPoints(sectionId, question.id, value)
                                        }
                                    }}
                                    onBlur={(e) => {
                                        const raw = e.target.value
                                        if (raw.trim() === '') {
                                            setMcqManualTotalPoints((prev) => ({ ...prev, [question.id]: false }))
                                            updateQuestion(sectionId, question.id, { maxPoints: null })
                                            return
                                        }
                                        const value = Number(raw)
                                        if (!Number.isFinite(value)) return
                                        setMcqManualTotalPoints((prev) => ({ ...prev, [question.id]: true }))
                                        updateQuestion(sectionId, question.id, { maxPoints: value })
                                    }}
                                />
                        </div>
                    </div>
                    <div
                        className={
                            questionPendingDelete === question.id && questionDeleteSource === 'card'
                                ? 'absolute right-0 top-0 z-10 flex items-center gap-2'
                                : 'absolute right-0 top-0 z-10 flex items-center gap-2 opacity-0 pointer-events-none transition-opacity group-hover/question:opacity-100 group-hover/question:pointer-events-auto group-focus-within/question:opacity-100 group-focus-within/question:pointer-events-auto'
                        }
                    >
                        {!isFocusMode &&
                            renderQuestionMoveButtons({ section, questionIndex, sectionIndex })}
                        <div className="relative flex items-center">
                            <button
                                type="button"
                                onClick={() => handleDeleteQuestionClick(question.id, 'card')}
                                title={dict.deleteQuestionTooltip}
                                aria-label={dict.deleteQuestionTooltip}
                                className={`inline-flex items-center justify-center rounded-md border border-transparent p-2 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-50 ${questionPendingDelete === question.id ? 'invisible' : ''}`}
                                disabled={isLocked}
                            >
                                <Trash2 className="w-4 h-4" />
                                <span className="sr-only">{dict.deleteQuestionTooltip}</span>
                            </button>
                            {questionPendingDelete === question.id && questionDeleteSource === 'card' && (
                                <div
                                    ref={questionDeleteConfirmRef}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 inline-flex items-center gap-2 border border-red-200 rounded-md px-3 py-2 bg-red-50 whitespace-nowrap shadow-lg"
                                >
                                    <span className="text-sm text-red-700 font-medium whitespace-nowrap">
                                        {confirmDeleteQuestionLabel}
                                    </span>
                                    <button
                                        onClick={() => handleConfirmDeleteQuestion(sectionId, question.id)}
                                        disabled={isDeletingQuestion}
                                        className="text-sm font-semibold text-red-700 disabled:opacity-50"
                                    >
                                        {isDeletingQuestion ? (locale === 'fr' ? 'Suppression...' : 'Deleting...') : confirmDeleteQuestionAction}
                                    </button>
                                    <button
                                        onClick={handleCancelDeleteQuestion}
                                        disabled={isDeletingQuestion}
                                        className="text-sm text-gray-500 disabled:opacity-50"
                                    >
                                        {confirmDeleteQuestionCancel}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {!requireAllCorrect && (
                    <div className="grid grid-cols-[8rem_1fr] gap-x-4">
                        <div />
                        <p className={`text-[11px] leading-snug ${hasMcqTotalPointsMismatch(question.id) ? 'text-red-600' : 'text-gray-600'}`}>
                            {hasMcqTotalPointsMismatch(question.id) ? mcqTotalPointsMismatchText : mcqTotalPointsHint}
                        </p>
                    </div>
                )}

                <div className={`space-y-4 ${lockedBlockClass}`}>
                    <div className="space-y-2">
                        <div className="flex items-center justify-start">
                            <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={requireAllCorrect}
                                    onChange={(event) => {
                                        const checked = event.target.checked
                                        updateLiveQuestionRequireAllCorrect(sectionId, question.id, checked)
                                        updateQuestion(sectionId, question.id, { requireAllCorrect: checked })
                                    }}
                                    disabled={isLocked}
                                    className="h-4 w-4 text-brand-900 border-gray-300 rounded focus:ring-brand-900"
                                />
                                {locale === 'fr'
                                    ? 'Toutes les bonnes réponses doivent être cochées pour obtenir tous les points'
                                    : 'All correct answers must be selected to earn full points'}
                            </label>
                        </div>
                        <div className="flex items-center justify-start">
                            <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={shuffleOptions}
                                    onChange={(event) => {
                                        const checked = event.target.checked
                                        updateLiveQuestionShuffleOptions(sectionId, question.id, checked)
                                        updateQuestion(sectionId, question.id, { shuffleOptions: checked })
                                    }}
                                    disabled={isLocked}
                                    className="h-4 w-4 text-brand-900 border-gray-300 rounded focus:ring-brand-900"
                                />
                                {locale === 'fr'
                                    ? 'M\u00e9langer l\u2019ordre des options c\u00f4t\u00e9 \u00e9tudiant'
                                    : 'Shuffle answer options for students'}
                            </label>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-semibold uppercase text-gray-500">{dict.standaloneQuestionTextLabel}</label>
                        </div>
                        <div
                            className={hasQuestionContentError(question.id) ? 'ring-2 ring-red-500 rounded' : ''}
                            data-editor-key={questionEditorKey}
                            {...getEditorHoverHandlers(questionEditorKey)}
                        >
                            <SegmentedMathField
                                value={
                                    liveExam.sections.find((s) => s.id === sectionId)?.questions.find((q) => q.id === question.id)?.content ||
                                    question.content ||
                                    []
                                }
                                onChange={(segments) => updateLiveQuestionContent(sectionId, question.id, segments)}
                                placeholder={questionPlaceholder}
                                className="mt-1"
                                disabled={isLocked}
                                onBlur={() => {
                                    const questionData = liveExam.sections.find((s) => s.id === sectionId)?.questions.find((q) => q.id === question.id)
                                    if (questionData) updateQuestion(sectionId, question.id, { content: questionData.content })
                                }}
                                minRows={1}
                                locale={locale}
                                editorSize="sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        {requireAllCorrect && sortedOptions.length > 0 && (
                            <p className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-700">
                                {locale === 'fr'
                                    ? 'Cochez les bonnes réponses pour ce QCM.'
                                    : 'Check the correct answers for this MCQ.'}
                            </p>
                        )}
                        {sortedOptions.map((option, optionIndex) => {
                            const liveOption = liveExam.sections.find((s) => s.id === sectionId)
                                ?.questions.find((q) => q.id === question.id)
                                ?.segments?.find((seg) => seg.id === option.id)
                            const instructionValue = liveOption?.instruction ?? option.instruction ?? ''
                            const isCorrect = Boolean(liveOption?.isCorrect ?? option.isCorrect)

                            const canMoveUp = optionIndex > 0
                            const canMoveDown = optionIndex < sortedOptions.length - 1

                            return (
                                <div key={option.id} className="relative border border-gray-200 rounded-md p-3 space-y-2 group/option">
                                    <div className={`grid gap-2 items-start ${requireAllCorrect ? 'grid-cols-[3rem,1fr]' : 'grid-cols-[2rem,1fr,7rem]'}`}>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                            {requireAllCorrect && (
                                                <input
                                                    type="checkbox"
                                                    checked={isCorrect}
                                                    disabled={isLocked}
                                                    onChange={(e) => {
                                                        const nextValue = e.target.checked
                                                        updateLiveSegmentCorrect(sectionId, question.id, option.id, nextValue)
                                                        updateSegment(question.id, option.id, { isCorrect: nextValue })
                                                    }}
                                                    className="h-4 w-4 text-brand-900 border-gray-300 rounded focus:ring-brand-900"
                                                    aria-label={locale === 'fr' ? 'Bonne réponse' : 'Correct answer'}
                                                />
                                            )}
                                            <span className="text-sm font-semibold text-gray-700 leading-snug">
                                                {String.fromCharCode(65 + optionIndex)}.
                                            </span>
                                            </div>
                                            <div className="relative flex items-center justify-end gap-1 opacity-0 pointer-events-none transition-opacity group-hover/option:opacity-100 group-hover/option:pointer-events-auto group-focus-within/option:opacity-100 group-focus-within/option:pointer-events-auto">
                                                {canMoveUp && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveOption(optionIndex, optionIndex - 1)}
                                                        className="rounded border border-gray-200 bg-white p-1 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                                        disabled={isLocked}
                                                    >
                                                        <ArrowUp className="h-3 w-3" />
                                                    </button>
                                                )}
                                                {canMoveDown && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveOption(optionIndex, optionIndex + 1)}
                                                        className="rounded border border-gray-200 bg-white p-1 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                                        disabled={isLocked}
                                                    >
                                                        <ArrowDown className="h-3 w-3" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteMcqOptionClick(option.id)}
                                                    title={deleteOptionLabel}
                                                    aria-label={deleteOptionLabel}
                                                    className={`p-2 rounded-md border border-transparent text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-200 ${mcqOptionPendingDelete === option.id ? 'invisible' : ''}`}
                                                    disabled={isLocked}
                                                    type="button"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    <span className="sr-only">{deleteOptionLabel}</span>
                                                </button>
                                                {mcqOptionPendingDelete === option.id && (
                                                    <div
                                                        ref={mcqOptionDeleteConfirmRef}
                                                        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 inline-flex items-center gap-2 border border-red-200 rounded-md px-3 py-2 bg-red-50 whitespace-nowrap shadow-lg"
                                                    >
                                                        <span className="text-sm text-red-700 font-medium whitespace-nowrap">
                                                            {confirmDeleteQuestionLabel}
                                                        </span>
                                                        <button
                                                            onClick={() => handleConfirmDeleteMcqOption(question.id, option.id)}
                                                            disabled={isDeletingMcqOption}
                                                            className="text-sm font-semibold text-red-700 disabled:opacity-50"
                                                            type="button"
                                                        >
                                                            {isDeletingMcqOption ? (locale === 'fr' ? 'Suppression...' : 'Deleting...') : confirmDeleteQuestionAction}
                                                        </button>
                                                        <button
                                                            onClick={handleCancelDeleteMcqOption}
                                                            disabled={isDeletingMcqOption}
                                                            className="text-sm text-gray-500 disabled:opacity-50"
                                                            type="button"
                                                        >
                                                            {confirmDeleteQuestionCancel}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div
                                            className={hasMcqOptionTextError(question.id, option.id) ? 'ring-2 ring-red-500 rounded' : ''}
                                            data-editor-key={questionEditorKey}
                                            data-option-editor
                                            onKeyDownCapture={(event) => handleOptionShortcut(event, optionIndex)}
                                            {...getEditorHoverHandlers(questionEditorKey)}
                                        >
                                            <StringMathField
                                                value={instructionValue}
                                                placeholder={locale === 'fr' ? "Texte de l'option" : 'Option text'}
                                                disabled={isLocked}
                                                onChange={(val) => updateLiveSegmentInstruction(sectionId, question.id, option.id, val)}
                                            onBlur={(currentValue) => updateSegment(question.id, option.id, { instruction: currentValue })}
                                            minRows={1}
                                            showTableButton
                                            showGraphButton
                                            editorSize="sm"
                                            locale={locale}
                                        />
                                    </div>
                                        {!requireAllCorrect && (
                                            <input
                                                type="number"
                                                value={option.maxPoints ?? ''}
                                                placeholder={mcqOptionPointsPlaceholder}
                                                className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900 focus:outline-none exam-placeholder placeholder:opacity-100 ${hasMcqOptionPointsError(question.id, option.id) ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-brand-900 focus:ring-brand-900'}`}
                                                disabled={isLocked}
                                                onKeyDown={(event) => handleOptionShortcut(event, optionIndex)}
                                                onChange={(e) => {
                                                    const raw = e.target.value
                                                    if (raw.trim() === '') {
                                                        updateLiveSegmentPoints(sectionId, question.id, option.id, null)
                                                        if (!isManualTotal) {
                                                            const nextSum = computePositiveSum(option.id, null)
                                                            updateLiveQuestionMaxPoints(sectionId, question.id, nextSum)
                                                        }
                                                        return
                                                    }
                                                    const value = Number(raw)
                                                    if (Number.isFinite(value)) {
                                                        updateLiveSegmentPoints(sectionId, question.id, option.id, value)
                                                        if (!isManualTotal) {
                                                            const nextSum = computePositiveSum(option.id, value)
                                                            updateLiveQuestionMaxPoints(sectionId, question.id, nextSum)
                                                        }
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    const raw = e.target.value
                                                    if (raw.trim() === '') {
                                                        updateSegment(question.id, option.id, { maxPoints: null })
                                                        if (!isManualTotal) {
                                                            const nextSum = computePositiveSum(option.id, null)
                                                            updateQuestion(sectionId, question.id, { maxPoints: nextSum })
                                                        }
                                                        return
                                                    }
                                                    const value = Number(raw)
                                                    if (!Number.isFinite(value)) return
                                                    updateSegment(question.id, option.id, { maxPoints: value })
                                                    if (!isManualTotal) {
                                                        const nextSum = computePositiveSum(option.id, value)
                                                        updateQuestion(sectionId, question.id, { maxPoints: nextSum })
                                                    }
                                                }}
                                            />
                                        )}
                                    </div>
                                    {requireAllCorrect && (
                                        <p className="text-[11px] text-gray-600 leading-snug">
                                            {locale === 'fr'
                                                ? 'Les points par option sont ignorés si toutes les réponses doivent être justes.'
                                                : 'Per-option points are ignored when all answers must be correct.'}
                                        </p>
                                    )}
                                </div>
                            )
                        })}
                        <div>
                            {sortedOptions.length === 0 ? (
                                <button
                                    onClick={() => handleAddOption(question.id)}
                                    className="inline-flex items-center px-3 py-2 rounded-md border border-brand-900 text-brand-900 hover:bg-brand-50 text-sm font-semibold disabled:opacity-50"
                                    disabled={isLocked || loading}
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    {locale === 'fr' ? 'Ajouter une option' : 'Add option'}
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleAddOption(question.id)}
                                    className="inline-flex items-center justify-center rounded-md border border-transparent p-2 text-gray-500 hover:text-brand-900 hover:border-brand-200 hover:bg-brand-50 disabled:opacity-50"
                                    disabled={isLocked || loading}
                                    title={locale === 'fr' ? 'Ajouter une option' : 'Add option'}
                                    aria-label={locale === 'fr' ? 'Ajouter une option' : 'Add option'}
                                >
                                    <Plus className="w-4 h-4" />
                                    <span className="sr-only">{locale === 'fr' ? 'Ajouter une option' : 'Add option'}</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                <div className={lockedBlockClass}>
                    {renderActionButtons({ sectionId, questionId: question.id, isStandalone, isLastInSection })}
                </div>
            </div>
        )
    }

    const renderQuestionCard = (
        section: Exam['sections'][number],
        question: Question,
        questionIndex: number,
        isLastInSection: boolean,
        isStandalone: boolean,
        sectionIndex: number
    ) => {
        if (question.type === 'MCQ') {
            return renderMCQCard(section, question, questionIndex, isLastInSection, isStandalone, sectionIndex)
        }
        const sectionId = section.id
        const questionEditorKey = `question:${question.id}`

        // Use live data from liveExam for all segment fields to ensure proper updates
        const liveQuestion = liveExam.sections.find((s) => s.id === sectionId)?.questions.find((q) => q.id === question.id)
        const primarySegment = liveQuestion?.segments?.[0] ?? question.segments?.[0]
        const segmentId = primarySegment?.id
        const totalPoints = primarySegment?.maxPoints ?? 0
        const currentRubric = primarySegment?.rubric ?? { levels: [], examples: [] }
        const correctionNotes = currentRubric.criteria ?? ''
        const perfectAnswer = (() => {
            const examples = currentRubric.examples
            if (!examples) return ''
            return Array.isArray(examples) ? examples.filter(Boolean).join('\n\n') : examples
        })()
        const answerTemplate =
            liveQuestion?.answerTemplate ||
            question.answerTemplate ||
            []
        const templatePanelOverride = classicQuestionPanelsOpen[question.id]?.template
        const templatePanelOpen = templatePanelOverride ?? answerTemplate.length > 0
        const perfectPanelOverride = classicQuestionPanelsOpen[question.id]?.perfect
        const perfectPanelOpen = perfectPanelOverride ?? Boolean(perfectAnswer.trim())
        const noticePanelOverride = classicQuestionPanelsOpen[question.id]?.notice
        const noticePanelOpen = noticePanelOverride ?? Boolean(correctionNotes.trim())
        const studentTools = liveQuestion?.studentTools ?? question.studentTools ?? null
        const normalizedStudentTools = normalizeStudentTools(studentTools)
        const hasCustomStudentTools = Boolean(studentTools)
        const toolsPanelOverride = classicQuestionPanelsOpen[question.id]?.tools
        const toolsPanelOpen = toolsPanelOverride ?? true
        const updateStudentTools = (nextTools: StudentToolsConfig | null, persist = true) => {
            updateLiveQuestionStudentTools(sectionId, question.id, nextTools)
            if (persist) {
                updateQuestion(sectionId, question.id, { studentTools: nextTools })
            }
        }
        const coerceOptionalPositiveInt = (rawValue: string) => {
            const trimmed = rawValue.trim()
            if (!trimmed) return null
            const parsed = Number(trimmed)
            if (!Number.isFinite(parsed) || parsed <= 0) return null
            return Math.floor(parsed)
        }
        const mathEnabled = normalizedStudentTools.math?.enabled !== false
        const tableEnabled = normalizedStudentTools.table?.enabled !== false
        const graphEnabled = normalizedStudentTools.graph?.enabled !== false
        const yesLabel = locale === 'fr' ? 'Oui' : 'Yes'
        const noLabel = locale === 'fr' ? 'Non' : 'No'
        const templatePreview = buildCollapsedPreview(segmentsToPlainText(answerTemplate || []))
        const perfectPreview = buildCollapsedPreview(perfectAnswer)
        const noticePreview = buildCollapsedPreview(correctionNotes)
        const hasTemplateContent = (segments: ContentSegment[]) => segments.some((segment) => {
            if (segment.type === 'text') return Boolean(segment.text?.trim())
            if (segment.type === 'math') return Boolean(segment.latex?.trim())
            if (segment.type === 'table' || segment.type === 'graph') return true
            return false
        })
        const toolsPreview = `${mathToolsLabel}: ${mathEnabled ? yesLabel : noLabel} (${mathSymbolsLabel}: ${
            normalizedStudentTools.math?.symbolSet === 'basic' ? mathSymbolsBasicLabel : mathSymbolsFullLabel
        }) · ${tableToolsLabel}: ${tableEnabled ? yesLabel : noLabel} · ${graphToolsLabel}: ${graphEnabled ? yesLabel : noLabel}`

        return (
            <div key={question.id} className="bg-white p-4 space-y-3 group/question">
                <div className={`relative flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:flex-nowrap pr-12 ${lockedBlockClass}`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4 md:flex-grow">
                        <div className="flex flex-col min-w-[6rem]">
                            <label className="text-xs font-semibold uppercase text-gray-500">{dict.standaloneQuestionNumberLabel}</label>
                            <input
                                type="text"
                                defaultValue={question.customLabel || ''}
                                placeholder="ex. 1., 1.1, a)"
                                className={`mt-1 w-32 rounded-md border px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:ring-brand-900 exam-placeholder placeholder:opacity-100 ${hasQuestionLabelError(question.id) ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                                disabled={isLocked}
                                onChange={(e) => updateLiveQuestionLabel(sectionId, question.id, e.target.value || null)}
                                onBlur={(e) => {
                                    const rawValue = e.target.value.trim()
                                    const payload: Partial<Question> = { customLabel: rawValue || null }
                                    const numericValue = Number(rawValue)
                                    if (rawValue && Number.isFinite(numericValue)) payload.order = numericValue
                                    updateQuestion(sectionId, question.id, payload)
                                }}
                            />
                        </div>
                        <div className="flex flex-col min-w-[6rem]">
                            <label className="text-xs font-semibold uppercase text-gray-500">{dict.standaloneTotalPointsLabel}</label>
                            <input
                                type="number"
                                defaultValue={totalPoints || ''}
                                placeholder={dict.standaloneTotalPointsPlaceholder}
                                className={`mt-1 w-32 rounded-md border px-3 py-2 text-sm text-gray-900 focus:outline-none exam-placeholder placeholder:opacity-100 ${hasQuestionPointsError(question.id) ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-brand-900 focus:ring-brand-900'}`}
                                disabled={isLocked}
                                onChange={(e) => {
                                    if (!segmentId) return
                                    const value = Number(e.target.value)
                                    if (Number.isFinite(value) && value >= 0) {
                                        updateLiveSegmentPoints(sectionId, question.id, segmentId, value)
                                    }
                                }}
                                onBlur={(e) => {
                                    if (!segmentId) return
                                    const value = Number(e.target.value)
                                    if (!Number.isFinite(value)) return
                                    updateSegment(question.id, segmentId, { maxPoints: value })
                                }}
                            />
                        </div>
                    </div>
                    <div
                        className={
                            questionPendingDelete === question.id && questionDeleteSource === 'card'
                                ? 'absolute right-0 top-0 z-10 flex items-center gap-2'
                                : 'absolute right-0 top-0 z-10 flex items-center gap-2 opacity-0 pointer-events-none transition-opacity group-hover/question:opacity-100 group-hover/question:pointer-events-auto group-focus-within/question:opacity-100 group-focus-within/question:pointer-events-auto'
                        }
                    >
                        {!isFocusMode &&
                            renderQuestionMoveButtons({ section, questionIndex, sectionIndex })}
                        <div className="relative flex items-center">
                            <button
                                type="button"
                                onClick={() => handleDeleteQuestionClick(question.id, 'card')}
                                title={dict.deleteQuestionTooltip}
                                aria-label={dict.deleteQuestionTooltip}
                                className={`inline-flex items-center justify-center rounded-md border border-transparent p-2 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-50 ${questionPendingDelete === question.id ? 'invisible' : ''}`}
                                disabled={isLocked}
                            >
                                <Trash2 className="w-4 h-4" />
                                <span className="sr-only">{dict.deleteQuestionTooltip}</span>
                            </button>
                            {questionPendingDelete === question.id && questionDeleteSource === 'card' && (
                                <div
                                    ref={questionDeleteConfirmRef}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 inline-flex items-center gap-2 border border-red-200 rounded-md px-3 py-2 bg-red-50 whitespace-nowrap shadow-lg"
                                >
                                    <span className="text-sm text-red-700 font-medium whitespace-nowrap">
                                        {confirmDeleteQuestionLabel}
                                    </span>
                                    <button
                                        onClick={() => handleConfirmDeleteQuestion(sectionId, question.id)}
                                        disabled={isDeletingQuestion}
                                        className="text-sm font-semibold text-red-700 disabled:opacity-50"
                                    >
                                        {isDeletingQuestion ? (locale === 'fr' ? 'Suppression...' : 'Deleting...') : confirmDeleteQuestionAction}
                                    </button>
                                    <button
                                        onClick={handleCancelDeleteQuestion}
                                        disabled={isDeletingQuestion}
                                        className="text-sm text-gray-500 disabled:opacity-50"
                                    >
                                        {confirmDeleteQuestionCancel}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className={lockedBlockClass}>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold uppercase text-gray-500">{dict.standaloneQuestionTextLabel}</label>
                    </div>
                    <div
                        className={hasQuestionContentError(question.id) ? 'ring-2 ring-red-500 rounded' : ''}
                        data-editor-key={questionEditorKey}
                        {...getEditorHoverHandlers(questionEditorKey)}
                    >
                        <SegmentedMathField
                            value={
                                liveExam.sections.find((s) => s.id === sectionId)?.questions.find((q) => q.id === question.id)?.content ||
                                question.content ||
                                []
                            }
                            onChange={(segments) => updateLiveQuestionContent(sectionId, question.id, segments)}
                            placeholder={questionPlaceholder}
                            className="mt-1"
                            disabled={isLocked}
                            onBlur={() => {
                                const questionData = liveExam.sections.find((s) => s.id === sectionId)?.questions.find((q) => q.id === question.id)
                                if (questionData) updateQuestion(sectionId, question.id, { content: questionData.content })
                            }}
                            minRows={1}
                            locale={locale}
                            editorSize="sm"
                        />
                    </div>
                </div>

                <div className={`pt-3 border-t border-gray-200 ${lockedBlockClass}`}>
                    <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
                        onClick={() => {
                            setClassicQuestionPanelsOpen((prev) => ({
                                ...prev,
                                [question.id]: { ...prev[question.id], template: !templatePanelOpen },
                            }))
                        }}
                    >
                        <label className="text-xs font-semibold uppercase text-gray-500 cursor-pointer">{answerTemplateLabel}</label>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 cursor-pointer">
                            {templatePanelOpen ? (locale === 'fr' ? 'Masquer' : 'Hide') : (locale === 'fr' ? 'Afficher' : 'Show')}
                            <ChevronDown className={`h-3 w-3 transition-transform ${templatePanelOpen ? 'rotate-180' : ''}`} />
                        </span>
                    </button>
                    {!templatePanelOpen && templatePreview && (
                        <div className="mt-1 text-[11px] text-gray-500">{templatePreview}</div>
                    )}
                    {templatePanelOpen && (
                        <div data-editor-key={questionEditorKey} {...getEditorHoverHandlers(questionEditorKey)}>
                            <SegmentedMathField
                                value={answerTemplate}
                                onChange={(segments) => {
                                    updateLiveQuestionAnswerTemplate(sectionId, question.id, segments)
                                    updateLiveQuestionAnswerTemplateLocked(sectionId, question.id, hasTemplateContent(segments))
                                }}
                                placeholder={answerTemplatePlaceholder}
                                className="mt-1"
                                disabled={isLocked}
                                onBlur={() => {
                                    const questionData = liveExam.sections.find((s) => s.id === sectionId)?.questions.find((q) => q.id === question.id)
                                    if (!questionData) return
                                    const segments = questionData.answerTemplate || []
                                    updateQuestion(sectionId, question.id, {
                                        answerTemplate: segments,
                                        answerTemplateLocked: hasTemplateContent(segments),
                                    })
                                }}
                                minRows={1}
                                locale={locale}
                                editorSize="sm"
                            />
                        </div>
                    )}
                </div>

                <div className={`pt-3 border-t border-gray-200 ${lockedBlockClass}`}>
                    <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
                        onClick={() => {
                            setClassicQuestionPanelsOpen((prev) => ({
                                ...prev,
                                [question.id]: { ...prev[question.id], tools: !toolsPanelOpen },
                            }))
                        }}
                    >
                        <label className="text-xs font-semibold uppercase text-gray-500 cursor-pointer">{studentToolsLabel}</label>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 cursor-pointer">
                            {toolsPanelOpen ? (locale === 'fr' ? 'Masquer' : 'Hide') : (locale === 'fr' ? 'Afficher' : 'Show')}
                            <ChevronDown className={`h-3 w-3 transition-transform ${toolsPanelOpen ? 'rotate-180' : ''}`} />
                        </span>
                    </button>
                    {!toolsPanelOpen && toolsPreview && (
                        <div className="mt-1 text-[11px] text-gray-500">{toolsPreview}</div>
                    )}
                    {toolsPanelOpen && (
                        <div className="mt-2">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <p className="text-xs text-gray-500">{studentToolsHelper}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                            checked={hasCustomStudentTools}
                                            disabled={isLocked}
                                            onChange={(e) => {
                                                const enabled = e.target.checked
                                                if (enabled) {
                                                    updateStudentTools({ ...defaultStudentTools })
                                                } else {
                                                    updateStudentTools(null)
                                                }
                                            }}
                                        />
                                        <span>{studentToolsToggleLabel}</span>
                                    </label>
                                    {hasCustomStudentTools && (
                                        <button
                                            type="button"
                                            className="text-xs font-semibold text-gray-600 hover:text-gray-800"
                                            onClick={() => updateStudentTools(null)}
                                            disabled={isLocked}
                                        >
                                            {studentToolsResetLabel}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {!hasCustomStudentTools ? (
                                <div className="mt-2 text-xs text-gray-500">{toolsPreview}</div>
                            ) : (
                                <div className="mt-3 space-y-3">
                            <div className="rounded-md border border-gray-200 p-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-gray-700">{mathToolsLabel}</label>
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                        checked={mathEnabled}
                                        disabled={isLocked}
                                        onChange={(e) => {
                                            updateStudentTools({
                                                ...normalizedStudentTools,
                                                math: {
                                                    ...normalizedStudentTools.math,
                                                    enabled: e.target.checked,
                                                },
                                            })
                                        }}
                                    />
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] font-semibold uppercase text-gray-500">
                                        {mathSymbolsLabel}
                                    </span>
                                    <select
                                        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-brand-900 focus:ring-brand-900"
                                        value={normalizedStudentTools.math?.symbolSet || 'full'}
                                        disabled={isLocked || !mathEnabled}
                                        onChange={(e) => {
                                            const value = e.target.value as StudentMathSymbolSet
                                            updateStudentTools({
                                                ...normalizedStudentTools,
                                                math: {
                                                    ...normalizedStudentTools.math,
                                                    symbolSet: value,
                                                },
                                            })
                                        }}
                                    >
                                        <option value="basic">{mathSymbolsBasicLabel}</option>
                                        <option value="full">{mathSymbolsFullLabel}</option>
                                    </select>
                                </div>
                                <div className={`mt-2 grid gap-2 sm:grid-cols-2 text-[11px] ${mathEnabled ? 'text-gray-600' : 'text-gray-400'}`}>
                                    <button
                                        type="button"
                                        className={`rounded-md border px-2 py-1 ${normalizedStudentTools.math?.symbolSet === 'basic'
                                            ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                                            : 'border-gray-200 bg-white'}`}
                                        disabled={isLocked || !mathEnabled}
                                        onClick={() => {
                                            updateStudentTools({
                                                ...normalizedStudentTools,
                                                math: {
                                                    ...normalizedStudentTools.math,
                                                    symbolSet: 'basic',
                                                },
                                            })
                                        }}
                                    >
                                        <div className="mb-1 text-[10px] font-semibold uppercase text-gray-500">{mathSymbolsBasicLabel}</div>
                                        <div className="flex flex-wrap gap-1">
                                            {basicMathSymbolPreview.map((symbol) => (
                                                <span key={`basic-${symbol}`} className="px-1 py-0.5 rounded border border-gray-200 bg-gray-50">
                                                    {symbol}
                                                </span>
                                            ))}
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        className={`rounded-md border px-2 py-1 ${normalizedStudentTools.math?.symbolSet === 'full'
                                            ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                                            : 'border-gray-200 bg-white'}`}
                                        disabled={isLocked || !mathEnabled}
                                        onClick={() => {
                                            updateStudentTools({
                                                ...normalizedStudentTools,
                                                math: {
                                                    ...normalizedStudentTools.math,
                                                    symbolSet: 'full',
                                                },
                                            })
                                        }}
                                    >
                                        <div className="mb-1 text-[10px] font-semibold uppercase text-gray-500">{mathSymbolsFullLabel}</div>
                                        <div className="flex flex-wrap gap-1">
                                            {fullMathSymbolPreview.map((symbol) => (
                                                <span key={`full-${symbol}`} className="px-1 py-0.5 rounded border border-gray-200 bg-gray-50">
                                                    {symbol}
                                                </span>
                                            ))}
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-md border border-gray-200 p-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-gray-700">{tableToolsLabel}</label>
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                        checked={tableEnabled}
                                        disabled={isLocked}
                                        onChange={(e) => {
                                            updateStudentTools({
                                                ...normalizedStudentTools,
                                                table: {
                                                    ...normalizedStudentTools.table,
                                                    enabled: e.target.checked,
                                                },
                                            })
                                        }}
                                    />
                                </div>
                                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                    <label className="text-xs text-gray-600 flex flex-col gap-1">
                                        <span className="font-semibold">{tableMaxRowsLabel}</span>
                                        <input
                                            type="number"
                                            min={1}
                                            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-brand-900 focus:ring-brand-900"
                                            value={normalizedStudentTools.table?.maxRows ?? ''}
                                            disabled={isLocked || !tableEnabled}
                                            onChange={(e) => {
                                                const nextValue = coerceOptionalPositiveInt(e.target.value)
                                                updateLiveQuestionStudentTools(sectionId, question.id, {
                                                    ...normalizedStudentTools,
                                                    table: {
                                                        ...normalizedStudentTools.table,
                                                        maxRows: nextValue,
                                                    },
                                                })
                                            }}
                                            onBlur={(e) => {
                                                const nextValue = coerceOptionalPositiveInt(e.target.value)
                                                updateStudentTools({
                                                    ...normalizedStudentTools,
                                                    table: {
                                                        ...normalizedStudentTools.table,
                                                        maxRows: nextValue,
                                                    },
                                                })
                                            }}
                                        />
                                    </label>
                                    <label className="text-xs text-gray-600 flex flex-col gap-1">
                                        <span className="font-semibold">{tableMaxColsLabel}</span>
                                        <input
                                            type="number"
                                            min={1}
                                            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-brand-900 focus:ring-brand-900"
                                            value={normalizedStudentTools.table?.maxCols ?? ''}
                                            disabled={isLocked || !tableEnabled}
                                            onChange={(e) => {
                                                const nextValue = coerceOptionalPositiveInt(e.target.value)
                                                updateLiveQuestionStudentTools(sectionId, question.id, {
                                                    ...normalizedStudentTools,
                                                    table: {
                                                        ...normalizedStudentTools.table,
                                                        maxCols: nextValue,
                                                    },
                                                })
                                            }}
                                            onBlur={(e) => {
                                                const nextValue = coerceOptionalPositiveInt(e.target.value)
                                                updateStudentTools({
                                                    ...normalizedStudentTools,
                                                    table: {
                                                        ...normalizedStudentTools.table,
                                                        maxCols: nextValue,
                                                    },
                                                })
                                            }}
                                        />
                                    </label>
                                    <label className="inline-flex items-center gap-2 text-xs text-gray-600 mt-1">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                            checked={normalizedStudentTools.table?.allowMath !== false}
                                            disabled={isLocked || !tableEnabled}
                                            onChange={(e) => {
                                                updateStudentTools({
                                                    ...normalizedStudentTools,
                                                    table: {
                                                        ...normalizedStudentTools.table,
                                                        allowMath: e.target.checked,
                                                    },
                                                })
                                            }}
                                        />
                                        <span className="font-semibold">{tableAllowMathLabel}</span>
                                    </label>
                                </div>
                            </div>

                            <div className="rounded-md border border-gray-200 p-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-gray-700">{graphToolsLabel}</label>
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                        checked={graphEnabled}
                                        disabled={isLocked}
                                        onChange={(e) => {
                                            updateStudentTools({
                                                ...normalizedStudentTools,
                                                graph: {
                                                    ...normalizedStudentTools.graph,
                                                    enabled: e.target.checked,
                                                },
                                            })
                                        }}
                                    />
                                </div>
                                <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                            checked={normalizedStudentTools.graph?.allowPoints !== false}
                                            disabled={isLocked || !graphEnabled}
                                            onChange={(e) => {
                                                updateStudentTools({
                                                    ...normalizedStudentTools,
                                                    graph: {
                                                        ...normalizedStudentTools.graph,
                                                        allowPoints: e.target.checked,
                                                    },
                                                })
                                            }}
                                        />
                                        <span className="font-semibold">{graphPointsLabel}</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                            checked={normalizedStudentTools.graph?.allowLines !== false}
                                            disabled={isLocked || !graphEnabled}
                                            onChange={(e) => {
                                                updateStudentTools({
                                                    ...normalizedStudentTools,
                                                    graph: {
                                                        ...normalizedStudentTools.graph,
                                                        allowLines: e.target.checked,
                                                    },
                                                })
                                            }}
                                        />
                                        <span className="font-semibold">{graphLinesLabel}</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                            checked={normalizedStudentTools.graph?.allowCurves !== false}
                                            disabled={isLocked || !graphEnabled}
                                            onChange={(e) => {
                                                updateStudentTools({
                                                    ...normalizedStudentTools,
                                                    graph: {
                                                        ...normalizedStudentTools.graph,
                                                        allowCurves: e.target.checked,
                                                    },
                                                })
                                            }}
                                        />
                                        <span className="font-semibold">{graphCurvesLabel}</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                            checked={normalizedStudentTools.graph?.allowFunctions !== false}
                                            disabled={isLocked || !graphEnabled}
                                            onChange={(e) => {
                                                updateStudentTools({
                                                    ...normalizedStudentTools,
                                                    graph: {
                                                        ...normalizedStudentTools.graph,
                                                        allowFunctions: e.target.checked,
                                                    },
                                                })
                                            }}
                                        />
                                        <span className="font-semibold">{graphFunctionsLabel}</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                            checked={normalizedStudentTools.graph?.allowAreas !== false}
                                            disabled={isLocked || !graphEnabled}
                                            onChange={(e) => {
                                                updateStudentTools({
                                                    ...normalizedStudentTools,
                                                    graph: {
                                                        ...normalizedStudentTools.graph,
                                                        allowAreas: e.target.checked,
                                                    },
                                                })
                                            }}
                                        />
                                        <span className="font-semibold">{graphAreasLabel}</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                                            checked={normalizedStudentTools.graph?.allowText !== false}
                                            disabled={isLocked || !graphEnabled}
                                            onChange={(e) => {
                                                updateStudentTools({
                                                    ...normalizedStudentTools,
                                                    graph: {
                                                        ...normalizedStudentTools.graph,
                                                        allowText: e.target.checked,
                                                    },
                                                })
                                            }}
                                        />
                                        <span className="font-semibold">{graphTextLabel}</span>
                                    </label>
                                </div>
                            </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className={`pt-3 border-t border-gray-200 ${lockedBlockClass}`}>
                    <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
                        onClick={() => {
                            setClassicQuestionPanelsOpen((prev) => ({
                                ...prev,
                                [question.id]: { ...prev[question.id], notice: !noticePanelOpen },
                            }))
                        }}
                    >
                        <label className="text-xs font-semibold uppercase text-gray-500 cursor-pointer">{dict.standaloneNoticeLabel}</label>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 cursor-pointer">
                            {noticePanelOpen ? (locale === 'fr' ? 'Masquer' : 'Hide') : (locale === 'fr' ? 'Afficher' : 'Show')}
                            <ChevronDown className={`h-3 w-3 transition-transform ${noticePanelOpen ? 'rotate-180' : ''}`} />
                        </span>
                    </button>
                    {!noticePanelOpen && noticePreview && (
                        <div className="mt-1 text-[11px] text-gray-500">{noticePreview}</div>
                    )}
                    {noticePanelOpen && (
                        <div data-editor-key={questionEditorKey} {...getEditorHoverHandlers(questionEditorKey)}>
                            <StringMathField
                                value={correctionNotes || ''}
                                onChange={(val) => {
                                    if (segmentId) updateLiveSegmentCriteria(sectionId, question.id, segmentId, val)
                                }}
                                onBlur={(currentValue) => {
                                    if (!segmentId) return
                                    updateSegment(question.id, segmentId, {
                                        rubric: {
                                            criteria: currentValue,
                                            levels: currentRubric.levels ?? [],
                                            examples: currentRubric.examples ?? [],
                                        },
                                    })
                                }}
                                placeholder={noticePlaceholder}
                                disabled={isLocked}
                                className="mt-1"
                                minRows={1}
                                showTableButton
                                showGraphButton
                                locale={locale}
                                editorSize="sm"
                            />
                        </div>
                    )}
                </div>

                <div className="pt-3 border-t border-gray-200">
                    <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
                        onClick={() => {
                            setClassicQuestionPanelsOpen((prev) => ({
                                ...prev,
                                [question.id]: { ...prev[question.id], perfect: !perfectPanelOpen },
                            }))
                        }}
                    >
                        <label className="text-xs font-semibold uppercase text-gray-500 cursor-pointer">{dict.standalonePerfectAnswerLabel}</label>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 cursor-pointer">
                            {perfectPanelOpen ? (locale === 'fr' ? 'Masquer' : 'Hide') : (locale === 'fr' ? 'Afficher' : 'Show')}
                            <ChevronDown className={`h-3 w-3 transition-transform ${perfectPanelOpen ? 'rotate-180' : ''}`} />
                        </span>
                    </button>
                    {!perfectPanelOpen && perfectPreview && (
                        <div className="mt-1 text-[11px] text-gray-500">{perfectPreview}</div>
                    )}
                    {perfectPanelOpen && (
                        <div data-editor-key={questionEditorKey} {...getEditorHoverHandlers(questionEditorKey)}>
                            <StringMathField
                                value={perfectAnswer || ''}
                                onChange={(val) => {
                                    if (segmentId) updateLiveSegmentPerfectAnswer(sectionId, question.id, segmentId, buildExamplesPayload(val))
                                }}
                                onBlur={(currentValue) => {
                                    if (!segmentId) return
                                    updateSegment(question.id, segmentId, {
                                        rubric: {
                                            criteria: currentRubric.criteria ?? '',
                                            levels: currentRubric.levels ?? [],
                                            examples: buildExamplesPayload(currentValue),
                                        },
                                    })
                                }}
                                placeholder={perfectPlaceholder}
                                disabled={false}
                                className="mt-1"
                                minRows={1}
                                showTableButton
                                showGraphButton
                                locale={locale}
                                editorSize="sm"
                            />
                        </div>
                    )}
                </div>

                <div className={lockedBlockClass}>
                    {renderActionButtons({ sectionId, questionId: question.id, isStandalone, isLastInSection })}
                </div>
            </div>
        )
    }

    const isFocusMode = viewMode === 'focus'
    const selectedNode = selectedNodeId ? outlineData.nodeMap.get(selectedNodeId) : null
    const selectedSectionId = selectedNode?.sectionId ?? null
    const selectedQuestionId = selectedNode?.questionId ?? null
    const isPartSelected = selectedNode?.kind === 'part'

    const detailContent = visibleSections.length === 0 ? (
        <div className="py-8">
            <p className="text-gray-500 text-center italic">
                {locale === 'fr' ? 'Cet examen est vide pour le moment.' : 'This exam is empty for now.'}
            </p>
        </div>
    ) : (
        visibleSections.map((section, sectionIndex) => {
            if (isFocusMode && selectedSectionId && section.id !== selectedSectionId) {
                return null
            }
            const sectionQuestions = getSortedQuestions(section)
            const isDefaultWithoutLabel = section.isDefault && !section.customLabel && !section.title
            const currentLabel = section.customLabel || ''
            const currentTitle = section.title || ''
            const sectionEditorKey = `section:${section.id}`
            const hideEmptySectionMenu = hoveredEditorKey === sectionEditorKey
            const showSectionHeader =
                !section.isDefault && !(isFocusMode && selectedSectionId === section.id && selectedNode && !isPartSelected)
            const shouldRenderQuestions = !isFocusMode || !isPartSelected
            const baseInputClass =
                'rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-900 focus:ring-brand-900 exam-placeholder placeholder:opacity-100'
            // Keep widths stable while typing to avoid jitter; still responsive via flex.
            const labelInputClass = `${baseInputClass} flex-1 min-w-[7rem] max-w-[10rem]`
            const titleInputClass = `${baseInputClass} flex-1 min-w-[10rem] max-w-[22rem]`
            const canMoveSectionUp = sectionIndex > 0
            const canMoveSectionDown = sectionIndex < visibleSections.length - 1
            const sectionIntroContent = Array.isArray(section.introContent)
                ? section.introContent
                : parseContent(section.introContent || '')

            return (
                <div key={section.id} className="border border-gray-200 rounded-lg overflow-hidden group/section">
                    {showSectionHeader && (
                        <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-start gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <input
                                    type="text"
                                    defaultValue={currentLabel}
                                    placeholder={locale === 'fr' ? 'ex. Partie I' : 'e.g. Section I'}
                                    className={`${labelInputClass} placeholder:opacity-100`}
                                    disabled={isLocked}
                                    onChange={(e) => updateLiveSectionLabel(section.id, e.target.value || null)}
                                    onBlur={(e) => updateSection(section.id, { customLabel: e.target.value.trim() || null })}
                                />
                                <input
                                    type="text"
                                    defaultValue={currentTitle}
                                    placeholder={locale === 'fr' ? 'Titre de la partie' : 'Section title'}
                                    className={`${titleInputClass} placeholder:opacity-100`}
                                    disabled={isLocked}
                                    onChange={(e) => updateLiveSectionTitle(section.id, e.target.value)}
                                    onBlur={(e) => updateSection(section.id, { title: e.target.value })}
                                />
                            </div>
                            <div
                                className={
                                    sectionPendingDelete === section.id && sectionDeleteSource === 'card'
                                        ? 'flex items-center justify-end flex-shrink-0 relative gap-2'
                                        : 'flex items-center justify-end flex-shrink-0 relative gap-2 opacity-0 pointer-events-none transition-opacity group-hover/section:opacity-100 group-hover/section:pointer-events-auto group-focus-within/section:opacity-100 group-focus-within/section:pointer-events-auto'
                                }
                            >
                                {!section.isDefault && !isFocusMode && (
                                    <div className="flex items-center gap-1">
                                        {canMoveSectionUp && (
                                            <button
                                                type="button"
                                                onClick={() => moveSection(sectionIndex, 'up')}
                                                className="rounded border border-gray-200 bg-white p-1 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                                disabled={loading || isLocked}
                                                title={locale === 'fr' ? 'Monter la partie' : 'Move section up'}
                                            >
                                                <ArrowUp className="h-3 w-3" />
                                            </button>
                                        )}
                                        {canMoveSectionDown && (
                                            <button
                                                type="button"
                                                onClick={() => moveSection(sectionIndex, 'down')}
                                                className="rounded border border-gray-200 bg-white p-1 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                                disabled={loading || isLocked}
                                                title={locale === 'fr' ? 'Descendre la partie' : 'Move section down'}
                                            >
                                                <ArrowDown className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleDeleteSectionClick(section.id, 'card')}
                                    title={deleteSectionLabel}
                                    aria-label={deleteSectionLabel}
                                    className={`inline-flex items-center justify-center rounded-md border border-transparent p-2 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-50 ${sectionPendingDelete === section.id ? 'invisible' : ''}`}
                                    disabled={isLocked}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    {showDeleteSectionLabel && <span className="sr-only">{deleteSectionLabel}</span>}
                                </button>
                                {sectionPendingDelete === section.id && sectionDeleteSource === 'card' && (
                                    <div
                                        ref={sectionDeleteConfirmRef}
                                        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 inline-flex items-center gap-2 border border-red-200 rounded-md px-3 bg-red-50 whitespace-nowrap h-9 shadow-lg"
                                    >
                                        <span className="text-sm text-red-700 font-medium">
                                            {confirmDeleteSectionLabel}
                                        </span>
                                        <button
                                            onClick={() => handleConfirmDeleteSection(section.id)}
                                            disabled={isDeletingSection}
                                            className="text-sm font-semibold text-red-700 disabled:opacity-50"
                                        >
                                            {isDeletingSection ? (locale === 'fr' ? 'Suppression...' : 'Deleting...') : confirmDeleteSectionAction}
                                        </button>
                                        <button
                                            onClick={handleCancelDeleteSection}
                                            disabled={isDeletingSection}
                                            className="text-sm text-gray-500 disabled:opacity-50"
                                        >
                                            {confirmDeleteSectionCancel}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="divide-y divide-gray-200">
                        {showSectionHeader && (
                            <div className="p-4 bg-white group/empty-section">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-semibold uppercase text-gray-500">{sectionIntroLabel}</label>
                                </div>
                                <div data-editor-key={sectionEditorKey} {...getEditorHoverHandlers(sectionEditorKey)}>
                                    <SegmentedMathField
                                        value={sectionIntroContent}
                                        onChange={(segments) => updateLiveSectionIntro(section.id, segments)}
                                        placeholder={sectionIntroPlaceholder}
                                        className="mt-1"
                                        disabled={isLocked}
                                        onBlur={() => {
                                            const currentSection = liveExam.sections.find((s) => s.id === section.id)
                                            if (currentSection) {
                                                updateSection(section.id, { introContent: currentSection.introContent })
                                            }
                                        }}
                                        minRows={1}
                                        locale={locale}
                                        editorSize="sm"
                                    />
                                </div>
                            </div>
                        )}
                        {shouldRenderQuestions &&
                            (sectionQuestions.length === 0 ? (
                                <div className="p-4 group/empty-section">
                                    <p className="text-gray-500 italic text-sm">
                                        {locale === 'fr' ? 'Aucune question dans cette partie.' : 'No questions in this section.'}
                                    </p>
                                    <div className="mt-3 flex justify-end">
                                        <div className={hideEmptySectionMenu ? 'opacity-0 pointer-events-none' : ''}>
                                            <AddInsertMenu
                                                label={locale === 'fr' ? 'Insérer ici' : 'Insert here'}
                                                groups={[
                                                    {
                                                        label: locale === 'fr' ? 'Dans cette partie' : 'In this section',
                                                        items: [
                                                            {
                                                                label: locale === 'fr' ? 'Question' : 'Question',
                                                                onSelect: () => handleEmptySectionAdd(section.id, 'in', 'TEXT'),
                                                            },
                                                            {
                                                                label: locale === 'fr' ? 'QCM' : 'MCQ',
                                                                onSelect: () => handleEmptySectionAdd(section.id, 'in', 'MCQ'),
                                                            },
                                                        ],
                                                    },
                                                    {
                                                        label: locale === 'fr' ? 'Hors partie' : 'Outside section',
                                                        items: [
                                                            {
                                                                label: locale === 'fr' ? 'Question' : 'Question',
                                                                onSelect: () => handleEmptySectionAdd(section.id, 'out', 'TEXT'),
                                                            },
                                                            {
                                                                label: locale === 'fr' ? 'QCM' : 'MCQ',
                                                                onSelect: () => handleEmptySectionAdd(section.id, 'out', 'MCQ'),
                                                            },
                                                        ],
                                                    },
                                                    {
                                                        items: [
                                                            {
                                                                label: locale === 'fr' ? 'Partie' : 'Section',
                                                                onSelect: () => handleAddSection(false, undefined, section.id),
                                                            },
                                                        ],
                                                    },
                                                ]}
                                                disabled={loading || isLocked}
                                                align="right"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                sectionQuestions.map((question, qIndex) => {
                                    if (isFocusMode && selectedQuestionId && question.id !== selectedQuestionId && !isPartSelected) {
                                        return null
                                    }
                                    return renderQuestionCard(
                                        section,
                                        question,
                                        qIndex,
                                        qIndex === sectionQuestions.length - 1,
                                        isDefaultWithoutLabel,
                                        sectionIndex
                                    )
                                })
                            ))}
                    </div>
                </div>
            )
        })
    )

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {locale === 'fr' ? "Contenu de l'examen" : 'Exam content'}
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onViewModeChange(viewMode === 'focus' ? 'default' : 'focus')}
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                viewMode === 'focus'
                                    ? 'border-brand-200 bg-brand-50 text-brand-900'
                                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                            aria-pressed={viewMode === 'focus'}
                        >
                            Focus
                        </button>
                        {isFocusMode && (
                            <PreviewToggle
                                label={locale === 'fr' ? 'Prévisualisation' : 'Preview'}
                                checked={previewEnabled}
                                onChange={onPreviewToggle}
                            />
                        )}
                        {!previewEnabled && !isFocusMode && (
                            <PreviewToggle
                                label={locale === 'fr' ? 'Prévisualisation' : 'Preview'}
                                checked={previewEnabled}
                                onChange={onPreviewToggle}
                            />
                        )}
                    </div>
                </div>
            {!isFocusMode && (
                <AddInsertMenu
                    label={locale === 'fr' ? 'Ajouter au contenu' : 'Add to content'}
                    subtitle={locale === 'fr' ? 'Ajout au contenu de l\'examen.' : 'Adds to the exam content.'}
                    groups={[
                        {
                            items: [
                                {
                                    label: locale === 'fr' ? 'Partie' : 'Section',
                                    onSelect: () => handleAddSection(true),
                                },
                                {
                                    label: locale === 'fr' ? 'Question' : 'Question',
                                    onSelect: () => handleAddQuestion(undefined, 'TEXT', true),
                                },
                                {
                                    label: locale === 'fr' ? 'QCM' : 'MCQ',
                                    onSelect: () => handleAddQuestion(undefined, 'MCQ', true),
                                },
                            ],
                        },
                    ]}
                    disabled={loading || isLocked}
                    align="right"
                />
            )}
            </div>

            {isFocusMode ? (
                <div className="grid items-start gap-4 lg:grid-cols-[clamp(150px,12vw,190px)_minmax(0,1fr)] -mt-4">
                    <div className="rounded-lg border border-gray-200 bg-white p-3 max-h-[calc(100vh-14rem)] overflow-y-auto self-start">
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase text-gray-500 group/outline-header">
                            <span>{locale === 'fr' ? 'Plan' : 'Outline'}</span>
                            <AddInsertMenu
                                label={locale === 'fr' ? 'Ajouter' : 'Add'}
                                groups={[
                                    {
                                        items: [
                                            {
                                                label: locale === 'fr' ? 'Partie' : 'Section',
                                                onSelect: () => handleAddSection(true),
                                            },
                                            {
                                                label: locale === 'fr' ? 'Question' : 'Question',
                                                onSelect: () => handleAddQuestion(undefined, 'TEXT', true),
                                            },
                                            {
                                                label: locale === 'fr' ? 'QCM' : 'MCQ',
                                                onSelect: () => handleAddQuestion(undefined, 'MCQ', true),
                                            },
                                        ],
                                    },
                                ]}
                                disabled={loading || isLocked}
                                align="right"
                                iconOnly
                                className={
                                    outlineData.items.length === 0
                                        ? 'opacity-100 pointer-events-auto'
                                        : 'opacity-0 pointer-events-none transition-opacity group-hover/outline-header:opacity-100 group-hover/outline-header:pointer-events-auto group-focus-within/outline-header:opacity-100 group-focus-within/outline-header:pointer-events-auto'
                                }
                            />
                        </div>
                        <div className="mt-2 space-y-1" role="listbox" tabIndex={0} onKeyDownCapture={handleOutlineKeyDown}>
                            {outlineData.items.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-4 text-center">
                                    <p className="text-sm text-gray-500 italic">
                                        {locale === 'fr' ? 'Aucun élément pour le moment.' : 'No content yet.'}
                                    </p>
                                </div>
                            ) : (
                                outlineData.items.map(({ node, depth, collapsed, hasChildren }) => {
                                    const isSelected = selectedNodeId === node.id
                                    const outlineGroups = getOutlineInsertGroups(node)
                                    const section = node.sectionId ? outlineSectionMap.get(node.sectionId) : undefined
                                    const sectionIndex =
                                        section && outlineSectionIndexMap.has(section.id)
                                            ? outlineSectionIndexMap.get(section.id)
                                            : null
                                    const prevSection =
                                        sectionIndex !== null ? visibleSections[sectionIndex - 1] : null
                                    const nextSection =
                                        sectionIndex !== null ? visibleSections[sectionIndex + 1] : null
                                    const canMoveSectionUp =
                                        sectionIndex !== null && sectionIndex > 0 && prevSection && !prevSection.isDefault
                                    const canMoveSectionDown =
                                        sectionIndex !== null &&
                                        sectionIndex < visibleSections.length - 1 &&
                                        nextSection &&
                                        !nextSection.isDefault
                                    const questionIndex =
                                        node.questionId && section
                                            ? outlineQuestionIndexMap.get(section.id)?.get(node.questionId) ?? null
                                            : null
                                    const isDeletePending =
                                        (node.kind === 'part' && section && sectionPendingDelete === section.id) ||
                                        (node.kind !== 'part' && node.questionId && questionPendingDelete === node.questionId)
                                    const isOutlineActive =
                                        hoveredOutlineNodeId === node.id || activeOutlineMenuNodeId === node.id
                                    const isCardDeleteActive =
                                        (sectionPendingDelete && sectionDeleteSource === 'card') ||
                                        (questionPendingDelete && questionDeleteSource === 'card')
                                    const controlClass = `ml-auto flex items-center gap-1 transition ${
                                        (isDeletePending && !isCardDeleteActive) || isOutlineActive
                                            ? 'opacity-100 pointer-events-auto'
                                            : 'opacity-0 pointer-events-none'
                                    }`
                                    const shouldShowOutlineControls =
                                        !isDeletePending && !isCardDeleteActive
                                    return (
                                        <div
                                            key={node.id}
                                            role="option"
                                            aria-selected={isSelected}
                                            tabIndex={0}
                                            onClick={() => setSelectedNodeId(node.id)}
                                            onMouseEnter={() => {
                                                setHoveredOutlineNodeId(node.id)
                                            }}
                                            onMouseLeave={(event) => {
                                                const currentTarget = event.currentTarget as HTMLElement | null
                                                const nextTarget = event.relatedTarget
                                                if (currentTarget && nextTarget instanceof Node && currentTarget.contains(nextTarget)) return
                                                if (activeOutlineMenuNodeId === node.id) return
                                                setHoveredOutlineNodeId((prev) => (prev === node.id ? null : prev))
                                            }}
                                            onFocusCapture={(event) => {
                                                const currentTarget = event.currentTarget as HTMLElement | null
                                                if (!currentTarget) return
                                                if (!currentTarget.matches(':focus-visible')) return
                                                currentTarget.dataset.focusVisible = 'true'
                                                setHoveredOutlineNodeId(node.id)
                                            }}
                                            onBlurCapture={(event) => {
                                                const currentTarget = event.currentTarget as HTMLElement | null
                                                if (!currentTarget) return
                                                if (currentTarget.dataset.focusVisible !== 'true') return
                                                const nextTarget = event.relatedTarget
                                                if (nextTarget instanceof Node && currentTarget.contains(nextTarget)) return
                                                if (activeOutlineMenuNodeId === node.id) return
                                                delete currentTarget.dataset.focusVisible
                                                setHoveredOutlineNodeId((prev) => (prev === node.id ? null : prev))
                                            }}
                                            className={`group relative flex w-full items-center gap-2 rounded-md px-2 py-1 min-h-[32px] text-left text-sm transition ${
                                                isSelected
                                                    ? 'bg-brand-50 text-brand-900'
                                                    : 'text-gray-700 hover:bg-gray-50'
                                            } ${depth === 1 ? 'pl-6' : ''}`}
                                        >
                                            {node.kind === 'part' && hasChildren && (
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        setCollapsedParts((prev) => ({
                                                            ...prev,
                                                            [node.sectionId ?? '']: !(prev[node.sectionId ?? ''] ?? false),
                                                        }))
                                                    }}
                                                    className="rounded border border-gray-200 bg-white p-0.5 text-gray-500 hover:bg-gray-50"
                                                    aria-label={
                                                        collapsed
                                                            ? locale === 'fr'
                                                                ? 'Déplier la partie'
                                                                : 'Expand section'
                                                            : locale === 'fr'
                                                                ? 'Replier la partie'
                                                                : 'Collapse section'
                                                    }
                                                >
                                                    <ChevronDown
                                                        className={`h-3 w-3 transition-transform ${collapsed ? '-rotate-90' : ''}`}
                                                    />
                                                </button>
                                            )}
                                            <span className="text-xs font-semibold text-gray-500">{node.ref}</span>
                                            <div className={controlClass}>
                                                {shouldShowOutlineControls && outlineGroups.length > 0 && (
                                                    <AddInsertMenu
                                                        label={locale === 'fr' ? 'Ajouter' : 'Add'}
                                                        groups={outlineGroups}
                                                        disabled={loading || isLocked}
                                                        align="left"
                                                        iconOnly
                                                        onOpenChange={(open) => {
                                                            setActiveOutlineMenuNodeId((prev) =>
                                                                open ? node.id : prev === node.id ? null : prev
                                                            )
                                                        }}
                                                    />
                                                )}
                                                {shouldShowOutlineControls && (
                                                    <>
                        {node.kind === 'part' && section && !section.isDefault && (
                                                            <>
                                                                {canMoveSectionUp && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => moveSection(sectionIndex ?? 0, 'up')}
                                                                        className="rounded border border-gray-200 bg-white p-1 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                                                        disabled={loading || isLocked}
                                                                        title={locale === 'fr' ? 'Monter la partie' : 'Move section up'}
                                                                    >
                                                                        <ArrowUp className="h-3 w-3" />
                                                                    </button>
                                                                )}
                                                                {canMoveSectionDown && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => moveSection(sectionIndex ?? 0, 'down')}
                                                                        className="rounded border border-gray-200 bg-white p-1 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                                                        disabled={loading || isLocked}
                                                                        title={locale === 'fr' ? 'Descendre la partie' : 'Move section down'}
                                                                    >
                                                                        <ArrowDown className="h-3 w-3" />
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                        {node.kind !== 'part' &&
                                                            section &&
                                                            sectionIndex !== null &&
                                                            questionIndex !== null &&
                                                            renderQuestionMoveButtons({
                                                                section,
                                                                questionIndex,
                                                                sectionIndex,
                                                            })}
                                                    </>
                                                )}
                                                {!isCardDeleteActive && node.kind === 'part' && section && !section.isDefault && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteSectionClick(section.id, 'outline')}
                                                            title={deleteSectionLabel}
                                                            aria-label={deleteSectionLabel}
                                                            className={`inline-flex items-center justify-center rounded-md border border-transparent p-1 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-50 ${
                                                                sectionPendingDelete === section.id ? 'invisible' : ''
                                                            }`}
                                                            disabled={isLocked}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                        {sectionPendingDelete === section.id && sectionDeleteSource === 'outline' && (
                                                            <div
                                                                ref={sectionDeleteConfirmRef}
                                                                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 inline-flex items-center gap-2 border border-red-200 rounded-md px-3 py-2 bg-red-50 shadow-lg max-w-[240px] whitespace-normal"
                                                                data-delete-confirm="true"
                                                            >
                                                                <span className="sr-only">
                                                                    {locale === 'fr' ? 'Confirmation de suppression' : 'Delete confirmation'}
                                                                </span>
                                                                <button
                                                                    onClick={(event) => {
                                                                        event.stopPropagation()
                                                                        handleConfirmDeleteSection(section.id)
                                                                    }}
                                                                    disabled={isDeletingSection}
                                                                    className="text-xs font-semibold text-red-700 disabled:opacity-50"
                                                                >
                                                                    {isDeletingSection
                                                                        ? locale === 'fr'
                                                                            ? 'Suppression...'
                                                                            : 'Deleting...'
                                                                        : confirmDeleteSectionAction}
                                                                </button>
                                                                <button
                                                                    onClick={(event) => {
                                                                        event.stopPropagation()
                                                                        handleCancelDeleteSection()
                                                                    }}
                                                                    disabled={isDeletingSection}
                                                                    className="text-xs text-gray-500 disabled:opacity-50"
                                                                >
                                                                    {confirmDeleteSectionCancel}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                                {!isCardDeleteActive && node.kind !== 'part' && node.questionId && section && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteQuestionClick(node.questionId, 'outline')}
                                                            title={deleteQuestionLabel}
                                                            aria-label={deleteQuestionLabel}
                                                            className={`inline-flex items-center justify-center rounded-md border border-transparent p-1 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-50 ${
                                                                questionPendingDelete === node.questionId ? 'invisible' : ''
                                                            }`}
                                                            disabled={isLocked}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                        {questionPendingDelete === node.questionId && questionDeleteSource === 'outline' && (
                                                            <div
                                                                ref={questionDeleteConfirmRef}
                                                                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 inline-flex items-center gap-2 border border-red-200 rounded-md px-3 py-2 bg-red-50 shadow-lg max-w-[240px] whitespace-normal"
                                                                data-delete-confirm="true"
                                                            >
                                                                <span className="sr-only">
                                                                    {locale === 'fr' ? 'Confirmation de suppression' : 'Delete confirmation'}
                                                                </span>
                                                                <button
                                                                    onClick={(event) => {
                                                                        event.stopPropagation()
                                                                        handleConfirmDeleteQuestion(section.id, node.questionId)
                                                                    }}
                                                                    disabled={isDeletingQuestion}
                                                                    className="text-xs font-semibold text-red-700 disabled:opacity-50"
                                                                >
                                                                    {isDeletingQuestion
                                                                        ? locale === 'fr'
                                                                            ? 'Suppression...'
                                                                            : 'Deleting...'
                                                                        : confirmDeleteQuestionAction}
                                                                </button>
                                                                <button
                                                                    onClick={(event) => {
                                                                        event.stopPropagation()
                                                                        handleCancelDeleteQuestion()
                                                                    }}
                                                                    disabled={isDeletingQuestion}
                                                                    className="text-xs text-gray-500 disabled:opacity-50"
                                                                >
                                                                    {confirmDeleteQuestionCancel}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                    <div className="min-w-0 max-h-[calc(100vh-14rem)] overflow-y-auto space-y-6">
                        {detailContent}
                        {focusPreview && (
                            <div className="border-t border-gray-200 pt-6">
                                {focusPreview}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                detailContent
            )}
        </div>
    )
}
