import type { ReactNode } from 'react'
import { cn } from './cn'

type SegmentedOption<T extends string> = {
    value: T
    label: string
    icon?: ReactNode
}

type SegmentedControlProps<T extends string> = {
    value: T
    options: SegmentedOption<T>[]
    onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({ value, options, onChange }: SegmentedControlProps<T>) {
    return (
        <div className="inline-flex rounded-md border border-gray-300 bg-white p-1">
            {options.map((option) => {
                const isActive = option.value === value
                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(option.value)}
                        className={cn(
                            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors',
                            isActive ? 'bg-brand-900 text-white' : 'text-gray-600 hover:text-gray-800'
                        )}
                    >
                        {option.icon}
                        <span>{option.label}</span>
                    </button>
                )
            })}
        </div>
    )
}
