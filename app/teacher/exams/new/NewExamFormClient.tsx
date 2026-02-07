'use client'

import { useState, useEffect, Fragment, forwardRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Save, ChevronDown, Check } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/config'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'
import dynamic from 'next/dynamic'
import DatePicker, { registerLocale } from 'react-datepicker'

const PDFImportUploader = dynamic(
    () => import('@/components/exam-import/PDFImportUploader'),
    { ssr: false }
)
import "react-datepicker/dist/react-datepicker.css"
import { fr, enUS } from 'date-fns/locale'
import { Listbox, Transition } from '@headlessui/react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Inline, Stack } from '@/components/ui/Layout'
import { Input, Select } from '@/components/ui/Form'
import { TextLink } from '@/components/ui/TextLink'

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
        <Inline gap="sm" className="items-center justify-center p-2 border-t border-gray-200 mt-2">
            <Stack gap="xs">
                <Text variant="caption" className="font-medium">
                    {currentLocale === 'fr' ? 'Heure' : 'Hour'}
                </Text>
                <Select
                    value={String(currentHours).padStart(2, '0')}
                    onChange={(e) => handleChange('hours', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    size="sm"
                    className="w-20"
                >
                    {hours.map((h) => (
                        <option key={h} value={h}>
                            {h.toString().padStart(2, '0')}
                        </option>
                    ))}
                </Select>
            </Stack>
            <Text variant="muted" className="mt-5">:</Text>
            <Stack gap="xs">
                <Text variant="caption" className="font-medium">
                    {currentLocale === 'fr' ? 'Minutes' : 'Minutes'}
                </Text>
                <Select
                    value={String(currentMinutes).padStart(2, '0')}
                    onChange={(e) => handleChange('minutes', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    size="sm"
                    className="w-20"
                >
                    {minutes.map((m) => (
                        <option key={m} value={m}>
                            {m.toString().padStart(2, '0')}
                        </option>
                    ))}
                </Select>
            </Stack>
        </Inline>
    )
}

const DateTimeInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ size: _size, ...props }, ref) => (
        <Input
            {...props}
            ref={ref}
            readOnly
            className="cursor-pointer"
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
    const [showPdfImport, setShowPdfImport] = useState(false)

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
    const availableSections = useMemo(() => selectedCourse?.classes ?? [], [selectedCourse])

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

            const data = await fetchJsonWithCsrf<{ id?: string; created?: Array<{ id?: string }> }>(
                '/api/exams',
                {
                    method: 'POST',
                    body
                }
            )
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
                <TextLink href="/teacher/exams">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {dict.backLabel}
                </TextLink>

                <Card className="mt-6">
                    <CardBody padding="lg">
                        <Text variant="muted" className="text-center">{dict.emptyCoursesMessage}</Text>
                    </CardBody>
                </Card>
            </div>
        )
    }

    if (showPdfImport) {
        return (
            <div className="max-w-2xl mx-auto">
                <Inline align="start" gap="md" wrap="wrap" className="mb-6">
                    <Button variant="ghost" onClick={() => setShowPdfImport(false)}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        {currentLocale === 'fr' ? 'Retour' : 'Back'}
                    </Button>
                </Inline>

                <Text as="h1" variant="pageTitle" className="mb-6">
                    {currentLocale === 'fr' ? 'Importer un examen depuis un PDF' : 'Import exam from PDF'}
                </Text>

                <Card>
                    <CardBody padding="lg">
                        <Stack gap="lg">
                            <Stack gap="sm">
                                <Text as="label" variant="label">
                                    {dict.courseLabel}
                                </Text>
                                <select
                                    value={selectedCourseId}
                                    onChange={(e) => setSelectedCourseId(e.target.value)}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 p-2 border"
                                >
                                    <option value="">-- {dict.courseLabel} --</option>
                                    {courses.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.code} - {c.name}
                                        </option>
                                    ))}
                                </select>
                            </Stack>

                            {selectedCourseId ? (
                                <PDFImportUploader
                                    courseId={selectedCourseId}
                                    onCancel={() => setShowPdfImport(false)}
                                />
                            ) : (
                                <Card className="border-dashed border-2 border-gray-300">
                                    <CardBody padding="lg" className="text-center">
                                        <Text variant="muted">
                                            {currentLocale === 'fr'
                                                ? 'Selectionnez un cours pour importer un PDF'
                                                : 'Select a course to import a PDF'}
                                        </Text>
                                    </CardBody>
                                </Card>
                            )}
                        </Stack>
                    </CardBody>
                </Card>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto">
            <Inline align="start" gap="md" wrap="wrap" className="mb-6">
                <TextLink href="/teacher/courses">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {dictionary.teacher.examBuilderPage.backToCoursesList}
                </TextLink>

                {selectedCourseId && (
                    <TextLink href={`/teacher/courses/${selectedCourseId}`}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        {dictionary.teacher.examBuilderPage.backToThisCourse}
                    </TextLink>
                )}

                <TextLink href="/teacher/exams">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {dictionary.teacher.examBuilderPage.backToExams}
                </TextLink>
            </Inline>

            <Card>
                <div className="px-6 py-4 border-b border-gray-200">
                    <Text as="h1" variant="pageTitle">{dict.title}</Text>
                </div>

                <form onSubmit={handleSubmit}>
                    <CardBody padding="lg">
                        <Stack gap="lg">
                            {sourceExam && (
                                <div className="rounded-md border border-brand-200 bg-brand-50 px-4 py-3">
                                    <Text variant="caption" className="text-brand-900">
                                        {currentLocale === 'fr'
                                            ? `Duplication de "${sourceExam.title}"`
                                            : `Duplicating "${sourceExam.title}"`}
                                    </Text>
                                </div>
                            )}

                            <Stack gap="sm">
                                <Text as="label" htmlFor="course" variant="label">
                                    {dict.courseLabel}
                                </Text>
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
                            </Stack>

                            {availableSections.length > 0 ? (
                                <Stack gap="sm">
                                    <Text variant="label">
                                        {currentLocale === 'fr' ? 'Sections concernées' : 'Target sections'}
                                    </Text>
                                    <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                                        <Text variant="caption">
                                            {currentLocale === 'fr'
                                                ? "Choisissez une ou plusieurs sections."
                                                : 'Choose one or more sections.'}
                                        </Text>
                                        <Inline gap="sm" wrap="wrap">
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
                                        </Inline>
                                        <Inline gap="sm" className="text-xs text-gray-600">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="xs"
                                                onClick={() => setSelectedSectionIds(availableSections.map((section) => section.id))}
                                                disabled={isSubmitting}
                                            >
                                                {currentLocale === 'fr' ? 'Tout sélectionner' : 'Select all'}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="xs"
                                                onClick={() => setSelectedSectionIds([])}
                                                disabled={isSubmitting}
                                            >
                                                {currentLocale === 'fr' ? 'Tout désélectionner' : 'Clear selection'}
                                            </Button>
                                        </Inline>
                                    </div>
                                </Stack>
                            ) : (
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                    <Text variant="caption">
                                        {currentLocale === 'fr'
                                            ? 'Ce cours ne contient pas de section. Lexamen sappliquera au cours entier.'
                                            : 'This course has no sections. The exam will apply to the whole course.'}
                                    </Text>
                                </div>
                            )}

                            <Stack gap="sm">
                                <Text as="label" htmlFor="title" variant="label">
                                    {dict.examTitleLabel}
                                </Text>
                                <Input
                                    id="title"
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={dict.examTitlePlaceholder}
                                    disabled={isSubmitting}
                                />
                            </Stack>

                            <Stack gap="xs">
                                <Inline align="start" gap="sm">
                                    <input
                                        id="isDraft"
                                        type="checkbox"
                                        checked={isDraft}
                                        onChange={(e) => setIsDraft(e.target.checked)}
                                        className="h-4 w-4 text-brand-900 focus:ring-brand-900 border-gray-300 rounded"
                                        disabled={isSubmitting}
                                    />
                                    <Text as="label" htmlFor="isDraft" variant="body" className="font-medium">
                                        {currentLocale === 'fr' ? 'Definir la date et la duree plus tard' : 'Set date and duration later'}
                                    </Text>
                                </Inline>
                                <Text variant="caption" className="ml-6">
                                    {currentLocale === 'fr' ? "Vous pourrez planifier l'examen apres sa creation" : 'You can schedule the exam after creation'}
                                </Text>
                            </Stack>

                            <div className={isDraft ? 'opacity-50 pointer-events-none' : ''}>
                                <Stack gap="sm">
                                    <Text as="label" htmlFor="startDateTime" variant="label">
                                        {dict.startDateTimeLabel}
                                    </Text>
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
                                </Stack>
                            </div>

                            <div className={isDraft ? 'opacity-50 pointer-events-none' : ''}>
                                <Stack gap="sm">
                                    <Text as="label" htmlFor="duration" variant="label">
                                        {dict.durationLabel}
                                    </Text>
                                    <Input
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
                                        disabled={isSubmitting}
                                    />
                                </Stack>
                            </div>

                            {/* PDF Import option */}
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white text-gray-500">
                                        {currentLocale === 'fr' ? 'ou' : 'or'}
                                    </span>
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setShowPdfImport(true)}
                                className="w-full"
                            >
                                {currentLocale === 'fr' ? 'Importer depuis un PDF existant' : 'Import from existing PDF'}
                            </Button>

                            {errorKeys.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                                    <Text variant="caption" className="text-red-800 whitespace-pre-line">{getErrorMessage(errorKeys)}</Text>
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full"
                            >
                                {isSubmitting ? (
                                    currentLocale === 'fr' ? 'Enregistrement...' : 'Saving...'
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" />
                                        {dictionary.login.nextButton}
                                    </>
                                )}
                            </Button>
                        </Stack>
                    </CardBody>
                </form>
            </Card>
        </div>
    )
}
