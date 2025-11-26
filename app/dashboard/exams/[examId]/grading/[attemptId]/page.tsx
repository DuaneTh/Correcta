import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import GradingView from "./GradingView"

export default async function AttemptGradingPage({
    params
}: {
    params: Promise<{ examId: string, attemptId: string }>
}) {
    const { examId, attemptId } = await params
    const session = await getAuthSession()

    if (!session || !session.user || !isTeacher(session)) {
        redirect("/login")
    }

    // Verify access
    const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: {
            course: {
                select: { institutionId: true }
            }
        }
    })

    if (!exam) {
        return <div>Exam not found</div>
    }

    if (exam.course.institutionId !== session.user.institutionId) {
        return <div>Unauthorized</div>
    }

    return <GradingView examId={examId} attemptId={attemptId} />
}
