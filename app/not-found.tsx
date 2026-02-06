import { cookies } from 'next/headers'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import Link from 'next/link'

export default async function NotFound() {
    // Try to get locale from cookie
    const cookieStore = await cookies()
    const locale = cookieStore.get('locale')?.value || 'fr'
    const isFrench = locale === 'fr'

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <Card className="max-w-md">
                <CardBody padding="lg">
                    <div className="text-center">
                        <div className="mb-4 text-6xl">🔍</div>
                        <Text variant="sectionTitle" className="mb-2">
                            {isFrench ? 'Page non trouvée' : 'Page not found'}
                        </Text>
                        <Text variant="muted" className="mb-6">
                            {isFrench
                                ? "La page que vous recherchez n'existe pas ou a été déplacée."
                                : "The page you're looking for doesn't exist or has been moved."}
                        </Text>
                        <Link href="/">
                            <Button variant="primary">
                                {isFrench ? "Retour à l'accueil" : 'Go Home'}
                            </Button>
                        </Link>
                    </div>
                </CardBody>
            </Card>
        </div>
    )
}
