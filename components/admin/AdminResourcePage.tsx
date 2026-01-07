import { ReactNode } from 'react'

type AdminResourcePageProps = {
    header: ReactNode
    listId: string
    listContent: ReactNode
    panels?: ReactNode
}

export default function AdminResourcePage({
    header,
    listId,
    listContent,
    panels,
}: AdminResourcePageProps) {
    return (
        <div>
            {header}
            <div id={listId} tabIndex={-1} className="scroll-mt-24 space-y-4">
                {listContent}
            </div>
            {panels}
        </div>
    )
}
