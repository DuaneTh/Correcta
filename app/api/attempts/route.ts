import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isStudent } from "@/lib/api-auth"
import { getExamEndAt } from "@/lib/exam-time"
import { assertExamVariantShape, examAppliesToClassIds } from "@/lib/exam-variants"

// POST /api/attempts - Start a new exam attempt
export async function POST(req: NextRequest) {
    try {
        const session = await getAuthSession(req)

        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        if (!isStudent(session)) {
            return NextResponse.json({ error: "Only students can start attempts" }, { status: 403 })
        }

        const body = await req.json()
        const { examId } = body

        if (!examId) {
            return NextResponse.json({ error: "Missing examId" }, { status: 400 })
        }

        // Verify exam exists and student has access
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                course: {
                    include: {
                        classes: {
                            where: { archivedAt: null },
                            include: {
                                enrollments: {
                                    where: { userId: session.user.id, user: { archivedAt: null } }
                                }
                            }
                        }
                    }
                }
            }
        })

        if (!exam || exam.archivedAt || exam.course.archivedAt) {
            return NextResponse.json({ error: "Exam not found" }, { status: 404 })
        }

        assertExamVariantShape(exam, { context: 'attempts-post' })

        // Students should not access DRAFT exams or exams without valid duration/start date
        const hasValidDuration = exam.durationMinutes !== null && exam.durationMinutes > 0
        const hasValidStartDate = exam.startAt !== null && exam.startAt > new Date('2000-01-01')
        if (exam.status === 'DRAFT' || !hasValidDuration || !hasValidStartDate) {
            return NextResponse.json({ error: "Exam not found" }, { status: 404 })
        }

        const enrolledClassIds = exam.course.classes
            .filter((cls) => cls.enrollments.length > 0)
            .map((cls) => cls.id)
        const hasAccess = enrolledClassIds.length > 0

        if (!hasAccess) {
            return NextResponse.json({ error: "You are not enrolled in this exam" }, { status: 403 })
        }

        if (exam.parentExamId == null && exam.classId == null) {
            if (!examAppliesToClassIds(exam, enrolledClassIds)) {
                return NextResponse.json({ error: "Exam not found" }, { status: 404 })
            }
        } else if (exam.classId && !enrolledClassIds.includes(exam.classId)) {
            return NextResponse.json({ error: "Exam not found" }, { status: 404 })
        }

        // Check if exam is available
        const now = new Date()
        if (exam.startAt && now < exam.startAt) {
            return NextResponse.json({ error: "Exam has not started yet" }, { status: 400 })
        }

        const examEndAt = getExamEndAt(exam.startAt, exam.durationMinutes, exam.endAt)
        if (examEndAt && now > examEndAt) {
            return NextResponse.json({ error: "Exam has ended" }, { status: 400 })
        }

        // Check if student already has an attempt
        const existingAttempt = await prisma.attempt.findFirst({
            where: {
                examId,
                studentId: session.user.id
            }
        })

        if (existingAttempt) {
            // Return existing attempt if not submitted
            if (existingAttempt.status === 'IN_PROGRESS') {
                return NextResponse.json(existingAttempt)
            }
            return NextResponse.json({ error: "You have already completed this exam" }, { status: 400 })
        }

        // Create new attempt
        const attempt = await prisma.attempt.create({
            data: {
                examId,
                studentId: session.user.id,
                status: 'IN_PROGRESS',
                startedAt: new Date()
            },
            include: {
                exam: {
                    include: {
                        sections: {
                            include: {
                                questions: {
                                    include: {
                                        segments: true
                                    },
                                    orderBy: { order: 'asc' }
                                }
                            },
                            orderBy: { order: 'asc' }
                        }
                    }
                }
            }
        })

        return NextResponse.json(attempt)

    } catch (error) {
        console.error("[API] Create Attempt Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
