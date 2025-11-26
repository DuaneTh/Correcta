import { getAuthSession } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import ResultsView from "./ResultsView"

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
        return <div>Attempt not found</div>
    }

    const isOwner = attempt.studentId === session.user.id
    const isTeacher = session.user.role === 'TEACHER' || session.user.role === 'ADMIN'

    if (!isOwner && !isTeacher) {
        return <div>Unauthorized</div>
    }

    return <ResultsView attemptId={attemptId} />
}
