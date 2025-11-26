import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const attempt = await prisma.attempt.findFirst({
        where: { status: 'SUBMITTED' },
        include: { answers: true }
    })

    if (attempt && attempt.answers.length > 0) {
        console.log(`ATTEMPT_ID=${attempt.id}`)
        console.log(`ANSWER_ID=${attempt.answers[0].id}`)
        console.log(`QUESTION_ID=${attempt.answers[0].questionId}`)
    } else {
        console.log('No submitted attempt with answers found.')
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
