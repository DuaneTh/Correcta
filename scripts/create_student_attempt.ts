
import { prisma } from '@/lib/prisma'
import { AttemptStatus } from '@prisma/client'

async function main() {
    console.log("Creating Student Attempt...")

    const exam = await prisma.exam.findFirst({
        where: { title: "Audit Exam UI 2" },
        include: { sections: { include: { questions: { include: { segments: true } } } } }
    })

    if (!exam) {
        console.error("Exam 'Audit Exam UI 2' not found")
        return
    }

    const student = await prisma.user.findUnique({
        where: { email: "student1@demo.edu" }
    })

    if (!student) {
        console.error("Student 'student1@demo.edu' not found")
        return
    }

    // Check if attempt exists
    let attempt = await prisma.attempt.findFirst({
        where: { examId: exam.id, studentId: student.id }
    })

    if (!attempt) {
        console.log("Creating new attempt...")
        attempt = await prisma.attempt.create({
            data: {
                examId: exam.id,
                studentId: student.id,
                status: AttemptStatus.IN_PROGRESS,
                startedAt: new Date()
            }
        })
    }

    // Create answer
    const question = exam.sections[0]?.questions[0]
    const segment = question?.segments[0]

    if (question && segment) {
        console.log("Creating answer...")
        const answer = await prisma.answer.create({
            data: {
                attemptId: attempt.id,
                questionId: question.id
            }
        })

        await prisma.answerSegment.create({
            data: {
                answerId: answer.id,
                segmentId: segment.id,
                content: "4"
            }
        })
    }

    // Submit attempt
    console.log("Submitting attempt...")
    await prisma.attempt.update({
        where: { id: attempt.id },
        data: {
            status: AttemptStatus.SUBMITTED,
            submittedAt: new Date()
        }
    })

    console.log("Attempt submitted successfully.")
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
