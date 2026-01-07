import ExamList from "@/components/exams/ExamList"
import { getDictionary } from "@/lib/i18n/server"

export default async function TeacherExamsPage() {
    const dictionary = await getDictionary()

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <ExamList dictionary={dictionary} />
        </div>
    )
}
