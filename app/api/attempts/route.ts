import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isStudent } from "@/lib/api-auth"

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
                            include: {
                                enrollments: {
                                    where: { userId: session.user.id }
                                }
                            }
                        }
                    }
                }
            }
        })

        if (!exam) {
            return NextResponse.json({ error: "Exam not found" }, { status: 404 })
        }

        // Check if student is enrolled in any class for this course
        const hasAccess = exam.course.classes.some(
            (cls) => cls.enrollments.length > 0
        )

        if (!hasAccess) {
            return NextResponse.json({ error: "You are not enrolled in this exam" }, { status: 403 })
        }

        // Check if exam is available
        const now = new Date()
        if (now < exam.startAt) {
            return NextResponse.json({ error: "Exam has not started yet" }, { status: 400 })
        }

        if (exam.endAt && now > exam.endAt) {
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
