interface ExamStatusBadgeProps {
    label: string
    className?: string
}

export function ExamStatusBadge({ label, className = '' }: ExamStatusBadgeProps) {
    const baseClasses = "inline-flex items-center px-3 py-0.5 text-xs font-medium rounded-full border"

    return (
        <span className={className ? `${baseClasses} ${className}` : baseClasses}>
            {label}
        </span>
    )
}
