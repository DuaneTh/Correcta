'use client'

import { useEffect, useRef } from 'react'
import { Exam } from '@/types/exams'
import MathRenderer from '@/components/exams/MathRenderer'
import ExamChangeLog from '@/components/exams/ExamChangeLog'
import { parseContent, segmentsToPlainText } from '@/lib/content'

type MathJaxObject = {
    startup?: { ready?: boolean }
    typesetPromise?: (nodes?: Element[]) => Promise<void>
    typeset?: (nodes?: Element[]) => void
}

type MathJaxWindow = Window & { MathJax?: MathJaxObject }

type ExamPreviewDictionary = {
    teacher: {
        examBuilderPage: Record<string, string>
    }
}

interface ExamPreviewProps {
    exam: Exam
    dictionary: ExamPreviewDictionary
    locale?: string
    viewMode?: 'student' | 'correction'
    hideHeader?: boolean
    hideSectionHeader?: boolean
    hideHonorCommitment?: boolean
}

export default function ExamPreview({
    exam,
    dictionary,
    locale = 'fr',
    viewMode = 'student',
    hideHeader = false,
    hideSectionHeader = false,
    hideHonorCommitment = false,
}: ExamPreviewProps) {
    const dict = dictionary.teacher.examBuilderPage
    const previewRef = useRef<HTMLDivElement>(null)
    const mathJaxReadyRef = useRef(false)
    const isTypesettingRef = useRef(false)
    const pendingTypesetRef = useRef(false)
    const typesetTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    
    const typesetMath = async () => {
        if (typeof window === 'undefined') return
        const mathWindow = window as MathJaxWindow
        const target = previewRef.current
        if (!target) return
        if (isTypesettingRef.current) {
            pendingTypesetRef.current = true
            return
        }
        isTypesettingRef.current = true
        try {
            if (mathWindow.MathJax?.typesetPromise) {
                await mathWindow.MathJax.typesetPromise([target])
            } else if (mathWindow.MathJax?.typeset) {
                mathWindow.MathJax.typeset([target])
            }
        } catch (error) {
            console.error('MathJax typeset error:', error)
        } finally {
            isTypesettingRef.current = false
            if (pendingTypesetRef.current) {
                pendingTypesetRef.current = false
                void typesetMath()
            }
        }
    }

    // Load MathJax once
    useEffect(() => {
        if (typeof window === 'undefined') return
        const mathWindow = window as MathJaxWindow
        
        // Check if MathJax script is already in the document
        let mathJaxScript = document.getElementById('MathJax-script') as HTMLScriptElement
        
        if (!mathJaxScript) {
            // Configure MathJax before loading
            mathWindow.MathJax = {
                tex: {
                    inlineMath: [['$', '$']],
                    displayMath: [['$$', '$$']],
                    processEscapes: true
                },
                svg: {
                    fontCache: 'global'
                }
            }
            
            // Load MathJax from CDN
            mathJaxScript = document.createElement('script')
            mathJaxScript.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js'
            mathJaxScript.async = true
            mathJaxScript.id = 'MathJax-script'
            document.head.appendChild(mathJaxScript)
        }

        // Wait for MathJax to be ready
        const checkMathJax = setInterval(() => {
            if (mathWindow.MathJax?.startup?.ready || mathWindow.MathJax?.typesetPromise) {
                clearInterval(checkMathJax)
                mathJaxReadyRef.current = true
                typesetMath()
            }
        }, 100)

        return () => {
            clearInterval(checkMathJax)
        }
    }, [])

    // Re-typeset when exam content changes
    useEffect(() => {
        if (!mathJaxReadyRef.current) return
        if (typesetTimeoutRef.current) {
            clearTimeout(typesetTimeoutRef.current)
        }
        typesetTimeoutRef.current = setTimeout(() => {
            void typesetMath()
        }, 200)
        return () => {
            if (typesetTimeoutRef.current) {
                clearTimeout(typesetTimeoutRef.current)
            }
        }
    }, [exam])
    
    const sortedSections = [...exam.sections].sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 0
        const orderB = typeof b.order === 'number' ? b.order : 0
        return orderA - orderB
    })

    const formatDate = (dateString: string | null) => {
        if (!dateString) return dict.notScheduled
        const date = new Date(dateString)
        return date.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', {
            dateStyle: 'long',
            timeStyle: 'short'
        })
    }

    return (
        <div ref={previewRef} className="bg-white rounded-md shadow-sm border border-gray-200">
            {!hideHeader && (
                <div className="p-6 pb-4 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-4">
                        <div className="text-sm text-gray-700 flex-1">
                        <div className="font-semibold text-gray-900">{exam.course.code} • {exam.course.name}</div>
                        <div className="mt-1 text-gray-700">
                            {locale === 'fr' ? 'Professeur :' : 'Teacher:'}{' '}
                            {exam.course.teacherName || exam.author?.name || (locale === 'fr' ? 'Non renseigné' : 'Not provided')}
                        </div>
                        <div className="mt-1 text-gray-700">
                            {locale === 'fr' ? 'Étudiant :' : 'Student:'} {locale === 'fr' ? 'Nom Prénom' : 'Firstname Lastname'}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-sm text-gray-700">
                        <div className="text-right">
                            <div>{formatDate(exam.startAt)}</div>
                            <div className="mt-1">
                                {locale === 'fr' ? 'Durée :' : 'Duration:'}{' '}
                                {exam.durationMinutes ? `${exam.durationMinutes} ${dict.minutesSuffix}` : (locale === 'fr' ? 'Non défini' : 'Not defined')}
                            </div>
                            {viewMode === 'student' && (

                            <div className="mt-1 font-medium">
                                {locale === 'fr' ? 'Temps restant :' : 'Time remaining:'}{' '}
                                {exam.durationMinutes ? `${exam.durationMinutes} ${dict.minutesSuffix}` : (locale === 'fr' ? 'Non défini' : 'Not defined')}
                            </div>

                            )}
                        </div>
                        </div>
                </div>
                    <h1 className="text-3xl font-bold text-gray-900 text-center mt-6">{exam.title}</h1>
                </div>
            )}

            {exam.changes && exam.changes.length > 0 && (
                <div className="px-4 pt-4">
                    <ExamChangeLog changes={exam.changes} locale={locale} />
                </div>
            )}

            {/* Allowed Materials */}
            {exam.allowedMaterials && (
                <div className="p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed italic">
                        {exam.allowedMaterials}
                    </p>
                </div>
            )}

            {/* Honor Commitment Statement */}
            {viewMode === 'student' && exam.requireHonorCommitment !== false && !hideHonorCommitment && (
                <div className="p-4 border-t border-gray-200">
                    <div className="mb-3">
                        <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                            {locale === 'fr' 
                                ? 'Avant de commencer cet examen, vous devez vous engager à respecter le code d\'honneur en copiant la déclaration suivante :\n\n"Je m\'engage sur l\'honneur à faire cet examen seul, sans aucune aide d\'autrui, sans consulter aucun document (sauf mention contraire), et à ne pas partager mes réponses avec d\'autres étudiants."'
                                : 'Before starting this exam, you must commit to respecting the honor code by copying the following statement:\n\n"I commit on my honor to take this exam alone, without any help from others, without consulting any documents (unless otherwise stated), and not to share my answers with other students."'}
                        </p>
                    </div>
                    <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2">
                        <textarea
                            readOnly
                            placeholder={locale === 'fr' ? 'Recopiez ici la déclaration sur l\'honneur…' : 'Copy the honor statement here...'}
                            className="w-full min-h-[80px] text-sm text-gray-900 placeholder-gray-400 focus:outline-none resize-none bg-transparent"
                            style={{ cursor: 'not-allowed' }}
                        />
                    </div>

                </div>
            )}

            {/* Sections and Questions */}
            {sortedSections.length === 0 ? (
                <div className="p-6 text-center border-t border-gray-200">
                    <p className="text-gray-500 italic text-sm">
                        {locale === 'fr' ? 'Cet examen est vide pour le moment.' : 'This exam is empty for now.'}
                    </p>
                </div>
            ) : (
                <>
                    {(() => {
                        let globalQuestionIndex = 0
                        return sortedSections.map((section, sectionIndex) => {
                            const sectionQuestions = [...section.questions].sort((a, b) => {
                                const orderA = typeof a.order === 'number' ? a.order : 0
                                const orderB = typeof b.order === 'number' ? b.order : 0
                                return orderA - orderB
                            })
                            const prevSection = sectionIndex > 0 ? sortedSections[sectionIndex - 1] : null
                            const startsAfterPart = Boolean(section.isDefault && prevSection && !prevSection.isDefault)
                            const sectionIntroContent = Array.isArray(section.introContent)
                                ? section.introContent
                                : parseContent(section.introContent || '')
                            const hasSectionIntro =
                                !section.isDefault && segmentsToPlainText(sectionIntroContent).trim().length > 0

                            // Don't show section header for default section if it has no customLabel and no title
                            const isDefaultWithoutLabel = section.isDefault && !section.customLabel && !section.title

                            // Calculate total points for this section (sum of all question points)
                            const sectionTotalPoints = sectionQuestions.reduce((sectionSum, question) => {
                                let questionPoints = 0
                                if (question.type === 'MCQ') {
                                    questionPoints = typeof question.maxPoints === 'number'
                                        ? question.maxPoints
                                        : question.segments.reduce((sum, segment) => sum + (segment.maxPoints || 0), 0)
                                } else {
                                    questionPoints = question.segments.reduce((sum, segment) => sum + (segment.maxPoints || 0), 0)
                                }
                                return sectionSum + questionPoints
                            }, 0)

                            return (
                                <div key={section.id}>
                                    {/* Section Header - only show if not default section without label */}
                            {!hideSectionHeader && !isDefaultWithoutLabel && (
                                <div className="p-4 border-t border-gray-200 bg-gray-50">
                                    <div className="flex items-center gap-2 justify-between">
                                        <div className="flex items-center gap-2">
                                                    {section.customLabel && (
                                                        <span className="text-base font-semibold text-gray-900">
                                                            {section.customLabel}
                                                        </span>
                                                    )}
                                                    {section.title && (
                                                        <span className="text-base font-medium text-gray-900">
                                                            {section.title}
                                                        </span>
                                                    )}
                                                </div>
                                                {sectionTotalPoints > 0 && (
                                                    <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                                                        {sectionTotalPoints} {sectionTotalPoints === 1 ? (locale === 'fr' ? 'point' : 'point') : (locale === 'fr' ? 'points' : 'points')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                            {!hideSectionHeader && hasSectionIntro && (
                                <div className="p-4 border-t border-gray-200">
                                    <MathRenderer text={sectionIntroContent} className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed" tableScale="fit" />
                                </div>
                            )}

                                    {/* Section Questions */}
                                    {sectionQuestions.length === 0 ? (
                                        !isDefaultWithoutLabel && (
                                            <div className="p-4 border-t border-gray-200">
                                                <p className="text-gray-500 italic text-sm text-center">
                                                {locale === 'fr' ? 'Aucune question dans cette partie.' : 'No questions in this section.'}
                                            </p>
                                            </div>
                                        )
                                    ) : (
                                        sectionQuestions.map((question, questionIndex) => {
                                            globalQuestionIndex++
                                            const questionLabel = question.customLabel || `${globalQuestionIndex}.`
                                            const hasContent = segmentsToPlainText(question.content || []).trim().length > 0
                                            const questionText = hasContent
                                                ? question.content
                                                : parseContent(locale === 'fr' ? 'Question sans texte' : 'Question without text')
                                            
                                            const answerTemplate = question.answerTemplate || []
                                            const hasAnswerTemplate = segmentsToPlainText(answerTemplate).trim().length > 0
                                            const answerTemplateLocked = question.answerTemplateLocked === true
                                            // Calculate total points for this question
                                            // For MCQ with requireAllCorrect, use question.maxPoints
                                            // Otherwise, sum segment points
                                            const totalPoints = question.type === 'MCQ'
                                                ? (typeof question.maxPoints === 'number'
                                                    ? question.maxPoints
                                                    : question.segments.reduce((sum, segment) => sum + (segment.maxPoints || 0), 0))
                                                : question.segments.reduce((sum, segment) => sum + (segment.maxPoints || 0), 0)
                                            
                                            // Render MCQ questions differently
                                            const questionDividerClass =
                                                questionIndex === 0 && startsAfterPart
                                                    ? 'border-t-2 border-gray-300'
                                                    : 'border-t border-gray-200'

                                            if (question.type === 'MCQ') {
                                                const mcqOptions = question.segments || []
                                                const orderedOptions = [...mcqOptions].sort(
                                                    (a, b) => (a.order ?? 0) - (b.order ?? 0)
                                                )
                                                const displayOptions =
                                                    viewMode === 'student' && question.shuffleOptions
                                                        ? (() => {
                                                              const shuffled = [...orderedOptions]
                                                              for (let i = shuffled.length - 1; i > 0; i -= 1) {
                                                                  const j = Math.floor(Math.random() * (i + 1))
                                                                  ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
                                                              }
                                                              return shuffled
                                                          })()
                                                        : orderedOptions
                                                
                                                return (
                                                    <div key={question.id} className={`p-4 ${questionDividerClass}`}>
                                                        <div className="mb-3 space-y-1">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <span className="text-base font-semibold text-gray-900">
                                                                    {questionLabel}
                                                                </span>
                                                                {totalPoints > 0 && (
                                                                    <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                                                                        {totalPoints} {totalPoints === 1 ? (locale === 'fr' ? 'point' : 'point') : (locale === 'fr' ? 'points' : 'points')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <MathRenderer text={questionText} className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed" tableScale="fit" />
                                                        </div>
                                                        
                                                        {/* MCQ Options */}
                                                        <div className="mt-3 space-y-2">
                                                            {displayOptions.map((option, optionIndex) => {
                                                                const optionLetter = String.fromCharCode(65 + optionIndex) // A, B, C, etc.
                                                                const isCorrect = Boolean(option.isCorrect)
                                                                return (
                                                                    <label key={option.id} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded-md cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            disabled
                                                                            checked={viewMode === 'correction' && question.requireAllCorrect ? isCorrect : false}
                                                                            className="mt-1 w-4 h-4 text-brand-900 border-gray-300 rounded focus:ring-brand-900 cursor-not-allowed"
                                                                        />
                                                                        <span className="text-sm text-gray-900 flex-1">
                                                                            <span className="font-semibold mr-2">{optionLetter}.</span>
                                                                            <MathRenderer
                                                                                text={option.instruction || `${locale === 'fr' ? 'Option' : 'Option'} ${optionIndex + 1}`}
                                                                                className="inline text-sm text-gray-900 whitespace-pre-wrap leading-relaxed"
                                                                                tableScale="fit"
                                                                            />
                                                                                                                                                    </span>
                                                                        {viewMode === 'correction' && !question.requireAllCorrect && typeof option.maxPoints === 'number' && (
                                                                            <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                                                                                {option.maxPoints} {locale === 'fr' ? 'pts' : 'pts'}
                                                                            </span>
                                                                        )}
                                                                    </label>
                                                                )
                                                            })}
                                                        </div>

                                                        </div>
                                                )
                                            }
                                            
                                            const primarySegment = question.segments[0]
                                            const perfectExamples = Array.isArray(primarySegment?.rubric?.examples)
                                                ? primarySegment?.rubric?.examples?.filter(Boolean).join('\n\n')
                                                : primarySegment?.rubric?.examples

                                            if (viewMode === 'correction' && !perfectExamples) {
                                                return null
                                            }

                                            // Render text questions
                                            return (
                                                <div key={question.id} className={`p-4 ${questionDividerClass}`}>
                                                    <div className="mb-3 space-y-1">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <span className="text-base font-semibold text-gray-900">
                                                                {questionLabel}
                                                            </span>
                                                            {totalPoints > 0 && (
                                                                <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                                                                    {totalPoints} {totalPoints === 1 ? (locale === 'fr' ? 'point' : 'point') : (locale === 'fr' ? 'points' : 'points')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <MathRenderer text={questionText} className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed" tableScale="fit" />
                                                    </div>

                                                                                                        {/* Zone de reponse */}
                                                    {viewMode === 'student' && (!answerTemplateLocked || hasAnswerTemplate) && (
                                                        <div className="mt-3 rounded-md border border-gray-300 bg-gray-50">
                                                            {hasAnswerTemplate && (
                                                            <div className="px-3 pt-3 pb-2 border-b border-gray-200">
                                                                <MathRenderer text={answerTemplate} className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed" tableScale="fit" />
                                                            </div>
                                                            )}
                                                            {!answerTemplateLocked && (
                                                                <div className="px-3 py-2">
                                                                    <textarea
                                                                        readOnly
                                                                        placeholder={locale === 'fr' ? 'Tapez votre r\u00e9ponse ici...' : 'Type your answer here...'}
                                                                        className="w-full min-h-[100px] text-sm text-gray-900 placeholder-gray-400 focus:outline-none resize-none bg-transparent"
                                                                        style={{ cursor: 'not-allowed' }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {viewMode === 'correction' && perfectExamples && (
                                                        <div className="mt-4 text-sm text-gray-900">
                                                            <MathRenderer text={perfectExamples} className="whitespace-pre-wrap leading-relaxed" tableScale="fit" />
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            )
                        })
                    })()}
                </>
            )}
        </div>
    )
}

