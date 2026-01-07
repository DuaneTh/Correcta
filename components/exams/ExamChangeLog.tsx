'use client'

import MathRenderer from '@/components/exams/MathRenderer'
import type { ContentSegment, ExamChange, StudentToolsConfig } from '@/types/exams'

type ExamChangeLogProps = {
    changes?: ExamChange[]
    locale?: string
    className?: string
}

const isContentSegments = (value: unknown): value is ContentSegment[] =>
    Array.isArray(value) && value.every((segment) => typeof segment === 'object' && segment !== null && 'type' in segment)

const describeTools = (tools: StudentToolsConfig | null | undefined, locale: string) => {
    if (!tools) {
        return [locale === 'fr' ? 'Formules : Oui (complets)' : 'Math: Yes (full)']
    }
    const lines: string[] = []
    const mathEnabled = tools.math?.enabled !== false
    const symbolSet = tools.math?.symbolSet === 'basic'
        ? (locale === 'fr' ? 'essentiels' : 'essential')
        : (locale === 'fr' ? 'complets' : 'full')
    lines.push(
        locale === 'fr'
            ? `Formules : ${mathEnabled ? `Oui (${symbolSet})` : 'Non'}`
            : `Math: ${mathEnabled ? `Yes (${symbolSet})` : 'No'}`
    )

    const tableEnabled = tools.table?.enabled !== false
    if (tableEnabled) {
        const rows = tools.table?.maxRows ?? null
        const cols = tools.table?.maxCols ?? null
        const limit = rows || cols
            ? `${rows ?? '∞'}×${cols ?? '∞'}`
            : (locale === 'fr' ? 'sans limite' : 'unlimited')
        const allowMath = tools.table?.allowMath !== false && mathEnabled
        lines.push(
            locale === 'fr'
                ? `Tableaux : Oui (${limit}, formules ${allowMath ? 'oui' : 'non'})`
                : `Tables: Yes (${limit}, math ${allowMath ? 'yes' : 'no'})`
        )
    } else {
        lines.push(locale === 'fr' ? 'Tableaux : Non' : 'Tables: No')
    }

    const graphEnabled = tools.graph?.enabled !== false
    if (graphEnabled) {
        const parts: string[] = []
        if (tools.graph?.allowPoints !== false) parts.push(locale === 'fr' ? 'points' : 'points')
        if (tools.graph?.allowLines !== false) parts.push(locale === 'fr' ? 'lignes' : 'lines')
        if (tools.graph?.allowCurves !== false) parts.push(locale === 'fr' ? 'courbes' : 'curves')
        if (tools.graph?.allowFunctions !== false) parts.push(locale === 'fr' ? 'fonctions' : 'functions')
        if (tools.graph?.allowAreas !== false) parts.push(locale === 'fr' ? 'surfaces' : 'areas')
        if (tools.graph?.allowText !== false) parts.push(locale === 'fr' ? 'texte' : 'text')
        lines.push(
            locale === 'fr'
                ? `Graphiques : Oui (${parts.join(', ') || 'standard'})`
                : `Graphs: Yes (${parts.join(', ') || 'standard'})`
        )
    } else {
        lines.push(locale === 'fr' ? 'Graphiques : Non' : 'Graphs: No')
    }

    return lines
}

const fieldLabel = (field: string, entityType: ExamChange['entityType'], locale: string) => {
    const labels: Record<string, { fr: string; en: string }> = {
        title: {
            fr: entityType === 'SECTION' ? 'Titre de la partie' : "Titre de l'examen",
            en: entityType === 'SECTION' ? 'Section title' : 'Exam title',
        },
        allowedMaterials: { fr: "Mentions pour l'examen", en: 'Exam notes' },
        requireHonorCommitment: { fr: "Déclaration d'honneur", en: 'Honor statement' },
        titleSection: { fr: 'Titre de partie', en: 'Section title' },
        customLabel: { fr: 'Libellé', en: 'Label' },
        introContent: { fr: 'Mention de partie', en: 'Section note' },
        content: { fr: 'Intitulé', en: 'Question statement' },
        answerTemplate: { fr: 'Template de réponse', en: 'Answer template' },
        studentTools: { fr: 'Outils disponibles', en: 'Student tools' },
        instruction: { fr: 'Instruction / option', en: 'Instruction / option' },
    }
    const entry = labels[field]
    if (entry) return locale === 'fr' ? entry.fr : entry.en
    return field
}

const renderValue = (value: unknown, locale: string) => {
    if (value === null || value === undefined || value === '') {
        return <span className="text-xs text-gray-400 italic">{locale === 'fr' ? 'Aucune' : 'None'}</span>
    }
    if (isContentSegments(value)) {
        return <MathRenderer text={value} className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed" tableScale="fit" />
    }
    if (typeof value === 'string') {
        return <MathRenderer text={value} className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed" tableScale="fit" />
    }
    if (typeof value === 'boolean') {
        return <span className="text-sm text-gray-900">{value ? (locale === 'fr' ? 'Oui' : 'Yes') : (locale === 'fr' ? 'Non' : 'No')}</span>
    }
    if (typeof value === 'object') {
        const lines = describeTools(value as StudentToolsConfig, locale)
        return (
            <ul className="text-xs text-gray-700 space-y-1">
                {lines.map((line) => (
                    <li key={line}>{line}</li>
                ))}
            </ul>
        )
    }
    return <span className="text-sm text-gray-900">{String(value)}</span>
}

export default function ExamChangeLog({ changes = [], locale = 'fr', className }: ExamChangeLogProps) {
    if (!changes.length) return null

    return (
        <div className={className}>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="text-sm font-semibold text-amber-900">
                    {locale === 'fr' ? 'Mises à jour pendant l’examen' : 'Updates during the exam'}
                </div>
                <div className="mt-3 space-y-3 max-h-72 overflow-auto pr-1">
                    {changes.map((change) => {
                        const timestamp = new Date(change.createdAt).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                        })
                        return (
                            <div key={change.id} className="rounded-md border border-amber-200 bg-white px-3 py-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-xs font-semibold text-amber-900">
                                        {change.entityLabel || (locale === 'fr' ? 'Examen' : 'Exam')} · {fieldLabel(change.field, change.entityType, locale)}
                                    </div>
                                    <div className="text-[11px] text-amber-700">{timestamp}</div>
                                </div>
                                <div className="mt-2 grid gap-3 md:grid-cols-2">
                                    <div>
                                        <div className="text-[11px] font-semibold uppercase text-gray-500 mb-1">
                                            {locale === 'fr' ? 'Avant' : 'Before'}
                                        </div>
                                        {renderValue(change.beforeValue, locale)}
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-semibold uppercase text-gray-500 mb-1">
                                            {locale === 'fr' ? 'Après' : 'After'}
                                        </div>
                                        {renderValue(change.afterValue, locale)}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
