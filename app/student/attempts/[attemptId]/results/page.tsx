import { getAuthSession } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import ResultsView from "./ResultsView"
import { getDictionary } from "@/lib/i18n/server"

export default async function StudentResultsPage({
    params
}: {
    params: Promise<{ attemptId: string }>
}) {
    const { attemptId } = await params
    const session = await getAuthSession()

    if (!session || !session.user) {
        redirect("/login")
    }

    // Verify access
    const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        select: { studentId: true }
    })

    if (!attempt) {
        redirect('/student/exams')
    }

    const isOwner = attempt.studentId === session.user.id
    const isTeacher = session.user.role === 'TEACHER' || session.user.role === 'ADMIN' || session.user.role === 'SCHOOL_ADMIN' || session.user.role === 'PLATFORM_ADMIN'

    if (!isOwner && !isTeacher) {
        redirect('/student/exams')
    }

    const dictionary = await getDictionary()

    return <ResultsView attemptId={attemptId} dictionary={dictionary} />
}
