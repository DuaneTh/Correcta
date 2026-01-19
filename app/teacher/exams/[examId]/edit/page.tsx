import { getExamForEditor } from '@/lib/actions/exam-editor'
import { redirect } from 'next/navigation'
import ExamEditor from '@/components/exam-editor/ExamEditor'

interface PageProps {
  params: Promise<{ examId: string }>
}

export default async function ExamEditorPage({ params }: PageProps) {
  const { examId } = await params

  try {
    const exam = await getExamForEditor(examId)
    return <ExamEditor initialData={exam} />
  } catch (error) {
    console.error('Failed to load exam for editor:', error)
    redirect('/teacher/exams')
  }
}
