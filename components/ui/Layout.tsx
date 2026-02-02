import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

type StackGap = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

type InlineAlign = 'start' | 'center' | 'end' | 'between'

type InlineWrap = 'nowrap' | 'wrap'

type GridCols = '1' | '2' | '3'

type StackProps = HTMLAttributes<HTMLDivElement> & {
    gap?: StackGap
}

type InlineProps = HTMLAttributes<HTMLDivElement> & {
    gap?: StackGap
    align?: InlineAlign
    wrap?: InlineWrap
}

type GridProps = HTMLAttributes<HTMLDivElement> & {
    cols?: GridCols
    gap?: StackGap
}

type SurfaceTone = 'default' | 'subtle'

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
    tone?: SurfaceTone
}

type ContainerProps = HTMLAttributes<HTMLDivElement> & {
    maxWidth?: 'xl' | '2xl' | '6xl'
}

const gapClasses: Record<StackGap, string> = {
    xs: 'gap-2',
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
}

const inlineAlignClasses: Record<InlineAlign, string> = {
    start: 'items-start justify-start',
    center: 'items-center justify-center',
    end: 'items-end justify-end',
    between: 'items-center justify-between',
}

const inlineWrapClasses: Record<InlineWrap, string> = {
    nowrap: 'flex-nowrap',
    wrap: 'flex-wrap',
}

const gridColsClasses: Record<GridCols, string> = {
    '1': 'grid-cols-1',
    '2': 'grid-cols-1 sm:grid-cols-2',
    '3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
}

const surfaceClasses: Record<SurfaceTone, string> = {
    default: 'rounded-lg border border-gray-200 bg-white',
    subtle: 'rounded-lg border border-gray-200 bg-gray-50',
}

const containerClasses: Record<NonNullable<ContainerProps['maxWidth']>, string> = {
    xl: 'mx-auto max-w-xl',
    '2xl': 'mx-auto max-w-2xl',
    '6xl': 'mx-auto max-w-6xl',
}

export function Stack({ gap = 'md', className, ...props }: StackProps) {
    return <div className={cn('flex flex-col', gapClasses[gap], className)} {...props} />
}

export function Inline({ gap = 'sm', align = 'between', wrap = 'wrap', className, ...props }: InlineProps) {
    return (
        <div
            className={cn('flex', gapClasses[gap], inlineAlignClasses[align], inlineWrapClasses[wrap], className)}
            {...props}
        />
    )
}

export function Grid({ cols = '1', gap = 'md', className, ...props }: GridProps) {
    return <div className={cn('grid', gridColsClasses[cols], gapClasses[gap], className)} {...props} />
}

export function Surface({ tone = 'default', className, ...props }: SurfaceProps) {
    return <div className={cn(surfaceClasses[tone], className)} {...props} />
}

export function Container({ maxWidth = '6xl', className, ...props }: ContainerProps) {
    return <div className={cn(containerClasses[maxWidth], 'px-6', className)} {...props} />
}

export function Spacer({ size = 'md' }: { size?: StackGap }) {
    return <div className={gapClasses[size]} />
}

export function Section({ children }: { children: ReactNode }) {
    return <section>{children}</section>
}
