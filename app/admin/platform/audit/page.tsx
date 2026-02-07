import { redirect } from 'next/navigation'
import { getAuthSession, isPlatformAdmin } from '@/lib/api-auth'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import PlatformAdminLayout from '@/components/admin/platform/PlatformAdminLayout'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default async function PlatformAuditPage() {
    const session = await getAuthSession()

    if (!session) {
        redirect('/login')
    }

    if (!isPlatformAdmin(session)) {
        redirect('/admin')
    }

    const locale = await getLocale()
    const dictionary = await getDictionary()
    const dict = dictionary.admin.platformAudit

    return (
        <PlatformAdminLayout currentLocale={locale} dictionary={dictionary}>
            <div className="flex flex-col gap-8">
                <div>
                    <h1 className="text-3xl font-bold text-brand-900">{dict.title}</h1>
                    <p className="text-sm text-gray-500">{dict.subtitle}</p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Card>
                        <CardBody>
                            <div className="text-xs uppercase text-gray-500">{dict.cardEvents}</div>
                            <div className="mt-2 text-3xl font-semibold text-gray-900">0</div>
                            <div className="mt-1 text-xs text-gray-500">{dict.cardEventsHint}</div>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardBody>
                            <div className="text-xs uppercase text-gray-500">{dict.cardAdminActions}</div>
                            <div className="mt-2 text-3xl font-semibold text-gray-900">0</div>
                            <div className="mt-1 text-xs text-gray-500">{dict.cardAdminActionsHint}</div>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardBody>
                            <div className="text-xs uppercase text-gray-500">{dict.cardSecuritySignals}</div>
                            <div className="mt-2 text-3xl font-semibold text-gray-900">0</div>
                            <div className="mt-1 text-xs text-gray-500">{dict.cardSecuritySignalsHint}</div>
                        </CardBody>
                    </Card>
                </div>

                <Card>
                    <CardBody padding="none">
                    <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm font-semibold text-gray-900">{dict.recentEvents}</div>
                        <div className="text-xs text-gray-500">{dict.exportHint}</div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">{dict.columnEvent}</th>
                                    <th className="px-4 py-3">{dict.columnActor}</th>
                                    <th className="px-4 py-3">{dict.columnInstitution}</th>
                                    <th className="px-4 py-3">{dict.columnTimestamp}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="px-4 py-6 text-sm text-gray-500" colSpan={4}>
                                        {dict.emptyState}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center justify-end border-t border-gray-200 p-4">
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled
                        >
                            {dict.exportLabel}
                        </Button>
                    </div>
                    </CardBody>
                </Card>
            </div>
        </PlatformAdminLayout>
    )
}
