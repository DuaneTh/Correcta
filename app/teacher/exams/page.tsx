import { redirect } from "next/navigation"
import { getAuthSession, isTeacher } from "@/lib/api-auth"
import ExamList from "@/components/exams/ExamList"
import { getDictionary } from "@/lib/i18n/server"

export default async function TeacherExamsPage() {
    const session = await getAuthSession()

    if (!session || !session.user) {
        redirect('/login')
    }

    if (!isTeacher(session)) {
        redirect('/student/courses')
    }

    const dictionary = await getDictionary()

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <ExamList dictionary={dictionary} />
        </div>
    )
}
