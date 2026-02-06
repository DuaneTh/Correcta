'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { useRouter } from 'next/navigation'

type ErrorProps = {
    error: Error & { digest?: string }
    reset: () => void
}

export default function AdminError({ error, reset }: ErrorProps) {
    const router = useRouter()

    useEffect(() => {
        console.error('Admin section error:', error)
    }, [error])

    const isFrench = true // Default to French

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <Card className="max-w-md">
                <CardBody padding="lg">
                    <div className="text-center">
                        <div className="mb-4 text-6xl">⚠️</div>
                        <Text variant="sectionTitle" className="mb-2">
                            {isFrench ? 'Une erreur est survenue' : 'An error occurred'}
                        </Text>
                        <Text variant="muted" className="mb-6">
                            {isFrench
                                ? 'Veuillez réessayer ou retourner au tableau de bord'
                                : 'Please try again or go back to the dashboard'}
                        </Text>
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                            <Button variant="primary" onClick={reset}>
                                {isFrench ? 'Réessayer' : 'Try Again'}
                            </Button>
                            <Button variant="secondary" onClick={() => router.push('/admin/school')}>
                                {isFrench ? 'Tableau de bord' : 'Dashboard'}
                            </Button>
                        </div>
                    </div>
                </CardBody>
            </Card>
        </div>
    )
}
