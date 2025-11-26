import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request, { params }: { params: Promise<{ examId: string }> }) {
    try {
        const { examId } = await params
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions)

        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get complete exam structure with sections, questions, segments, and rubrics
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                course: true,
                sections: {
                    include: {
                        questions: {
                            include: {
                                segments: {
                                    include: {
                                        rubric: true
                                    }
                                }
                            },
                            orderBy: { order: 'asc' }
                        }
                    },
                    orderBy: { order: 'asc' }
                }
            }
        })

        if (!exam) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        // Authorization check
        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        return NextResponse.json(exam)
    } catch (error) {
        console.error("[API] Get Full Exam Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
