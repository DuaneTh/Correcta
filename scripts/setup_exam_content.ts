import { PrismaClient, QuestionType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Setting up exam content...')

    // Find the exam
    const exam = await prisma.exam.findFirst({
        where: { title: 'AI Grading Test' }
    })

    if (!exam) {
        console.error('Exam "AI Grading Test" not found. Please create it first or run this script after creation.')
        return
    }

    console.log(`Found exam: ${exam.id}`)

    // Ensure it has a section
    let section = await prisma.examSection.findFirst({
        where: { examId: exam.id }
    })

    if (!section) {
        section = await prisma.examSection.create({
            data: {
                examId: exam.id,
                title: 'Part 1',
                order: 0
            }
        })
        console.log('Created section')
    }

    // Ensure it has a question
    let question = await prisma.question.findFirst({
        where: { sectionId: section.id }
    })

    if (!question) {
        question = await prisma.question.create({
            data: {
                sectionId: section.id,
                content: 'Explain the impact of AI on education.',
                type: QuestionType.TEXT,
                order: 0,
                segments: {
                    create: {
                        instruction: 'Provide a detailed explanation.',
                        maxPoints: 10
                    }
                }
            }
        })
        console.log('Created question')
    }

    // Ensure exam is active
    await prisma.exam.update({
        where: { id: exam.id },
        data: {
            startAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
            endAt: new Date(Date.now() + 3600 * 1000),   // 1 hour from now
            durationMinutes: 60
        }
    })
    console.log('Updated exam timing to be active')
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
