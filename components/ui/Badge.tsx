import type { HTMLAttributes } from 'react'
import { cn } from './cn'

type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
    variant?: BadgeVariant
}

const baseClasses = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium'

const variantClasses: Record<BadgeVariant, string> = {
    neutral: 'bg-gray-100 text-gray-700 border border-gray-200',
    info: 'bg-blue-50 text-blue-700 border border-blue-200',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
}

export function Badge({ variant = 'neutral', className, ...props }: BadgeProps) {
    return <span className={cn(baseClasses, variantClasses[variant], className)} {...props} />
}
