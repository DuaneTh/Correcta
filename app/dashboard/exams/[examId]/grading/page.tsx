import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import GradingDashboard from "./GradingDashboard"

export default async function GradingPage({
    params
}: {
    params: Promise<{ examId: string }>
}) {
    const { examId } = await params
    const session = await getAuthSession()

    if (!session || !session.user || !isTeacher(session)) {
        redirect("/login")
    }

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

    return <GradingDashboard examId={examId} examTitle={exam.title} />
}
