'use client'

import { useState } from 'react'
import ExamEditor from './ExamEditor'
import PDFImportUploader from '@/components/exam-import/PDFImportUploader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { cn } from '@/components/ui/cn'

type NewExamMode = 'choose' | 'create' | 'import'

type NewExamPageClientProps = {
    courses: { id: string; code: string; name: string }[]
}

export default function NewExamPageClient({ courses }: NewExamPageClientProps) {
    const [mode, setMode] = useState<NewExamMode>('choose')
    const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '')

    if (mode === 'create') {
        return <ExamEditor courses={courses} />
    }

    if (mode === 'import') {
        return (
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <Text variant="pageTitle">Importer un examen depuis un PDF</Text>
                    <Button variant="secondary" onClick={() => setMode('choose')}>
                        Retour
                    </Button>
                </div>

                <Card>
                    <CardBody padding="lg" className="space-y-4">
                        <div>
                            <Text as="label" variant="label" htmlFor="course-select" className="block mb-2">
                                Sélectionnez le cours
                            </Text>
                            <select
                                id="course-select"
                                value={selectedCourseId}
                                onChange={(e) => setSelectedCourseId(e.target.value)}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 p-2 border"
                            >
                                {courses.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.code} - {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedCourseId && (
                            <PDFImportUploader
                                courseId={selectedCourseId}
                                onCancel={() => setMode('choose')}
                            />
                        )}
                    </CardBody>
                </Card>
            </div>
        )
    }

    // Mode: choose
    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <Text variant="pageTitle">Créer un nouvel examen</Text>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Option 1: Create from scratch */}
                <Card
                    interactive="strong"
                    onClick={() => setMode('create')}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setMode('create')
                        }
                    }}
                >
                    <CardBody padding="lg" className="space-y-4 text-center">
                        <div className="flex justify-center">
                            <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center">
                                <svg
                                    className="w-8 h-8 text-brand-700"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                </svg>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Text variant="sectionTitle">Créer de zéro</Text>
                            <Text variant="muted" className="text-center">
                                Créez un examen en définissant manuellement les questions, le barème et les
                                critères de correction
                            </Text>
                        </div>
                    </CardBody>
                </Card>

                {/* Option 2: Import from PDF */}
                <Card
                    interactive="strong"
                    onClick={() => setMode('import')}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setMode('import')
                        }
                    }}
                >
                    <CardBody padding="lg" className="space-y-4 text-center">
                        <div className="flex justify-center">
                            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                                <svg
                                    className="w-8 h-8 text-blue-700"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                    />
                                </svg>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Text variant="sectionTitle">Importer un PDF existant</Text>
                            <Text variant="muted" className="text-center">
                                L&apos;IA analyse votre PDF et extrait automatiquement les questions pour
                                créer l&apos;examen
                            </Text>
                        </div>
                    </CardBody>
                </Card>
            </div>

            <Card className="bg-blue-50 border-blue-200">
                <CardBody padding="md">
                    <Text variant="muted" className="text-blue-900 text-center">
                        Les examens importés peuvent être modifiés librement dans l&apos;éditeur après
                        l&apos;import
                    </Text>
                </CardBody>
            </Card>
        </div>
    )
}
