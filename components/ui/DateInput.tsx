'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import { registerLocale } from 'react-datepicker'
import { fr, enUS } from 'date-fns/locale'
import type { Locale } from '@/lib/i18n/config'

registerLocale('fr', fr)
registerLocale('en', enUS)

// Custom time input component with compact horizontal layout
const CustomTimeInput = ({ date, value, onChange, currentLocale }: {
    date?: Date | null
    value?: string
    onChange?: (time: string) => void
    currentLocale: Locale
}) => {
    const getCurrentTime = () => {
        if (value) {
            return value.split(':').map(v => parseInt(v, 10) || 0)
        }
        if (date) {
            return [date.getHours(), date.getMinutes()]
        }
        return [0, 0]
    }
    
    const [currentHours, currentMinutes] = getCurrentTime()

    const handleChange = (type: 'hours' | 'minutes', val: string) => {
        if (!onChange) return

        const numVal = parseInt(val, 10) || 0
        const newHours = type === 'hours' ? numVal : currentHours
        const newMinutes = type === 'minutes' ? numVal : currentMinutes

        const timeString = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`
        onChange(timeString)
    }

    const hours = Array.from({ length: 24 }, (_, i) => i)
    const minutes = Array.from({ length: 60 }, (_, i) => i)

    return (
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-200 bg-white">
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                {currentLocale === 'fr' ? 'Heure' : 'Time'}:
            </span>
            <select
                value={String(currentHours).padStart(2, '0')}
                onChange={(e) => handleChange('hours', e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-900 focus:border-brand-900 bg-white w-16"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {hours.map((h) => (
                    <option key={h} value={h}>
                        {h.toString().padStart(2, '0')}
                    </option>
                ))}
            </select>
            <span className="text-gray-500 font-semibold">:</span>
            <select
                value={String(currentMinutes).padStart(2, '0')}
                onChange={(e) => handleChange('minutes', e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-900 focus:border-brand-900 bg-white w-16"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {minutes.map((m) => (
                    <option key={m} value={m}>
                        {m.toString().padStart(2, '0')}
                    </option>
                ))}
            </select>
        </div>
    )
}

interface DateInputProps {
    value: Date | null
    onChange: (date: Date | null) => void
    locale: Locale
    placeholder?: string
    disabled?: boolean
    className?: string
    minDate?: Date
    onBlur?: () => void
}

export interface DateInputHandle {
    focus: () => void
}

export const DateInput = forwardRef<DateInputHandle, DateInputProps>(({ value, onChange, locale, placeholder, disabled, className, minDate, onBlur }, ref) => {
    const [inputValue, setInputValue] = useState('')
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)
    const [calendarMonth, setCalendarMonth] = useState<Date>(value || new Date())
    const inputRef = useRef<HTMLInputElement>(null)
    const datePickerRef = useRef<DatePicker>(null)

    useImperativeHandle(ref, () => ({
        focus: () => {
            inputRef.current?.focus()
        }
    }))

    // Initialize input value from date prop
    useEffect(() => {
        if (value) {
            const day = String(value.getDate()).padStart(2, '0')
            const month = String(value.getMonth() + 1).padStart(2, '0')
            const year = value.getFullYear()
            const hours = String(value.getHours()).padStart(2, '0')
                const minutes = String(value.getMinutes()).padStart(2, '0')
                setInputValue(`${day}/${month}/${year} ${hours}:${minutes}`)
                setCalendarMonth(value)
        } else {
            setInputValue('')
        }
    }, [value])

    // Format input as user types (only numbers, auto-insert / and :)
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        const cursorPosition = e.target.selectionStart || 0
        
        // Extract only digits from the new value
        let rawValue = newValue.replace(/[^0-9]/g, '')
        
        // Limit to reasonable length (ddmmyyyyHHmm = 12 digits)
        if (rawValue.length > 12) {
            rawValue = rawValue.slice(0, 12)
        }

        // Format: DD/MM/YYYY HH:MM with auto-insertion of separators
        let formatted = ''
        for (let i = 0; i < rawValue.length; i++) {
            // Auto-insert separators at the right positions
            if (i === 2) formatted += '/'
            if (i === 4) formatted += '/'
            if (i === 8) formatted += ' '
            if (i === 10) formatted += ':'
            formatted += rawValue[i]
        }

        setInputValue(formatted)

        // Restore cursor position after formatting, accounting for inserted separators
        setTimeout(() => {
            if (inputRef.current) {
                // Count how many digits were before the cursor in the original input
                const digitsBeforeCursor = newValue.slice(0, cursorPosition).replace(/[^0-9]/g, '').length
                // Calculate new position: digits + separators inserted before this position
                let newCursorPos = digitsBeforeCursor
                if (digitsBeforeCursor > 2) newCursorPos++ // after first /
                if (digitsBeforeCursor > 4) newCursorPos++ // after second /
                if (digitsBeforeCursor > 8) newCursorPos++ // after space
                if (digitsBeforeCursor > 10) newCursorPos++ // after :
                // Ensure cursor is at the end if we're adding a new digit
                if (rawValue.length > inputValue.replace(/[^0-9]/g, '').length) {
                    newCursorPos = formatted.length
                }
                inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
            }
        }, 0)

        // Try to parse and update date if valid
        if (rawValue.length >= 8) {
            const day = parseInt(rawValue.slice(0, 2), 10)
            const month = parseInt(rawValue.slice(2, 4), 10) - 1 // month is 0-indexed
            const year = parseInt(rawValue.slice(4, 8), 10)
            const hours = rawValue.length >= 10 ? parseInt(rawValue.slice(8, 10), 10) : 0
            const minutes = rawValue.length >= 12 ? parseInt(rawValue.slice(10, 12), 10) : 0

            // Validate ranges
            if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 2000 && year <= 2100 && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                const newDate = new Date(year, month, day, hours, minutes)
                if (!isNaN(newDate.getTime())) {
                    // Check if date is valid (e.g., not 31/02)
                    if (newDate.getDate() === day && newDate.getMonth() === month && newDate.getFullYear() === year) {
                        if (!minDate || newDate >= minDate) {
                            onChange(newDate)
                        }
                    }
                }
            }
        } else if (rawValue.length === 0) {
            onChange(null)
        }
    }


    const handleCalendarIconClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!isCalendarOpen) {
            setCalendarMonth(value || new Date())
        }
        setIsCalendarOpen(!isCalendarOpen)
    }

    const placeholderText = placeholder || (locale === 'fr' ? 'jj/mm/aaaa hh:mm' : 'dd/mm/yyyy hh:mm')
    
    // Generate placeholder overlay showing remaining characters
    const getPlaceholderOverlay = () => {
        if (inputValue.length === 0) return placeholderText
        if (inputValue.length >= 16) return '' // DD/MM/YYYY HH:MM = 16 chars
        
        // Show remaining characters from placeholder starting from current input length
        const remaining = placeholderText.slice(inputValue.length)
        return remaining
    }

    return (
        <div className={`relative flex items-center ${className || ''}`}>
            <div className="relative w-full">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={onBlur}
                    disabled={disabled}
                    className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-brand-900 focus:border-brand-900 bg-transparent relative z-10"
                    maxLength={16} // DD/MM/YYYY HH:MM = 16 chars
                />
                {/* Placeholder overlay that stays visible */}
                {inputValue.length < 16 && (
                    <div 
                        className="absolute inset-0 px-3 py-2 pr-10 pointer-events-none flex items-center text-gray-300 select-none z-0"
                        style={{ 
                            fontFamily: 'inherit',
                            fontSize: 'inherit',
                            lineHeight: 'inherit'
                        }}
                    >
                        <span className="text-transparent">{inputValue}</span>
                        <span className="text-gray-300">{getPlaceholderOverlay()}</span>
                    </div>
                )}
            </div>
            <button
                type="button"
                onClick={handleCalendarIconClick}
                disabled={disabled}
                className="absolute right-2 p-1 text-gray-400 hover:text-brand-900 focus:outline-none disabled:opacity-50 z-20"
                tabIndex={-1}
            >
                <Calendar className="w-4 h-4" />
            </button>
            {isCalendarOpen && (
                <>
                    <style jsx global>{`
                        .react-datepicker-popper {
                            z-index: 9999 !important;
                        }
                        .react-datepicker {
                            font-family: inherit;
                            border: none;
                            border-radius: 0.5rem;
                            box-shadow: none;
                            padding: 0;
                        }
                        .react-datepicker__header {
                            background-color: white;
                            border-bottom: 1px solid #e5e7eb;
                            padding: 0.75rem 1rem;
                            position: relative;
                            border-radius: 0;
                        }
                        .react-datepicker__current-month {
                            font-weight: 600;
                            font-size: 0.9375rem;
                            color: #111827;
                            margin: 0;
                            padding: 0;
                            text-align: center;
                            line-height: 1.5rem;
                        }
                        .react-datepicker__navigation {
                            top: 0.75rem !important;
                            width: 2rem !important;
                            height: 2rem !important;
                            border: none;
                            background: transparent;
                            display: none;
                        }
                        .react-datepicker__navigation-icon {
                            display: none;
                        }
                        .react-datepicker__day-name {
                            color: #6b7280;
                            font-weight: 500;
                            font-size: 0.75rem;
                            width: 2.5rem;
                            line-height: 2.5rem;
                            margin: 0;
                        }
                        .react-datepicker__day {
                            border-radius: 0.375rem;
                            margin: 0.125rem;
                            width: 2.5rem;
                            line-height: 2.5rem;
                            font-size: 0.875rem;
                        }
                        .react-datepicker__day:hover {
                            background-color: #f3f4f6;
                        }
                        .react-datepicker__day--selected {
                            background-color: #1a365d;
                            color: white;
                            font-weight: 500;
                        }
                        .react-datepicker__day--selected:hover {
                            background-color: #2c5282;
                        }
                        .react-datepicker__day--keyboard-selected {
                            background-color: #e2e8f0;
                        }
                        .react-datepicker__day--today {
                            font-weight: 600;
                        }
                        .react-datepicker__month-container {
                            float: none;
                        }
                        .react-datepicker__month {
                            margin: 0.5rem;
                        }
                    `}</style>
                    <div className="absolute top-full left-0 z-50 mt-1">
                        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden w-[320px]">
                            {/* Custom header with navigation */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const prevMonth = new Date(calendarMonth)
                                        prevMonth.setMonth(prevMonth.getMonth() - 1)
                                        setCalendarMonth(prevMonth)
                                    }}
                                    className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="text-sm font-semibold text-gray-900 capitalize">
                                    {new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' }).format(calendarMonth)}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextMonth = new Date(calendarMonth)
                                        nextMonth.setMonth(nextMonth.getMonth() + 1)
                                        setCalendarMonth(nextMonth)
                                    }}
                                    className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                            <DatePicker
                                ref={datePickerRef}
                                selected={value || undefined}
                                onChange={(date: Date | null) => {
                                    if (date) {
                                        onChange(date)
                                    }
                                }}
                                onMonthChange={(date: Date) => {
                                    setCalendarMonth(date)
                                }}
                                openToDate={calendarMonth}
                                showTimeSelect
                                timeFormat="HH:mm"
                                timeIntervals={1}
                                dateFormat="dd/MM/yyyy HH:mm"
                                locale={locale === 'fr' ? 'fr' : 'en'}
                                minDate={minDate}
                                inline
                                shouldCloseOnSelect={false}
                                onClickOutside={() => setIsCalendarOpen(false)}
                                customTimeInput={(props: { date?: Date | null; value?: string; onChange?: (time: string) => void }) => {
                                    return (
                                        <CustomTimeInput 
                                            date={value || props.date}
                                            value={props.value}
                                            onChange={(time: string) => {
                                                if (props.onChange) {
                                                    props.onChange(time)
                                                }
                                                // Also update the main date when time changes
                                                const currentDate = value || props.date || new Date()
                                                const [hours, minutes] = time.split(':').map(Number)
                                                const newDate = new Date(currentDate)
                                                newDate.setHours(hours, minutes)
                                                onChange(newDate)
                                            }}
                                            currentLocale={locale}
                                        />
                                    )
                                }}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    )
})

DateInput.displayName = 'DateInput'

