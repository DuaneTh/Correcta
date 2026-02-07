import { Button } from './Button'
import { Text } from './Text'
import { Inline } from './Layout'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type PaginationProps = {
    /** Current page (1-based) */
    page: number
    /** Total number of items */
    total: number
    /** Items per page */
    pageSize: number
    /** Called when the page changes */
    onPageChange: (page: number) => void
    /** Optional className for the wrapper */
    className?: string
}

export function Pagination({ page, total, pageSize, onPageChange, className }: PaginationProps) {
    const totalPages = Math.ceil(total / pageSize)

    if (totalPages <= 1) return null

    return (
        <Inline align="center" gap="sm" className={className}>
            <Button
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page <= 1}
                variant="secondary"
                size="xs"
                aria-label="Page precedente"
            >
                <ChevronLeft className="w-4 h-4" />
            </Button>

            <Text variant="muted" as="span">
                {page} / {totalPages}
            </Text>

            <Button
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                variant="secondary"
                size="xs"
                aria-label="Page suivante"
            >
                <ChevronRight className="w-4 h-4" />
            </Button>
        </Inline>
    )
}
