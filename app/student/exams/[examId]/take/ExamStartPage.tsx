'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Stack } from '@/components/ui/Layout'
import { Text } from '@/components/ui/Text'

type ExamData = {
  id: string
  title: string
  description: string | null
  durationMinutes: number | null
  startAt: string | null
  endAt: string | null
  examEndAt: string | null
  requireHonorCommitment: boolean
  allowedMaterials: string | null
  course: {
    code: string
    name: string
  }
  author: {
    name: string | null
  } | null
  questionCount: number
}

interface ExamStartPageProps {
  exam: ExamData
  studentName?: string | null
  dictionary: Dictionary
  locale: string
}

/**
 * ExamStartPage - Cover page before starting an exam
 *
 * Shows exam details and a "Start Exam" button.
 * Creates an attempt and redirects to the exam room.
 */
export default function ExamStartPage({
  exam,
  studentName,
  dictionary,
  locale,
}: ExamStartPageProps) {
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formatDate = (dateString: string | null) => {
    if (!dateString) return locale === 'fr' ? 'Non defini' : 'Not defined'
    const date = new Date(dateString)
    return date.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    })
  }

  const handleStartExam = async () => {
    setIsStarting(true)
    setError(null)

    try {
      const response = await fetch('/api/attempts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ examId: exam.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start exam')
      }

      const attempt = await response.json()
      router.push(`/student/attempts/${attempt.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsStarting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Exam card */}
        <Card overflow="hidden">
          {/* Header */}
          <div className="bg-brand-900 px-6 py-8 text-center">
            <Text variant="caption" className="text-brand-100 uppercase tracking-wide mb-2">
              {exam.course.code} - {exam.course.name}
            </Text>
            <Text as="h1" variant="pageTitle" className="text-white">
              {exam.title}
            </Text>
            {exam.author?.name && (
              <Text variant="muted" className="text-brand-200 mt-2">
                {locale === 'fr' ? 'Par' : 'By'} {exam.author.name}
              </Text>
            )}
          </div>

          {/* Details */}
          <CardBody padding="lg">
            <Stack gap="sm">
              {/* Student info */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <Text variant="muted">
                  {locale === 'fr' ? 'Etudiant' : 'Student'}
                </Text>
                <Text variant="body" className="font-medium">
                  {studentName || (locale === 'fr' ? 'Non identifie' : 'Not identified')}
                </Text>
              </div>

              {/* Duration */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <Text variant="muted">
                  {locale === 'fr' ? 'Duree' : 'Duration'}
                </Text>
                <Text variant="body" className="font-medium">
                  {exam.durationMinutes} {locale === 'fr' ? 'minutes' : 'minutes'}
                </Text>
              </div>

              {/* Questions */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <Text variant="muted">
                  {locale === 'fr' ? 'Nombre de questions' : 'Number of questions'}
                </Text>
                <Text variant="body" className="font-medium">
                  {exam.questionCount}
                </Text>
              </div>

              {/* Available until */}
              {exam.examEndAt && (
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <Text variant="muted">
                    {locale === 'fr' ? 'Disponible jusqu\'au' : 'Available until'}
                  </Text>
                  <Text variant="body" className="font-medium">
                    {formatDate(exam.examEndAt)}
                  </Text>
                </div>
              )}

              {/* Allowed materials */}
              {exam.allowedMaterials && (
                <div className="py-3 border-b border-gray-100">
                  <Text variant="muted" className="mb-2">
                    {locale === 'fr' ? 'Materiel autorise' : 'Allowed materials'}
                  </Text>
                  <Text variant="body" className="whitespace-pre-wrap">
                    {exam.allowedMaterials}
                  </Text>
                </div>
              )}

              {/* Honor commitment notice */}
              {exam.requireHonorCommitment && (
                <div className="py-3 bg-amber-50 -mx-6 px-6 border-y border-amber-100">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <Stack gap="xs">
                      <Text variant="body" className="font-medium text-amber-800">
                        {locale === 'fr'
                          ? 'Declaration sur l\'honneur requise'
                          : 'Honor statement required'}
                      </Text>
                      <Text variant="muted" className="text-amber-800">
                        {locale === 'fr'
                          ? 'Vous devrez copier une declaration sur l\'honneur avant de pouvoir repondre aux questions.'
                          : 'You will need to copy an honor statement before you can answer questions.'}
                      </Text>
                    </Stack>
                  </div>
                </div>
              )}

              {/* Description */}
              {exam.description && (
                <div className="py-3">
                  <Text variant="muted" className="mb-2">
                    {locale === 'fr' ? 'Description' : 'Description'}
                  </Text>
                  <Text variant="body" className="whitespace-pre-wrap">
                    {exam.description}
                  </Text>
                </div>
              )}
            </Stack>
          </CardBody>

          {/* Important notice */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <Text variant="muted">
                {locale === 'fr'
                  ? 'Une fois l\'examen demarre, le chronometre commencera et vous ne pourrez pas mettre en pause. Vos reponses seront sauvegardees automatiquement.'
                  : 'Once the exam starts, the timer will begin and you cannot pause. Your answers will be saved automatically.'}
              </Text>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-6 bg-white border-t border-gray-200">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <Text variant="muted" className="text-red-700">{error}</Text>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => router.push('/student/exams')}
                variant="secondary"
                className="flex-1 py-3"
              >
                {locale === 'fr' ? 'Retour' : 'Back'}
              </Button>
              <Button
                onClick={handleStartExam}
                disabled={isStarting}
                variant="primary"
                className="flex-1 py-3 font-semibold"
              >
                {isStarting
                  ? (locale === 'fr' ? 'Demarrage...' : 'Starting...')
                  : (locale === 'fr' ? 'Demarrer l\'examen' : 'Start Exam')}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
