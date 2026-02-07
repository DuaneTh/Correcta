'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect, useMemo } from 'react'
import { getClientDictionary } from '@/lib/i18n/client'

export default function GlobalError({
    error,
}: {
    error: Error & { digest?: string }
}) {
    const t = useMemo(() => getClientDictionary().errors.global, [])

    useEffect(() => {
        Sentry.captureException(error)
    }, [error])

    return (
        <html>
            <body>
                <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
                    <div className="max-w-md text-center">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            {t.title}
                        </h2>
                        <p className="text-gray-600 mb-6">
                            {t.description}
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                        >
                            {t.refresh}
                        </button>
                    </div>
                </div>
            </body>
        </html>
    )
}
