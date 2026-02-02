import type { AnchorHTMLAttributes } from 'react'
import Link from 'next/link'
import { cn } from './cn'

type TextLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string
    size?: 'xs' | 'sm'
}

const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
}

export function TextLink({ href, size = 'xs', className, ...props }: TextLinkProps) {
    return (
        <Link
            href={href}
            className={cn('font-semibold text-brand-900 hover:text-brand-800', sizeClasses[size], className)}
            {...props}
        />
    )
}
