'use client'

import type { Dictionary } from "@/lib/i18n/dictionaries"

interface HeaderLogoutButtonProps {
    onClick: () => void
    dictionary: Dictionary
}

export default function HeaderLogoutButton({ onClick, dictionary }: HeaderLogoutButtonProps) {
    return (
        <button
            onClick={onClick}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
        >
            {dictionary.common.logout}
        </button>
    )
}
