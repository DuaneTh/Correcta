import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const exam = await prisma.exam.findFirst({
        where: { title: 'AI Grading Test' }
    })

    if (!exam) return

    const attempt = await prisma.attempt.findFirst({
        where: { examId: exam.id },
        orderBy: { startedAt: 'desc' }
    })

    if (attempt) {
        console.log(`ATTEMPT_ID=${attempt.id}`)
        console.log(`EXAM_ID=${exam.id}`)
    }
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
