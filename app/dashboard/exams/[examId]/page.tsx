import { prisma } from "@/lib/prisma"
import { getAuthSession } from "@/lib/api-auth"
import ExamEditor from "@/components/exams/ExamEditor"
import { redirect, notFound } from "next/navigation"

export default async function EditExamPage({ params }: { params: Promise<{ examId: string }> }) {
    const { examId } = await params
    const session = await getAuthSession()

    if (!session) {
        redirect('/login')
    }

    const institutionId = session.user?.institutionId
    if (!institutionId) {
        redirect('/dashboard')
    }

    const [exam, courses] = await Promise.all([
        prisma.exam.findUnique({
            where: { id: examId },
            include: { course: true }
        }),
        prisma.course.findMany({
            where: { institutionId },
            select: { id: true, code: true, name: true }
        })
    ])

    if (!exam) {
        notFound()
    }

    if (exam.course.institutionId !== institutionId) {
        redirect('/dashboard/exams')
    }

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            <ExamEditor initialData={exam as any} courses={courses} />
        </div>
    )
}
