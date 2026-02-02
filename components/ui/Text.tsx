import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

type TextVariant =
    | 'pageTitle'
    | 'sectionTitle'
    | 'body'
    | 'muted'
    | 'caption'
    | 'overline'
    | 'xsMuted'
    | 'label'

const variantClasses: Record<TextVariant, string> = {
    pageTitle: 'text-3xl font-bold text-brand-900',
    sectionTitle: 'text-lg font-semibold text-gray-900',
    body: 'text-base text-gray-900',
    muted: 'text-sm text-gray-600',
    caption: 'text-sm text-gray-500',
    overline: 'text-xs font-semibold uppercase tracking-[0.2em] text-gray-500',
    xsMuted: 'text-xs text-gray-500',
    label: 'text-sm font-medium text-gray-700',
}

type TextProps<T extends ElementType> = HTMLAttributes<HTMLElement> & {
    as?: T
    variant?: TextVariant
    truncate?: boolean
    children: ReactNode
}

export function Text<T extends ElementType = 'p'>({
    as,
    variant = 'body',
    truncate = false,
    className,
    children,
    ...props
}: TextProps<T>) {
    const Component = (as || 'p') as ElementType
    return (
        <Component className={cn(variantClasses[variant], truncate ? 'truncate' : '', className)} {...props}>
            {children}
        </Component>
    )
}
