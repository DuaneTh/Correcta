import { redirect } from 'next/navigation'

export default async function InstitutionIndexPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    redirect(`/admin/platform/institutions/${id}/dashboard`)
}
