import { aiGradingQueue, closeQueue } from '../lib/queue'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Triggering AI grading for test attempt...')

    const answerId = '044ac9cc-1e06-41ff-a17b-782cd259f99d'
    const attemptId = '0023f5da-31b2-4455-bbfe-bf76070d11b1'

    // Get question ID
    const answer = await prisma.answer.findUnique({
        where: { id: answerId },
        select: { questionId: true }
    })

    if (!answer) throw new Error('Answer not found')

    if (!aiGradingQueue) throw new Error('Queue not initialized')

    const job = await aiGradingQueue.add('grade-answer', {
        attemptId,
        answerId,
        questionId: answer.questionId
    })

    console.log(`Job enqueued: ${job.id}`)
    console.log('Waiting 5 seconds for worker to process...')

    await new Promise(resolve => setTimeout(resolve, 5000))

    // Check if grade was created
    const grade = await prisma.grade.findUnique({
        where: { answerId }
    })

    if (grade) {
        console.log('Grade created by AI:')
        console.log(`  Score: ${grade.score}`)
        console.log(`  Feedback: ${grade.feedback}`)
        console.log(`  gradedByUserId: ${grade.gradedByUserId}`)
        console.log(`  isOverridden: ${grade.isOverridden}`)
    } else {
        console.log('Grade not yet created')
    }
}

main()
    .then(async () => {
        await prisma.$disconnect()
        await closeQueue()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        await closeQueue()
        process.exit(1)
    })
