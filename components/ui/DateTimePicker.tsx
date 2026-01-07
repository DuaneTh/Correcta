"use client"

import { forwardRef, useEffect, useState } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import { fr, enUS } from 'date-fns/locale'
import type { Locale } from '@/lib/i18n/config'

registerLocale('fr', fr)
registerLocale('en', enUS)

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

const CustomInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, ...props }, ref) => {
        const baseClasses =
            "block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-brand-900 focus:border-brand-900 cursor-pointer bg-white"
        const combinedClassName = className ? `${baseClasses} ${className}` : baseClasses

        return (
            <input
                {...props}
                ref={ref}
                readOnly
                className={combinedClassName}
            />
        )
    }
)
CustomInput.displayName = 'CustomInput'

interface DateTimePickerProps {
    date: Date | null
    onChange: (date: Date | null) => void
    locale: Locale
    placeholder?: string
    disabled?: boolean
    className?: string
    inputClassName?: string
    minDate?: Date
    autoOpen?: boolean
    onBlur?: () => void
    popperPlacement?: string
    popperClassName?: string
}

export function DateTimePicker({ date, onChange, locale, placeholder, disabled, className, inputClassName, minDate, autoOpen, onBlur, popperPlacement, popperClassName }: DateTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        if (autoOpen && !disabled) {
            // setState in effect is intentional here to open the popper as soon as edit mode toggles on
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsOpen(true)
        }
    }, [autoOpen, disabled])

    const handleClose = () => {
        onBlur?.()
        setIsOpen(false)
    }

    return (
        <div className={className}>
            <DatePicker
                selected={date}
                onChange={onChange}
                onInputClick={() => setIsOpen(true)}
                onClickOutside={handleClose}
                onCalendarClose={handleClose}
                open={isOpen}
                showTimeInput
                customTimeInput={<CustomTimeInput currentLocale={locale} onDateTimeChange={(d) => onChange(d)} />}
                customInput={<CustomInput onBlur={onBlur} className={inputClassName} />}
                onChangeRaw={(e) => e.preventDefault()}
                dateFormat="dd/MM/yyyy HH:mm"
                locale={locale === 'fr' ? 'fr' : 'en'}
                placeholderText={placeholder || (locale === 'fr' ? 'jj/mm/aaaa --:--' : 'dd/mm/yyyy --:--')}
                wrapperClassName="w-full"
                disabled={disabled}
                shouldCloseOnSelect={false}
                minDate={minDate}
                popperPlacement={popperPlacement}
                popperClassName={popperClassName}
            />
        </div>
    )
}
