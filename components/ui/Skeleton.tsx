import { cn } from './cn'

type SkeletonProps = {
    className?: string
    /** Width as Tailwind class, e.g. "w-32" or "w-full" */
    width?: string
    /** Height as Tailwind class, e.g. "h-4" */
    height?: string
}

export function Skeleton({ className, width = 'w-full', height = 'h-4' }: SkeletonProps) {
    return (
        <div
            className={cn('animate-pulse rounded bg-gray-200', width, height, className)}
            role="status"
            aria-label="Loading"
        />
    )
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
    return (
        <div className={cn('space-y-2', className)} role="status" aria-label="Loading">
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    className={cn(
                        'animate-pulse rounded bg-gray-200 h-4',
                        i === lines - 1 ? 'w-2/3' : 'w-full'
                    )}
                />
            ))}
        </div>
    )
}

export function PageSpinner() {
    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-900" />
        </div>
    )
}
