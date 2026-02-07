import { ReactNode } from 'react'
import { Card, CardBody } from '@/components/ui/Card'

type AdminActionPanelsProps = {
    isAddOpen: boolean
    isImportOpen: boolean
    addPanelContent: ReactNode
    importPanelContent?: ReactNode
}

export default function AdminActionPanels({
    isAddOpen,
    isImportOpen,
    addPanelContent,
    importPanelContent
}: AdminActionPanelsProps) {
    if (!isAddOpen && !isImportOpen) return null

    return (
        <div className="mb-6 space-y-4">
            {isAddOpen && (
                <Card
                    overflow="hidden"
                    className="ring-1 ring-black/5"
                    role="region"
                    aria-label="Ajouter un élément"
                >
                    <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-900">Ajouter un élément</h3>
                    </div>
                    <CardBody padding="lg">
                        {addPanelContent}
                    </CardBody>
                </Card>
            )}

            {isImportOpen && importPanelContent && (
                <Card
                    overflow="hidden"
                    className="ring-1 ring-black/5"
                    role="region"
                    aria-label="Import en masse"
                >
                    <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-900">Import en masse</h3>
                    </div>
                    <CardBody padding="lg">
                        {importPanelContent}
                    </CardBody>
                </Card>
            )}
        </div>
    )
}