
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { isStudent } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import StartExamButton from "./StartExamButton"

export const metadata: Metadata = {
    title: "Mes Examens | Correcta",
}

export default async function StudentExamsPage() {
    const authOptions = await buildAuthOptions()
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        redirect("/login")
    }

    if (!isStudent(session)) {
        redirect("/dashboard")
    }

    const studentId = session.user.id

    const enrollments = await prisma.enrollment.findMany({
        where: { userId: studentId },
        select: { classId: true }
    })

    const classIds = enrollments.map(e => e.classId)

    const exams = await prisma.exam.findMany({
        where: {
            OR: [
                {
                    course: {
                        classes: {
                            some: {
                                enrollments: {
                                    some: { userId: studentId }
                                }
                            }
                        }
                    }
                },
                {
                    classIds: {
                        hasSome: classIds
                    }
                }
            ]
        },
        include: {
            course: true,
            attempts: {
                where: { studentId: studentId },
                select: {
                    id: true,
                    status: true,
                    startedAt: true,
                    submittedAt: true
                }
            }
        },
        orderBy: {
            startAt: 'desc'
        }
    })

    return (
        <div className="container mx-auto py-8 px-4">
            <h1 className="text-3xl font-bold mb-8">Mes Examens</h1>

            <div className="grid gap-6">
                {exams.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-gray-500">Aucun examen disponible pour le moment.</p>
                    </div>
                ) : (
                    exams.map((exam) => {
                        const attempt = exam.attempts[0]
                        const now = new Date()
                        const startAt = new Date(exam.startAt)
                        const endAt = exam.endAt ? new Date(exam.endAt) : null

                        const isStarted = !!attempt
                        const isSubmitted = attempt?.status === 'SUBMITTED' || attempt?.status === 'GRADED' || attempt?.status === 'GRADING_IN_PROGRESS'
                        const isBeforeStart = now < startAt
                        const isAfterEnd = endAt && now > endAt
                        const isWithinWindow = !isBeforeStart && !isAfterEnd

                        let statusLabel = "Non démarré"
                        let statusColor = "bg-gray-100 text-gray-800"
                        let actionButton = null

                        if (isBeforeStart) {
                            statusLabel = "À venir"
                            statusColor = "bg-yellow-100 text-yellow-800"
                            actionButton = (
                                <button disabled className="px-4 py-2 bg-gray-300 text-gray-700 rounded cursor-not-allowed">
                                    Pas encore disponible
                                </button>
                            )
                        } else if (isSubmitted) {
                            statusLabel = "Soumis"
                            statusColor = "bg-green-100 text-green-800"
                            actionButton = (
                                <div className="flex flex-col gap-2">
                                    <button disabled className="px-4 py-2 bg-gray-300 text-gray-700 rounded cursor-not-allowed">
                                        Examen soumis
                                    </button>
                                    <Link
                                        href={`/student/attempts/${attempt.id}/results`}
                                        className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                        Voir la copie corrigée
                                    </Link>
                                </div>
                            )
                        } else if (isAfterEnd) {
                            statusLabel = "Expiré"
                            statusColor = "bg-red-100 text-red-800"
                            actionButton = (
                                <button disabled className="px-4 py-2 bg-gray-300 text-gray-700 rounded cursor-not-allowed">
                                    Examen expiré
                                </button>
                            )
                        } else if (isStarted && isWithinWindow) {
                            statusLabel = "En cours"
                            statusColor = "bg-blue-100 text-blue-800"
                            actionButton = (
                                <StartExamButton examId={exam.id} label="Reprendre" />
                            )
                        } else if (isWithinWindow) {
                            statusLabel = "Disponible"
                            statusColor = "bg-green-100 text-green-800"
                            actionButton = (
                                <StartExamButton examId={exam.id} label="Commencer" />
                            )
                        } else {
                            actionButton = (
                                <button disabled className="px-4 py-2 bg-gray-300 text-gray-700 rounded cursor-not-allowed">
                                    Non disponible
                                </button>
                            )
                        }

                        return (
                            <div key={exam.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded ${statusColor}`}>
                                            {statusLabel}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {exam.course.code} - {exam.course.name}
                                        </span>
                                    </div>
                                    <h2 className="text-xl font-semibold mb-2">{exam.title}</h2>
                                    <div className="text-sm text-gray-600 space-y-1">
                                        <p>Durée : {exam.durationMinutes} minutes</p>
                                        <p>Début : {new Date(exam.startAt).toLocaleString()}</p>
                                        {exam.endAt && <p>Fin : {new Date(exam.endAt).toLocaleString()}</p>}
                                    </div>
                                </div>
                                <div>
                                    {actionButton}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
