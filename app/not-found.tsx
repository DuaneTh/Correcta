import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { getDictionary } from '@/lib/i18n/server'
import Link from 'next/link'

export default async function NotFound() {
    const dict = await getDictionary()
    const t = dict.errors.notFound

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <Card className="max-w-md">
                <CardBody padding="lg">
                    <div className="text-center">
                        <div className="mb-4 text-6xl">🔍</div>
                        <Text variant="sectionTitle" className="mb-2">
                            {t.title}
                        </Text>
                        <Text variant="muted" className="mb-6">
                            {t.description}
                        </Text>
                        <Link href="/">
                            <Button variant="primary">
                                {t.goHome}
                            </Button>
                        </Link>
                    </div>
                </CardBody>
            </Card>
        </div>
    )
}
