import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { getExamEndAt } from "@/lib/exam-time"

// GET /api/exams/[examId]/anti-cheat-report - Download CSV report of anti-cheat data
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { examId } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Fetch exam to verify access
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                course: {
                    select: { institutionId: true, archivedAt: true }
                }
            }
        })

        if (!exam) {
            return NextResponse.json({ error: "Exam not found" }, { status: 404 })
        }

        // Verify teacher belongs to same institution
        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // Fetch all attempts for this exam with proctor events
        const attempts = await prisma.attempt.findMany({
            where: { examId },
            include: {
                student: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                proctorEvents: {
                    select: {
                        type: true
                    }
                }
            },
            orderBy: {
                startedAt: 'desc'
            }
        })

        // Calculate anti-cheat scores and prepare data
        const reportData = attempts.map(attempt => {
            const eventCounts: Record<string, number> = {
                FOCUS_LOST: 0,
                TAB_SWITCH: 0,
                COPY: 0,
                PASTE: 0
            }

            // Count events by type
            attempt.proctorEvents.forEach(event => {
                if (eventCounts.hasOwnProperty(event.type)) {
                    eventCounts[event.type]++
                } else {
                    eventCounts[event.type] = 1
                }
            })

            // Calculate antiCheatScore with weighted formula
            const antiCheatScore =
                (eventCounts.FOCUS_LOST || 0) * 2 +
                (eventCounts.TAB_SWITCH || 0) * 3 +
                (eventCounts.COPY || 0) * 1 +
                (eventCounts.PASTE || 0) * 1

            // Determine status
            const now = new Date()
            const examEndAt = getExamEndAt(exam.startAt, exam.durationMinutes, exam.endAt)
            const deadlineAt = examEndAt ?? new Date(attempt.startedAt.getTime() + (exam.durationMinutes || 60) * 60 * 1000)
            let attemptStatus: string
            if (attempt.submittedAt) {
                attemptStatus = 'submitted'
            } else if (now > deadlineAt) {
                attemptStatus = 'expired'
            } else {
                attemptStatus = 'in_progress'
            }

            return {
                attemptId: attempt.id,
                studentName: attempt.student.name || '',
                studentEmail: attempt.student.email,
                status: attemptStatus,
                antiCheatScore,
                FOCUS_LOST: eventCounts.FOCUS_LOST || 0,
                TAB_SWITCH: eventCounts.TAB_SWITCH || 0,
                COPY: eventCounts.COPY || 0,
                PASTE: eventCounts.PASTE || 0,
                totalEvents: attempt.proctorEvents.length
            }
        })

        // Generate CSV
        const headers = [
            'attemptId',
            'studentName',
            'studentEmail',
            'status',
            'antiCheatScore',
            'FOCUS_LOST',
            'TAB_SWITCH',
            'COPY',
            'PASTE',
            'totalEvents'
        ]

        const csvRows = [
            headers.join(','),
            ...reportData.map(row => [
                row.attemptId,
                `"${row.studentName.replace(/"/g, '""')}"`, // Escape quotes in names
                row.studentEmail,
                row.status,
                row.antiCheatScore,
                row.FOCUS_LOST,
                row.TAB_SWITCH,
                row.COPY,
                row.PASTE,
                row.totalEvents
            ].join(','))
        ]

        const csv = csvRows.join('\n')

        // Return CSV with download header
        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="anti-cheat-report-${examId}.csv"`
            }
        })

    } catch (error) {
        console.error("[API] Anti-Cheat Report Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
