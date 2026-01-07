import { forwardRef, InputHTMLAttributes } from 'react'

interface CustomTimeInputProps {
    date?: Date
    value?: string
    onChange?: (time: string) => void
    onDateTimeChange?: (date: Date) => void
    currentLocale: string
}

export const CustomTimeInput = ({ date, value, onChange, onDateTimeChange, currentLocale }: CustomTimeInputProps) => {
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
                <label className="text-xs text-gray-500 font-medium">{currentLocale === 'fr' ? 'Heure' : 'Hour'}</label>
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
                <label className="text-xs text-gray-500 font-medium">{currentLocale === 'fr' ? 'Minutes' : 'Minutes'}</label>
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

export const DateTimeInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
    <input
        {...props}
        ref={ref}
        readOnly
        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-brand-900 focus:border-brand-900 cursor-pointer bg-white"
    />
))
DateTimeInput.displayName = 'DateTimeInput'

