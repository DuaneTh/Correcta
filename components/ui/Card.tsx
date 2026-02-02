import type { HTMLAttributes } from 'react'
import { cn } from './cn'

type CardInteractive = 'none' | 'subtle' | 'strong'

type CardOverflow = 'visible' | 'hidden'

type CardLayout = 'column' | 'row'

type CardPosition = 'static' | 'relative'

type CardProps = HTMLAttributes<HTMLDivElement> & {
    interactive?: CardInteractive
    overflow?: CardOverflow
    layout?: CardLayout
    position?: CardPosition
}

type CardHeaderProps = HTMLAttributes<HTMLDivElement>

type CardBodyPadding = 'none' | 'sm' | 'md' | 'lg'

type CardBodyProps = HTMLAttributes<HTMLDivElement> & {
    padding?: CardBodyPadding
}

const interactiveClasses: Record<CardInteractive, string> = {
    none: '',
    subtle: 'cursor-pointer transition-shadow hover:border-brand-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-900 focus-visible:ring-offset-2',
    strong: 'cursor-pointer transition-shadow hover:border-brand-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-900 focus-visible:ring-offset-2',
}

const overflowClasses: Record<CardOverflow, string> = {
    visible: 'overflow-visible',
    hidden: 'overflow-hidden',
}

const layoutClasses: Record<CardLayout, string> = {
    column: 'flex flex-col',
    row: 'flex flex-row',
}

const positionClasses: Record<CardPosition, string> = {
    static: 'static',
    relative: 'relative',
}

const paddingClasses: Record<CardBodyPadding, string> = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
}

export function Card({
    className,
    interactive = 'none',
    overflow = 'visible',
    layout = 'column',
    position = 'static',
    ...props
}: CardProps) {
    return (
        <div
            className={cn(
                'rounded-lg border border-gray-200 bg-white shadow-sm',
                interactiveClasses[interactive],
                overflowClasses[overflow],
                layoutClasses[layout],
                positionClasses[position],
                className
            )}
            {...props}
        />
    )
}

export function CardHeader({ className, ...props }: CardHeaderProps) {
    return <div className={cn('flex items-center justify-between', className)} {...props} />
}

export function CardBody({ className, padding = 'md', ...props }: CardBodyProps) {
    return <div className={cn(paddingClasses[padding], className)} {...props} />
}
