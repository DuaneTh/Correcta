import { PrismaClient, AttemptStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Creating fresh attempt for override testing...')

    // Find exam
    const exam = await prisma.exam.findFirst({
        where: { title: 'AI Grading Test' },
        include: { sections: { include: { questions: { include: { segments: true } } } } }
    })
    if (!exam) throw new Error('Exam not found')

    // Find student
    const student = await prisma.user.findUnique({
        where: { email: 'student1@demo.edu' }
    })
    if (!student) throw new Error('Student not found')

    // Create new attempt
    const attempt = await prisma.attempt.create({
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
                            content: 'Override test answer'
                        }
                    }
                }
            }
        },
        include: { answers: true }
    })

    console.log(`Created attempt: ${attempt.id}`)
    console.log(`Answer ID: ${attempt.answers[0].id}`)
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
