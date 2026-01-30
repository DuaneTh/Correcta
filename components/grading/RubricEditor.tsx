'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'

interface Criterion {
    name: string
    points: number
    description: string
}

interface Rubric {
    criteria: Criterion[]
    totalPoints: number
}

interface RubricEditorProps {
    rubric: Rubric | null
    maxPoints: number
    onChange: (rubric: Rubric) => void
    onCancel: () => void
    onSave: () => void
    saving?: boolean
}

export function RubricEditor({
    rubric,
    maxPoints,
    onChange,
    onCancel,
    onSave,
    saving = false
}: RubricEditorProps) {
    const [criteria, setCriteria] = useState<Criterion[]>(
        rubric?.criteria || [
            { name: 'Reponse correcte', points: maxPoints, description: 'La reponse est complete et exacte' }
        ]
    )

    // Calculate total points
    const totalPoints = criteria.reduce((sum, c) => sum + c.points, 0)

    // Update parent when criteria change
    useEffect(() => {
        onChange({
            criteria,
            totalPoints
        })
    }, [criteria, totalPoints, onChange])

    const addCriterion = () => {
        setCriteria([
            ...criteria,
            { name: '', points: 0, description: '' }
        ])
    }

    const removeCriterion = (index: number) => {
        if (criteria.length <= 1) return // Keep at least one criterion
        setCriteria(criteria.filter((_, i) => i !== index))
    }

    const updateCriterion = (index: number, field: keyof Criterion, value: string | number) => {
        setCriteria(criteria.map((c, i) => {
            if (i !== index) return c
            return { ...c, [field]: value }
        }))
    }

    const distributePointsEvenly = () => {
        const pointsPerCriterion = Math.floor(maxPoints / criteria.length)
        const remainder = maxPoints % criteria.length

        setCriteria(criteria.map((c, i) => ({
            ...c,
            points: pointsPerCriterion + (i < remainder ? 1 : 0)
        })))
    }

    return (
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
            {/* Header with actions */}
            <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900">Criteres de notation</h4>
                <button
                    type="button"
                    onClick={distributePointsEvenly}
                    className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded-full hover:bg-indigo-700"
                >
                    Repartir {maxPoints} pts equitablement
                </button>
            </div>

            {/* Criteria list */}
            <div className="space-y-3">
                {criteria.map((criterion, index) => (
                    <div
                        key={index}
                        className="bg-white rounded-lg p-4 border-2 border-indigo-100 shadow-sm"
                    >
                        <div className="flex items-start gap-3">
                            {/* Drag handle (visual only for now) */}
                            <div className="pt-2 text-indigo-300">
                                <GripVertical className="w-4 h-4" />
                            </div>

                            {/* Criterion content */}
                            <div className="flex-1 space-y-3">
                                {/* Criterion number badge */}
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2 py-0.5 text-xs font-bold text-indigo-700 bg-indigo-100 rounded">
                                        Critere {index + 1}
                                    </span>
                                </div>

                                {/* Name and points row */}
                                <div className="flex items-start gap-3">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            Nom du critere
                                        </label>
                                        <input
                                            type="text"
                                            value={criterion.name}
                                            onChange={(e) => updateCriterion(index, 'name', e.target.value)}
                                            placeholder="Ex: Methode correcte"
                                            className="w-full px-3 py-2 text-sm text-gray-900 bg-white border-2 border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-indigo-700 mb-1">
                                            Points
                                        </label>
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                value={criterion.points}
                                                onChange={(e) => updateCriterion(index, 'points', parseFloat(e.target.value) || 0)}
                                                min="0"
                                                max={maxPoints}
                                                step="0.5"
                                                className="w-20 px-3 py-2 text-sm text-center font-bold text-indigo-700 bg-indigo-50 border-2 border-indigo-200 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            />
                                            <span className="text-sm font-semibold text-indigo-600">pts</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Description (ce qui est attendu)
                                    </label>
                                    <textarea
                                        value={criterion.description}
                                        onChange={(e) => updateCriterion(index, 'description', e.target.value)}
                                        placeholder="Ex: L'etudiant applique correctement la formule et montre les etapes de calcul"
                                        rows={2}
                                        className="w-full px-3 py-2 text-sm text-gray-800 bg-white border-2 border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400"
                                    />
                                </div>
                            </div>

                            {/* Delete button */}
                            <button
                                type="button"
                                onClick={() => removeCriterion(index)}
                                disabled={criteria.length <= 1}
                                className="pt-2 text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Supprimer ce critere"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add criterion button */}
            <button
                type="button"
                onClick={addCriterion}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-indigo-700 bg-indigo-50 border-2 border-dashed border-indigo-300 rounded-lg hover:bg-indigo-100 hover:border-indigo-400 transition-colors"
            >
                <Plus className="w-5 h-5" />
                Ajouter un critere
            </button>

            {/* Points summary */}
            <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                totalPoints === maxPoints
                    ? 'bg-green-100 border-green-300'
                    : totalPoints > maxPoints
                        ? 'bg-red-100 border-red-300'
                        : 'bg-amber-100 border-amber-300'
            }`}>
                <span className={`text-sm font-semibold ${
                    totalPoints === maxPoints
                        ? 'text-green-800'
                        : totalPoints > maxPoints
                            ? 'text-red-800'
                            : 'text-amber-800'
                }`}>
                    Total des points attribues
                </span>
                <span className={`text-xl font-bold ${
                    totalPoints === maxPoints
                        ? 'text-green-700'
                        : totalPoints > maxPoints
                            ? 'text-red-700'
                            : 'text-amber-700'
                }`}>
                    {totalPoints} / {maxPoints} pts
                </span>
            </div>

            {totalPoints !== maxPoints && (
                <p className={`text-sm font-medium ${totalPoints > maxPoints ? 'text-red-600' : 'text-amber-600'}`}>
                    {totalPoints > maxPoints
                        ? `Attention: le total depasse le maximum de ${maxPoints} points`
                        : `Il reste ${maxPoints - totalPoints} point(s) a attribuer`
                    }
                </p>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50"
                >
                    Annuler
                </button>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={saving || criteria.some(c => !c.name.trim())}
                    className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                    {saving ? 'Sauvegarde...' : 'Sauvegarder le bareme'}
                </button>
            </div>
        </div>
    )
}
