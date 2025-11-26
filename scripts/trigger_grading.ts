import { PrismaClient, AttemptStatus } from '@prisma/client'
import { aiGradingQueue, closeQueue } from '../lib/queue'

const prisma = new PrismaClient()

async function main() {
    console.log('🚀 Triggering AI Grading Job...')

    // 1. Find Exam
    const exam = await prisma.exam.findFirst({
        where: { title: 'AI Grading Test' },
        include: { sections: { include: { questions: { include: { segments: true } } } } }
    })
    if (!exam) throw new Error('Exam not found')

    // 2. Find Student
    const student = await prisma.user.findUnique({
        where: { email: 'student1@demo.edu' }
    })
    if (!student) throw new Error('Student not found')

    // 3. Find or Create Attempt
    let attempt = await prisma.attempt.findFirst({
        where: { examId: exam.id, studentId: student.id },
        include: { answers: true }
    })

    if (!attempt) {
        console.log('Creating new attempt...')
        attempt = await prisma.attempt.create({
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
                                content: 'Manual trigger answer.'
                            }
                        }
                    }
                }
            },
            include: { answers: true }
        })
    } else {
        console.log(`Found attempt ${attempt.id} (Status: ${attempt.status})`)
        // Ensure answer exists
        if (attempt.answers.length === 0) {
            console.log('Adding missing answer...')
            await prisma.answer.create({
                data: {
                    attemptId: attempt.id,
                    questionId: exam.sections[0].questions[0].id,
                    segments: {
                        create: {
                            segmentId: exam.sections[0].questions[0].segments[0].id,
                            content: 'Manual trigger answer (late add).'
                        }
                    }
                }
            })
            // Reload attempt
            attempt = await prisma.attempt.findUniqueOrThrow({
                where: { id: attempt.id },
                include: { answers: true }
            })
        }
    }

    const answer = attempt.answers[0]
    console.log(`Answer ID: ${answer.id}`)

    // 4. Enqueue Job
    if (!aiGradingQueue) {
        throw new Error('Queue not initialized')
    }

    const job = await aiGradingQueue.add('grade-answer', {
        attemptId: attempt.id,
        answerId: answer.id,
        questionId: answer.questionId
    })

    console.log(`✅ Job enqueued: ${job.id}`)
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
