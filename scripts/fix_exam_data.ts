
import { prisma } from '@/lib/prisma'

async function main() {
    console.log("Fixing Exam Data...")

    const exam = await prisma.exam.findFirst({
        where: { title: "Audit Exam UI 2" },
        include: { sections: { include: { questions: { include: { segments: true } } } } }
    })

    if (!exam) {
        console.error("Exam 'Audit Exam UI 2' not found")
        return
    }

    const question = exam.sections[0]?.questions[0]
    if (!question) {
        console.error("Question not found")
        return
    }

    if (question.segments.length === 0) {
        console.log("Adding segment to question...")
        await prisma.questionSegment.create({
            data: {
                questionId: question.id,
                instruction: "Answer this question",
                maxPoints: 10
            }
        })
        console.log("Segment added.")
    } else {
        console.log("Segment already exists.")
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
