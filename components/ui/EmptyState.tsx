import type { ReactNode } from 'react'
import { cn } from './cn'

type EmptyStateSize = 'compact' | 'full'

type EmptyStateProps = {
    title: string
    description: string
    action?: ReactNode
    size?: EmptyStateSize
}

const sizeClasses: Record<EmptyStateSize, string> = {
    compact: 'rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600',
    full: 'rounded-lg border border-gray-200 bg-white px-6 py-12 text-center',
}

export function EmptyState({ title, description, action, size = 'compact' }: EmptyStateProps) {
    if (size === 'compact') {
        return (
            <div className={sizeClasses.compact}>
                <div className="font-semibold text-gray-700">{title}</div>
                <div className="mt-1 text-gray-500">{description}</div>
                {action ? <div className="mt-2">{action}</div> : null}
            </div>
        )
    }

    return (
        <div className={cn(sizeClasses.full)}>
            <div className="text-sm font-semibold text-gray-700">{title}</div>
            <div className="mt-2 text-sm text-gray-500">{description}</div>
            {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
        </div>
    )
}
