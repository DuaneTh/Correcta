import { PrismaClient, AttemptStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Checking for attempts...')

    const exam = await prisma.exam.findFirst({
        where: { title: 'AI Grading Test' },
        include: { sections: { include: { questions: { include: { segments: true } } } } }
    })

    if (!exam) {
        console.error('Exam not found')
        return
    }

    const student = await prisma.user.findUnique({
        where: { email: 'student1@demo.edu' }
    })

    if (!student) {
        console.error('Student not found')
        return
    }

    let attempt = await prisma.attempt.findFirst({
        where: {
            examId: exam.id,
            studentId: student.id
        }
    })

    if (attempt) {
        console.log(`Found attempt: ${attempt.id} (Status: ${attempt.status})`)
        if (attempt.status === AttemptStatus.IN_PROGRESS) {
            console.log('Updating attempt to SUBMITTED...')
            await prisma.attempt.update({
                where: { id: attempt.id },
                data: { status: AttemptStatus.SUBMITTED, submittedAt: new Date() }
            })
        }
    } else {
        console.log('No attempt found. Creating one...')
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
                                content: 'This is a script-generated answer for AI grading.'
                            }
                        }
                    }
                }
            }
        })
        console.log(`Created attempt: ${attempt.id}`)
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
