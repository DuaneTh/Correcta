interface CourseCodeBadgeProps {
    code: string
    className?: string
}

export function CourseCodeBadge({ code, className = '' }: CourseCodeBadgeProps) {
    const baseClasses = "inline-flex items-center rounded-full border border-brand-900/20 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-900"

    return (
        <span className={className ? `${baseClasses} ${className}` : baseClasses}>
            {code}
        </span>
    )
}
