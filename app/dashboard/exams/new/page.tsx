import { prisma } from "@/lib/prisma"
import { getAuthSession } from "@/lib/api-auth"
import NewExamPageClient from "@/components/exams/NewExamPageClient"
import { redirect } from "next/navigation"
import { getDictionary } from "@/lib/i18n/server"

export default async function NewExamPage() {
    const session = await getAuthSession()

    if (!session) {
        redirect('/login')
    }

    const institutionId = session.user?.institutionId
    if (!institutionId) {
        redirect('/dashboard')
    }

    const courses = await prisma.course.findMany({
        where: { institutionId },
        select: { id: true, code: true, name: true }
    })

    const dict = await getDictionary()

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            <NewExamPageClient courses={courses} dict={dict} />
        </div>
    )
}
