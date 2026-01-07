import React from 'react'

interface PreviewToggleProps {
    label: string
    checked: boolean
    onChange: (next: boolean) => void
    className?: string
    labelClassName?: string
}

export function PreviewToggle({
    label,
    checked,
    onChange,
    className = '',
    labelClassName = '',
}: PreviewToggleProps) {
    return (
        <div className={`flex items-center gap-2 ${className}`.trim()}>
            <span className={`text-xs font-semibold text-gray-600 ${labelClassName}`.trim()}>
                {label}
            </span>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                onClick={() => onChange(!checked)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-all duration-250 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 ${
                    checked
                        ? 'bg-brand-700 border-brand-700 shadow-sm hover:bg-brand-800'
                        : 'bg-gray-200 border-gray-300 hover:bg-gray-300'
                }`}
            >
                <span className="sr-only">{label}</span>
                <span
                    className={`inline-block h-4 w-4 transform-gpu rounded-full bg-white shadow transition-all duration-250 ease-out ${
                        checked ? 'translate-x-4 scale-105 shadow-md' : 'translate-x-1 scale-100 shadow'
                    }`}
                />
            </button>
        </div>
    )
}
