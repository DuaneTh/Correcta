'use client'

import { useState, useEffect } from 'react'
import { Plus, Calendar, Clock, MoreVertical, Trash, Edit } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Exam {
    id: string
    title: string
    startAt: string
    durationMinutes: number
    course: {
        code: string
        name: string
    }
    _count: {
        attempts: number
        sections: number
    }
}

export default function ExamList() {
    const router = useRouter()
    const [exams, setExams] = useState<Exam[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchExams()
    }, [])

    const fetchExams = async () => {
        try {
            const res = await fetch('/api/exams')
            if (res.ok) {
                const data = await res.json()
                setExams(data)
            }
        } catch (error) {
            console.error('Failed to fetch exams', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure? This cannot be undone.')) return

        try {
            const res = await fetch(`/api/exams/${id}`, { method: 'DELETE' })
            if (res.ok) {
                setExams(exams.filter(e => e.id !== id))
            }
        } catch (error) {
            console.error('Failed to delete', error)
        }
    }

    if (loading) return <div className="p-8 text-center text-gray-500">Loading exams...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Exams</h2>
                <button
                    onClick={() => router.push('/dashboard/exams/new')}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    New Exam
                </button>
            </div>

            {exams.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500">No exams found. Create your first one!</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {exams.map((exam) => {
                                const now = new Date()
                                const start = new Date(exam.startAt)
                                const isUpcoming = now < start
                                // Simple status logic based on start time
                                const status = isUpcoming ? 'Upcoming' : 'Active/Past'
                                const statusColor = isUpcoming ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'

                                return (
                                    <tr key={exam.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{exam.title}</div>
                                            <div className="text-xs text-gray-500">{exam._count.sections} Sections</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                {exam.course.code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}`}>
                                                {status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                            <button
                                                onClick={() => router.push(`/dashboard/exams/${exam.id}/builder`)}
                                                className="text-indigo-600 hover:text-indigo-900"
                                            >
                                                Builder
                                            </button>
                                            <Link
                                                href={`/dashboard/exams/${exam.id}/proctoring`}
                                                className="text-purple-600 hover:text-purple-900"
                                            >
                                                Proctoring
                                            </Link>
                                            <Link
                                                href={`/dashboard/exams/${exam.id}/grading`}
                                                className="text-green-600 hover:text-green-900"
                                            >
                                                Grading
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(exam.id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
