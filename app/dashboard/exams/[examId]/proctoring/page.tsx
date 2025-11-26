import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { isTeacher } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import ProctoringSummary from "./ProctoringSummary"

export const metadata: Metadata = {
    title: "Proctoring / Anti-triche | Correcta",
}

interface ProctoringPageProps {
    params: Promise<{
        examId: string
    }>
}

export default async function ProctoringPage({ params }: ProctoringPageProps) {
    const { examId } = await params
    const authOptions = await buildAuthOptions()
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        redirect("/login")
    }

    if (!isTeacher(session)) {
        redirect("/dashboard")
    }

    const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: {
            course: {
                select: {
                    code: true,
                    name: true,
                    institutionId: true
                }
            }
        }
    })

    if (!exam) {
        notFound()
    }

    // Verify teacher belongs to same institution
    if (exam.course.institutionId !== session.user.institutionId) {
        redirect("/dashboard")
    }

    return <ProctoringSummary examId={examId} examTitle={exam.title} courseCode={exam.course.code} />
}
