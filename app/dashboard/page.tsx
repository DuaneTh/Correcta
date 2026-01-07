import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
    const session = await getServerSession(await buildAuthOptions())

    if (!session) {
        redirect('/login')
    }

    redirect('/auth/redirect')
}
