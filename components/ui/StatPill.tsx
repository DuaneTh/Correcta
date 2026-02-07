import type { ReactNode } from 'react'

type StatPillProps = {
    count: number
    label: string
}

export function StatPill({ count, label }: StatPillProps) {
    return (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600">
            <span className="font-semibold text-gray-700">{count}</span> {label}
        </div>
    )
}
