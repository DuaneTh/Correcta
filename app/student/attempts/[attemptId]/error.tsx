'use client'

import { useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { useRouter } from 'next/navigation'
import { getClientDictionary } from '@/lib/i18n/client'

type ErrorProps = {
    error: Error & { digest?: string }
    reset: () => void
}

export default function AttemptError({ error, reset }: ErrorProps) {
    const router = useRouter()
    const t = useMemo(() => getClientDictionary().errors.attempt, [])

    useEffect(() => {
        console.error('Exam attempt error:', error)
    }, [error])

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <Card className="max-w-md">
                <CardBody padding="lg">
                    <div className="text-center">
                        <div className="mb-4 text-6xl">💾</div>
                        <Text variant="sectionTitle" className="mb-2">
                            {t.title}
                        </Text>
                        <Text variant="muted" className="mb-6">
                            {t.description}
                        </Text>
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                            <Button variant="primary" onClick={reset}>
                                {t.retry}
                            </Button>
                            <Button variant="secondary" onClick={() => router.push('/student/courses')}>
                                {t.goBack}
                            </Button>
                        </div>
                    </div>
                </CardBody>
            </Card>
        </div>
    )
}
