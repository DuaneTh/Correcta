import { Search, Plus, Download } from 'lucide-react'
import { clsx } from 'clsx'

type AdminResourceHeaderProps = {
    title: string
    count: number
    searchValue: string
    onSearchChange: (value: string) => void
    showArchived: boolean
    onShowArchivedChange: (value: boolean) => void
    labels: {
        searchPlaceholder: string
        showArchived: string
        addButton: string
        importButton?: string
        exportButton?: string
    }
    onToggleAdd: () => void
    onToggleImport?: () => void
    onExport?: () => void
    isAddOpen: boolean
    isImportOpen?: boolean
}

export default function AdminResourceHeader({
    title,
    count,
    searchValue,
    onSearchChange,
    showArchived,
    onShowArchivedChange,
    labels,
    onToggleAdd,
    onToggleImport,
    onExport,
    isAddOpen,
    isImportOpen,
}: AdminResourceHeaderProps) {
    return (
        <div className="mb-6 flex flex-col gap-4 border-b border-gray-200 pb-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-baseline gap-3">
                    <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        {count}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {onExport && (
                        <button
                            type="button"
                            onClick={onExport}
                            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                        >
                            <Download className="h-4 w-4 text-gray-500" />
                            <span className="hidden sm:inline">{labels.exportButton}</span>
                        </button>
                    )}
                    {onToggleImport && (
                        <button
                            type="button"
                            onClick={onToggleImport}
                            aria-expanded={isImportOpen}
                            className={clsx(
                                "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
                                isImportOpen
                                    ? "border-brand-600 bg-brand-50 text-brand-700"
                                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                            )}
                        >
                            <Download className={clsx("h-4 w-4", isImportOpen ? "text-brand-600" : "text-gray-500")} />
                            <span className="hidden sm:inline">{labels.importButton}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onToggleAdd}
                        aria-expanded={isAddOpen}
                        className={clsx(
                            "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
                            isAddOpen
                                ? "border-brand-600 bg-brand-50 text-brand-700"
                                : "border-transparent bg-brand-900 text-white hover:bg-brand-800"
                        )}
                    >
                        <Plus className={clsx("h-4 w-4", isAddOpen ? "text-brand-600" : "text-white")} />
                        <span>{labels.addButton}</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                        type="text"
                        value={searchValue}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={labels.searchPlaceholder}
                        className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm sm:leading-6"
                    />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600 select-none cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showArchived}
                        onChange={(e) => onShowArchivedChange(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-600"
                    />
                    {labels.showArchived}
                </label>
            </div>
        </div>
    )
}