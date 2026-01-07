import { redirect } from 'next/navigation'

export default function DashboardExamsRedirect() {
    redirect('/teacher/exams')
}
