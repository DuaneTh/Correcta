'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Form'
import { Text } from '@/components/ui/Text'
import { Stack, Inline } from '@/components/ui/Layout'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

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
        <Stack gap="md" className="bg-gray-50 p-4 rounded-lg">
            {/* Header with actions */}
            <Inline align="between">
                <Text variant="sectionTitle">Criteres de notation</Text>
                <Button
                    type="button"
                    onClick={distributePointsEvenly}
                    variant="primary"
                    size="xs"
                    className="rounded-full"
                >
                    Repartir {maxPoints} pts equitablement
                </Button>
            </Inline>

            {/* Criteria list */}
            <Stack gap="sm">
                {criteria.map((criterion, index) => (
                    <Card key={index} className="border-2 border-indigo-100">
                        <CardBody padding="md">
                            <div className="flex items-start gap-3">
                                {/* Drag handle (visual only for now) */}
                                <div className="pt-2 text-indigo-300">
                                    <GripVertical className="w-4 h-4" />
                                </div>

                                {/* Criterion content */}
                                <Stack gap="sm" className="flex-1">
                                    {/* Criterion number badge */}
                                    <Badge variant="info" className="w-fit">
                                        Critere {index + 1}
                                    </Badge>

                                    {/* Name and points row */}
                                    <Inline gap="sm" align="start" wrap="nowrap">
                                        <div className="flex-1">
                                            <Text as="label" variant="label" className="mb-1">
                                                Nom du critere
                                            </Text>
                                            <Input
                                                type="text"
                                                value={criterion.name}
                                                onChange={(e) => updateCriterion(index, 'name', e.target.value)}
                                                placeholder="Ex: Methode correcte"
                                            />
                                        </div>
                                        <div>
                                            <Text as="label" variant="label" className="mb-1 text-indigo-700">
                                                Points
                                            </Text>
                                            <Inline gap="xs" align="center" wrap="nowrap">
                                                <Input
                                                    type="number"
                                                    value={criterion.points}
                                                    onChange={(e) => updateCriterion(index, 'points', parseFloat(e.target.value) || 0)}
                                                    min="0"
                                                    max={maxPoints}
                                                    step="0.5"
                                                    className="w-20 text-center font-bold text-indigo-700 bg-indigo-50 border-2 border-indigo-200"
                                                />
                                                <Text variant="caption" className="font-semibold text-indigo-600">pts</Text>
                                            </Inline>
                                        </div>
                                    </Inline>

                                    {/* Description */}
                                    <div>
                                        <Text as="label" variant="label" className="mb-1">
                                            Description (ce qui est attendu)
                                        </Text>
                                        <Textarea
                                            value={criterion.description}
                                            onChange={(e) => updateCriterion(index, 'description', e.target.value)}
                                            placeholder="Ex: L'etudiant applique correctement la formule et montre les etapes de calcul"
                                            rows={2}
                                        />
                                    </div>
                                </Stack>

                                {/* Delete button */}
                                <Button
                                    type="button"
                                    onClick={() => removeCriterion(index)}
                                    disabled={criteria.length <= 1}
                                    variant="ghost"
                                    className="pt-2 text-red-400 hover:text-red-600 disabled:opacity-30"
                                    title="Supprimer ce critere"
                                    size="xs"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                ))}
            </Stack>

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
                <Text variant="caption" className={`font-semibold ${
                    totalPoints === maxPoints
                        ? 'text-green-800'
                        : totalPoints > maxPoints
                            ? 'text-red-800'
                            : 'text-amber-800'
                }`}>
                    Total des points attribues
                </Text>
                <Text className={`text-xl font-bold ${
                    totalPoints === maxPoints
                        ? 'text-green-700'
                        : totalPoints > maxPoints
                            ? 'text-red-700'
                            : 'text-amber-700'
                }`}>
                    {totalPoints} / {maxPoints} pts
                </Text>
            </div>

            {totalPoints !== maxPoints && (
                <Text variant="caption" className={`font-medium ${totalPoints > maxPoints ? 'text-red-600' : 'text-amber-600'}`}>
                    {totalPoints > maxPoints
                        ? `Attention: le total depasse le maximum de ${maxPoints} points`
                        : `Il reste ${maxPoints - totalPoints} point(s) a attribuer`
                    }
                </Text>
            )}

            {/* Action buttons */}
            <Inline align="end" gap="sm" className="pt-4 border-t border-gray-200">
                <Button
                    type="button"
                    onClick={onCancel}
                    variant="secondary"
                >
                    Annuler
                </Button>
                <Button
                    type="button"
                    onClick={onSave}
                    disabled={saving || criteria.some(c => !c.name.trim())}
                    variant="primary"
                >
                    {saving ? 'Sauvegarde...' : 'Sauvegarder le bareme'}
                </Button>
            </Inline>
        </Stack>
    )
}
