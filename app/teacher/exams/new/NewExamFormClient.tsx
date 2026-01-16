'use client'

import { useState, useEffect, Fragment, forwardRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Save, ChevronDown, Check } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/config'
import Link from 'next/link'
import DatePicker, { registerLocale } from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import { fr, enUS } from 'date-fns/locale'
import { Listbox, Transition } from '@headlessui/react'

registerLocale('fr', fr)
registerLocale('en', enUS)

interface Course {
    id: string
    code: string
    name: string
    classes: Array<{
        id: string
        name: string
    }>
}

interface NewExamFormClientProps {
    courses: Course[]
    dictionary: Dictionary
    currentLocale: Locale
}

interface CustomTimeInputProps {
    date?: Date
    value?: string
    onChange?: (time: string) => void
    onDateTimeChange?: (date: Date) => void
    currentLocale: Locale
}

const CustomTimeInput = ({ date, value, onChange, onDateTimeChange, currentLocale }: CustomTimeInputProps) => {
    // Parse current value "HH:mm" or default to "00:00"
    const [currentHours, currentMinutes] = (value || '00:00')
        .split(':')
        .map((v) => parseInt(v, 10) || 0)

    const handleChange = (type: 'hours' | 'minutes', val: string) => {
        if (!onChange || !onDateTimeChange || !date) return

        const numVal = parseInt(val, 10) || 0
        const newHours = type === 'hours' ? numVal : currentHours
        const newMinutes = type === 'minutes' ? numVal : currentMinutes

        const timeString = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`
        onChange(timeString)

        // Also update the main date state
        const newDate = new Date(date)
        newDate.setHours(newHours)
        newDate.setMinutes(newMinutes)
        onDateTimeChange(newDate)
    }

    const hours = Array.from({ length: 24 }, (_, i) => i)
    const minutes = Array.from({ length: 60 }, (_, i) => i)

    return (
        <div className="flex gap-2 items-center justify-center p-2 border-t border-gray-200 mt-2">
            <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">
                    {currentLocale === 'fr' ? 'Heure' : 'Hour'}
                </label>
                <select
                    value={String(currentHours).padStart(2, '0')}
                    onChange={(e) => handleChange('hours', e.target.value)}
                    className="block w-20 px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-900 focus:border-brand-900"
                    onClick={(e) => e.stopPropagation()}
                >
                    {hours.map((h) => (
                        <option key={h} value={h}>
                            {h.toString().padStart(2, '0')}
                        </option>
                    ))}
                </select>
            </div>
            <span className="mt-5 text-gray-400">:</span>
            <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">
                    {currentLocale === 'fr' ? 'Minutes' : 'Minutes'}
                </label>
                <select
                    value={String(currentMinutes).padStart(2, '0')}
                    onChange={(e) => handleChange('minutes', e.target.value)}
                    className="block w-20 px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-900 focus:border-brand-900"
                    onClick={(e) => e.stopPropagation()}
                >
                    {minutes.map((m) => (
                        <option key={m} value={m}>
                            {m.toString().padStart(2, '0')}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    )
}

const DateTimeInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => (
        <input
            {...props}
            ref={ref}
            readOnly
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-brand-900 focus:border-brand-900 cursor-pointer bg-white"
        />
    )
)
DateTimeInput.displayName = 'DateTimeInput'

export default function NewExamFormClient({ courses, dictionary, currentLocale }: NewExamFormClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const dict = dictionary.teacher.newExamPage

    // Read courseId from URL params for pre-selection
    const initialCourseId = searchParams.get('courseId')
    const duplicateFrom = searchParams.get('duplicateFrom')

    // Form state
    const [selectedCourseId, setSelectedCourseId] = useState<string>('')
    const [title, setTitle] = useState<string>('')
    const [startDateTime, setStartDateTime] = useState<Date | null>(null)
    const [durationMinutes, setDurationMinutes] = useState<string>('')
    const [isDraft, setIsDraft] = useState(false)
    const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([])
    const [sourceExam, setSourceExam] = useState<{ id: string; title: string; courseId: string } | null>(null)

    // UI state
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorKeys, setErrorKeys] = useState<string[]>([])

    // Pre-select course if courseId in URL and exists in courses list
    useEffect(() => {
        if (initialCourseId && courses.some(c => c.id === initialCourseId)) {
            setSelectedCourseId(initialCourseId)
        }
    }, [initialCourseId, courses])

    useEffect(() => {
        if (!duplicateFrom) {
            setSourceExam(null)
            return
        }
        let cancelled = false
        const loadSource = async () => {
            try {
                const res = await fetch(`/api/exams/${duplicateFrom}`)
                if (!res.ok) return
                const data = await res.json()
                if (cancelled || !data?.id) return
                setSourceExam({ id: data.id, title: data.title || '', courseId: data.courseId || '' })
            } catch {
                if (!cancelled) setSourceExam(null)
            }
        }
        void loadSource()
        return () => {
            cancelled = true
        }
    }, [duplicateFrom])

    useEffect(() => {
        if (!sourceExam) return
        if (!selectedCourseId && sourceExam.courseId && courses.some(c => c.id === sourceExam.courseId)) {
            setSelectedCourseId(sourceExam.courseId)
        }
        if (!title.trim()) {
            const prefix = currentLocale === 'fr' ? 'Copie de ' : 'Copy of '
            setTitle(`${prefix}${sourceExam.title}`.trim())
        }
    }, [sourceExam, selectedCourseId, title, currentLocale, courses])

    const selectedCourse = courses.find((course) => course.id === selectedCourseId)
    const availableSections = selectedCourse?.classes ?? []

    useEffect(() => {
        setSelectedSectionIds((prev) => {
            if (availableSections.length === 0) {
                return prev.length === 0 ? prev : []
            }
            const availableIds = new Set(availableSections.map((section) => section.id))
            const next = prev.filter((id) => availableIds.has(id))
            const normalized =
                next.length > 0 ? next : availableSections.map((section) => section.id)
            if (
                normalized.length === prev.length &&
                normalized.every((id, index) => id === prev[index])
            ) {
                return prev
            }
            return normalized
        })
    }, [availableSections])

    const validateForm = (): string[] => {
        const errors: string[] = []
        
        if (!selectedCourseId) {
            errors.push('validationMissingCourse')
        }
        if (!title.trim()) {
            errors.push('validationMissingTitle')
        }

        if (availableSections.length > 0 && selectedSectionIds.length === 0) {
            errors.push('validationMissingSections')
        }

        if (!isDraft) {
            if (!startDateTime) {
                errors.push('validationMissingDate')
            }
            if (!durationMinutes || parseInt(durationMinutes) <= 0) {
                errors.push('validationMissingDuration')
            }

            // Check if start date is in the past
            if (startDateTime) {
                const now = new Date()
                if (startDateTime < now) {
                    errors.push('validationPastDate')
                }
            }
        }

        return errors
    }

    const getErrorMessage = (keys: string[]): string => {
        if (keys.length === 0) return ''
        
        const messages: string[] = []
        const hasDateError = keys.includes('validationMissingDate')
        const hasDurationError = keys.includes('validationMissingDuration')
        const needsLaterOption = hasDateError || hasDurationError
        
        keys.forEach(key => {
            switch (key) {
                case 'validationMissingCourse':
                    messages.push(dict.validationMissingCourse)
                    break
                case 'validationMissingTitle':
                    messages.push(dict.validationMissingTitle)
                    break
                case 'validationMissingSections':
                    messages.push(dict.validationMissingSections || (currentLocale === 'fr' ? 'Veuillez sélectionner au moins une section.' : 'Please select at least one section.'))
                    break
                case 'validationMissingDate':
                    messages.push(dict.validationMissingDate)
                    break
                case 'validationMissingDuration':
                    messages.push(dict.validationMissingDuration)
                    break
                case 'validationPastDate':
                    // Use the same text as in the builder
                    messages.push(dictionary.teacher.examBuilderPage.validationDatePast)
                    break
                default:
                    messages.push(key)
            }
        })
        
        // Add the "later option" message once at the end if needed
        if (needsLaterOption) {
            messages.push(currentLocale === 'fr' 
                ? 'Vous pouvez cocher la case pour le faire plus tard.' 
                : 'You can check the box to do it later.')
        }
        
        // Join with line breaks for better readability
        return messages.join('\n')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const validationErrors = validateForm()
        if (validationErrors.length > 0) {
            setErrorKeys(validationErrors)
            return
        }

        setErrorKeys([])

        // Submit directly without confirmation
        setIsSubmitting(true)

        try {
            const body: {
                title: string
                courseId: string
                status: 'DRAFT' | 'PUBLISHED'
                startAt?: string
                durationMinutes?: number
                classIds?: string[]
                sourceExamId?: string
            } = {
                title: title.trim(),
                courseId: selectedCourseId,
                status: isDraft ? 'DRAFT' : 'PUBLISHED',
                classIds: selectedSectionIds
            }
            if (duplicateFrom) {
                body.sourceExamId = duplicateFrom
            }

            // Only add startAt and durationMinutes if not a draft
            if (!isDraft && startDateTime && durationMinutes) {
                body.startAt = startDateTime.toISOString()
                body.durationMinutes = parseInt(durationMinutes)
            }

            const response = await fetch('/api/exams', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Failed to create exam')
            }

            const data = await response.json()
            const nextId = data?.id || data?.created?.[0]?.id
            if (!nextId) {
                throw new Error('Missing exam id')
            }
            router.push(`/dashboard/exams/${nextId}/builder`)
        } catch (err) {
            console.error('Error creating exam:', err)
            setErrorKeys([err instanceof Error ? err.message : 'An error occurred'])
            setIsSubmitting(false)
        }
    }

    if (courses.length === 0) {
        return (
            <div className="max-w-2xl mx-auto">
                <Link
                    href="/teacher/exams"
                    className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {dict.backLabel}
                </Link>

                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
                    <p className="text-gray-600">{dict.emptyCoursesMessage}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Link
                        href="/teacher/courses"
                        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        {dictionary.teacher.examBuilderPage.backToCoursesList}
                    </Link>

                    {selectedCourseId && (
                        <Link
                            href={`/teacher/courses/${selectedCourseId}`}
                            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            {dictionary.teacher.examBuilderPage.backToThisCourse}
                        </Link>
                    )}

                    <Link
                        href="/teacher/exams"
                        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        {dictionary.teacher.examBuilderPage.backToExams}
                    </Link>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h1 className="text-2xl font-bold text-gray-900">{dict.title}</h1>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {sourceExam && (
                        <div className="rounded-md border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
                            {currentLocale === 'fr'
                                ? `Duplication de \"${sourceExam.title}\"`
                                : `Duplicating \"${sourceExam.title}\"`}
                        </div>
                    )}
                    <div>
                        <label htmlFor="course" className="block text-sm font-medium text-gray-700 mb-2">
                            {dict.courseLabel}
                        </label>
                        <Listbox value={selectedCourseId} onChange={setSelectedCourseId} disabled={isSubmitting}>
                            <div className="relative">
                                <Listbox.Button className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-brand-900 focus:border-brand-900 text-left bg-white">
                                    <span className="block truncate">
                                        {selectedCourseId
                                            ? courses.find(c => c.id === selectedCourseId)?.code + ' - ' + courses.find(c => c.id === selectedCourseId)?.name
                                            : `-- ${dict.courseLabel} --`
                                        }
                                    </span>
                                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                        <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                                    </span>
                                </Listbox.Button>
                                <Transition
                                    as={Fragment}
                                    leave="transition ease-in duration-100"
                                    leaveFrom="opacity-100"
                                    leaveTo="opacity-0"
                                >
                                    <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 shadow-md border border-gray-200 focus:outline-none">
                                        <Listbox.Option
                                            key="empty"
                                            value=""
                                            className={({ active }) =>
                                                `relative cursor-pointer select-none py-2 pl-10 pr-4 ${active ? 'bg-brand-50 text-brand-900' : 'text-gray-900'
                                                }`
                                            }
                                        >
                                            {({ selected }) => (
                                                <>
                                                    <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                                        -- {dict.courseLabel} --
                                                    </span>
                                                    {selected && (
                                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-900">
                                                            <Check className="h-4 w-4" aria-hidden="true" />
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </Listbox.Option>
                                        {courses.map((course) => (
                                            <Listbox.Option
                                                key={course.id}
                                                value={course.id}
                                                className={({ active }) =>
                                                    `relative cursor-pointer select-none py-2 pl-10 pr-4 ${active ? 'bg-brand-50 text-brand-900' : 'text-gray-900'
                                                    }`
                                                }
                                            >
                                                {({ selected }) => (
                                                    <>
                                                        <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                                            {course.code} - {course.name}
                                                        </span>
                                                        {selected && (
                                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-900">
                                                                <Check className="h-4 w-4" aria-hidden="true" />
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </Listbox.Option>
                                        ))}
                                    </Listbox.Options>
                                </Transition>
                            </div>
                        </Listbox>
                    </div>

                                        {availableSections.length > 0 ? (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">
                                {currentLocale === 'fr' ? 'Sections concernées' : 'Target sections'}
                            </label>
                            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                                <p className="text-sm text-gray-600">
                                    {currentLocale === 'fr'
                                        ? "Choisissez une ou plusieurs sections."
                                        : 'Choose one or more sections.'}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {availableSections.map((section) => {
                                        const checked = selectedSectionIds.includes(section.id)
                                        return (
                                            <label
                                                key={section.id}
                                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm cursor-pointer ${
                                                    checked ? 'border-brand-300 bg-brand-50 text-brand-900' : 'border-gray-200 text-gray-700'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 text-brand-900 border-gray-300 rounded"
                                                    checked={checked}
                                                    onChange={(event) => {
                                                        setSelectedSectionIds((prev) =>
                                                            event.target.checked
                                                                ? [...prev, section.id]
                                                                : prev.filter((id) => id !== section.id)
                                                        )
                                                    }}
                                                />
                                                {section.name}
                                            </label>
                                        )
                                    })}
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                                    <button
                                        type="button"
                                        className="underline decoration-dotted underline-offset-4 hover:text-gray-900"
                                        onClick={() => setSelectedSectionIds(availableSections.map((section) => section.id))}
                                        disabled={isSubmitting}
                                    >
                                        {currentLocale === 'fr' ? 'Tout sélectionner' : 'Select all'}
                                    </button>
                                    <button
                                        type="button"
                                        className="underline decoration-dotted underline-offset-4 hover:text-gray-900"
                                        onClick={() => setSelectedSectionIds([])}
                                        disabled={isSubmitting}
                                    >
                                        {currentLocale === 'fr' ? 'Tout désélectionner' : 'Clear selection'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                            {currentLocale === 'fr'
                                ? 'Ce cours ne contient pas de section. Lexamen sappliquera au cours entier.'
                                : 'This course has no sections. The exam will apply to the whole course.'}
                        </div>
                    )}
{/* Exam Title */}
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                            {dict.examTitleLabel}
                        </label>
                        <input
                            id="title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={dict.examTitlePlaceholder}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-brand-900 focus:border-brand-900"
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Draft Checkbox */}
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <input
                                id="isDraft"
                                type="checkbox"
                                checked={isDraft}
                                onChange={(e) => setIsDraft(e.target.checked)}
                                className="h-4 w-4 text-brand-900 focus:ring-brand-900 border-gray-300 rounded"
                                disabled={isSubmitting}
                            />
                            <label htmlFor="isDraft" className="text-base font-medium text-gray-900">
                                {currentLocale === 'fr' ? 'Definir la date et la duree plus tard' : 'Set date and duration later'}
                            </label>
                        </div>
                        <p className="text-sm text-gray-500 ml-6">
                            {currentLocale === 'fr' ? "Vous pourrez planifier l'examen apres sa creation" : 'You can schedule the exam after creation'}
                        </p>
                    </div>

                    {/* Start Date & Time */}
                    <div className={isDraft ? 'opacity-50 pointer-events-none' : ''}>
                        <label htmlFor="startDateTime" className="block text-sm font-medium text-gray-700 mb-2">
                            {dict.startDateTimeLabel}
                        </label>
                        <div className="w-full">
                            <DatePicker
                                id="startDateTime"
                                selected={startDateTime}
                                onChange={(date) => setStartDateTime(date)}
                                showTimeInput
                                customTimeInput={<CustomTimeInput currentLocale={currentLocale} onDateTimeChange={setStartDateTime} />}
                                customInput={<DateTimeInput />}
                                onChangeRaw={(event) => event?.preventDefault()}
                                dateFormat="dd/MM/yyyy HH:mm"
                                locale={currentLocale === 'fr' ? 'fr' : 'en'}
                                placeholderText={currentLocale === 'fr' ? 'jj/mm/aaaa --:--' : 'dd/mm/yyyy --:--'}
                                wrapperClassName="w-full"
                                disabled={isSubmitting}
                                shouldCloseOnSelect={false}
                            />
                        </div>
                    </div>

                    {/* Duration */}
                    <div className={isDraft ? 'opacity-50 pointer-events-none' : ''}>
                        <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
                            {dict.durationLabel}
                        </label>
                        <input
                            id="duration"
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            min="1"
                            value={durationMinutes}
                            onChange={(e) => setDurationMinutes(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={(e) => {
                                if (['e', 'E', '+', '-', '.'].includes(e.key)) {
                                    e.preventDefault()
                                }
                            }}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-brand-900 focus:border-brand-900"
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Error Message */}
                    {errorKeys.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-4">
                            <p className="text-sm text-red-800 whitespace-pre-line">{getErrorMessage(errorKeys)}</p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-900 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            currentLocale === 'fr' ? 'Enregistrement...' : 'Saving...'
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                {dictionary.login.nextButton}
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}










