import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request, { params }: { params: Promise<{ examId: string }> }) {
    try {
        const { examId } = await params
        // ... Auth boilerplate (can be refactored later) ...
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions)

        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const groups = await prisma.examSection.findMany({
            where: { examId },
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                    include: {
                        segments: true
                    }
                }
            },
            orderBy: { order: 'asc' }
        })

        return NextResponse.json(groups)
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
