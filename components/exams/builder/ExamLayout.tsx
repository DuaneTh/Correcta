import { ReactNode, useRef } from 'react'
import { useColumnHeightSync } from '@/components/exams/hooks/useColumnHeightSync'

interface ExamLayoutProps {
    left: ReactNode
    right?: ReactNode
}

export function ExamLayout({ left, right }: ExamLayoutProps) {
    const leftRef = useRef<HTMLDivElement>(null)
    const rightRef = useRef<HTMLDivElement>(null)
    const separatorRef = useRef<HTMLDivElement>(null)
    const hasRight = Boolean(right)

    useColumnHeightSync(separatorRef, leftRef, rightRef)

    return (
        <div className={`grid grid-cols-1 gap-y-6 relative ${hasRight ? 'lg:grid-cols-2 lg:gap-x-0' : ''}`}>
            {hasRight && (
                <div
                    ref={separatorRef}
                    className="hidden lg:block absolute left-1/2 top-0 w-px bg-gray-300 transform -translate-x-1/2 min-h-[200px]"
                />
            )}
            <div ref={leftRef} className={hasRight ? 'lg:pr-6' : ''}>
                {left}
            </div>
            {hasRight && (
                <div ref={rightRef} className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pl-6">
                    {right}
                </div>
            )}
        </div>
    )
}

