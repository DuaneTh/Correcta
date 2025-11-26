import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Checking for grades...')
    const grades = await prisma.grade.findMany({
        include: { answer: { include: { attempt: true } } }
    })
    console.log(`Found ${grades.length} grades.`)
    grades.forEach(g => {
        console.log(`Grade: ${g.score} (Answer: ${g.answerId}, Attempt: ${g.answer.attemptId})`)
        console.log(`Feedback: ${g.feedback}`)
    })
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
