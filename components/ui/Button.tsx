import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'

type ButtonSize = 'xs' | 'sm' | 'md'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant
    size?: ButtonSize
}

const baseClasses =
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

const variantClasses: Record<ButtonVariant, string> = {
    primary: 'bg-brand-900 text-white hover:bg-brand-700',
    secondary: 'border border-gray-200 bg-white text-gray-900 hover:bg-gray-50',
    ghost: 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
    destructive: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
}

const sizeClasses: Record<ButtonSize, string> = {
    xs: 'px-3 py-1.5 text-xs font-semibold',
    sm: 'px-3 py-1.5 text-xs font-semibold',
    md: 'px-4 py-2 text-sm',
}

export function Button({
    variant = 'primary',
    size = 'md',
    className,
    type = 'button',
    ...props
}: ButtonProps) {
    return (
        <button
            type={type}
            className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
            {...props}
        />
    )
}
