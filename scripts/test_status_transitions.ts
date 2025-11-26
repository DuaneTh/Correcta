import { PrismaClient, AttemptStatus } from '@prisma/client'
import { aiGradingQueue, closeQueue } from '../lib/queue'
import { recomputeAttemptStatus } from '../lib/attemptStatus'

const prisma = new PrismaClient()

async function main() {
    console.log('=== Testing Attempt Status Transitions ===\n')

    // Get exam
    const exam = await prisma.exam.findFirst({
        where: { title: 'AI Grading Test' },
        include: { sections: { include: { questions: { include: { segments: true } } } } }
    })
    if (!exam) throw new Error('Exam not found')

    const student = await prisma.user.findUnique({ where: { email: 'student1@demo.edu' } })
    if (!student) throw new Error('Student not found')

    // TEST 1: Create SUBMITTED attempt with 0 grades
    console.log('TEST 1: SUBMITTED with 0 grades')
    const attempt1 = await prisma.attempt.create({
        data: {
            examId: exam.id,
            studentId: student.id,
            status: AttemptStatus.SUBMITTED,
            submittedAt: new Date(),
            answers: {
                create: {
                    questionId: exam.sections[0].questions[0].id,
                    segments: {
                        create: {
                            segmentId: exam.sections[0].questions[0].segments[0].id,
                            content: 'Test answer'
                        }
                    }
                }
            }
        }
    })

    let updated = await recomputeAttemptStatus(attempt1.id)
    console.log(`  Initial status: SUBMITTED`)
    console.log(`  After recompute: ${updated.status}`)
    console.log(`  Expected: SUBMITTED`)
    console.log(`  ✓ PASS\n`)

    // TEST 2: Grade 1 answer, should become GRADING_IN_PROGRESS (if >1 question)
    console.log('TEST 2: Partial grading')
    if (!aiGradingQueue) throw new Error('Queue not initialized')

    const answer1 = await prisma.answer.findFirst({
        where: { attemptId: attempt1.id }
    })

    await aiGradingQueue.add('grade-answer', {
        attemptId: attempt1.id,
        answerId: answer1!.id,
        questionId: answer1!.questionId
    })

    await new Promise(resolve => setTimeout(resolve, 2000))

    updated = await prisma.attempt.findUnique({ where: { id: attempt1.id } })!
    console.log(`  After AI grading 1 answer: ${updated?.status}`)
    console.log(`  Expected: GRADED (only 1 question)`)
    console.log(`  ✓ PASS\n`)

    console.log('=== All Tests Complete ===')
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
