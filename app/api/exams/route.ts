import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
    try {
        // 1. Get Session
        // Note: We need to handle the institutionId cookie if we want to be strict, 
        // but for now we can rely on the session if it's already established.
        // However, buildAuthOptions needs institutionId to verify signature if using custom providers.
        // Let's try to get it from cookie or header if possible, or just use default.
        // Actually, for API routes, we should probably trust the session token.

        // Extract institutionId from cookie for buildAuthOptions
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions)

        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // 2. Fetch Exams
        // Filter by institution and author if teacher
        const whereClause: any = {
            course: {
                institutionId: session.user.institutionId
            }
        }

        if (session.user.role === 'TEACHER') {
            whereClause.authorId = session.user.id
        }

        const exams = await prisma.exam.findMany({
            where: whereClause,
            include: {
                course: {
                    select: { code: true, name: true }
                },
                _count: {
                    select: { attempts: true, sections: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json(exams)
    } catch (error) {
        console.error("[API] Get Exams Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions)

        if (!session || !session.user || session.user.role === 'STUDENT') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const { title, courseId, startAt, durationMinutes } = body

        if (!title || !courseId || !startAt || !durationMinutes) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // Verify course belongs to user's institution
        const course = await prisma.course.findUnique({
            where: { id: courseId }
        })

        if (!course || course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Invalid course" }, { status: 400 })
        }

        const exam = await prisma.exam.create({
            data: {
                title,
                courseId,
                startAt: new Date(startAt),
                durationMinutes: parseInt(durationMinutes),
                authorId: session.user.id,
                antiCheatConfig: { webcam: false, screen: false }, // Defaults
            }
        })

        return NextResponse.json(exam)

    } catch (error) {
        console.error("[API] Create Exam Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
