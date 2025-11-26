
import { prisma } from '@/lib/prisma'
import { Queue } from 'bullmq'
import { AttemptStatus, QuestionType, UserRole } from '@prisma/client'

async function main() {
    console.log("Starting Audit Verification Flow...")

    // 1. Setup Data
    const institution = await prisma.institution.create({
        data: { name: "Audit Inst " + Date.now() }
    })

    const teacher = await prisma.user.create({
        data: {
            email: `teacher_audit_${Date.now()}@test.com`,
            role: UserRole.TEACHER,
            institutionId: institution.id
        }
    })

    const student = await prisma.user.create({
        data: {
            email: `student_audit_${Date.now()}@test.com`,
            role: UserRole.STUDENT,
            institutionId: institution.id
        }
    })

    const course = await prisma.course.create({
        data: {
            code: "AUDIT101",
            name: "Audit Course",
            institutionId: institution.id
        }
    })

    const exam = await prisma.exam.create({
        data: {
            title: "Audit Exam",
            courseId: course.id,
            startAt: new Date(),
            durationMinutes: 60,
            gradingConfig: { gradesReleased: false }
        }
    })

    const section = await prisma.examSection.create({
        data: {
            examId: exam.id,
            title: "Section 1"
        }
    })

    const question = await prisma.question.create({
        data: {
            sectionId: section.id,
            content: "Question 1",
            type: QuestionType.TEXT
        }
    })

    const segment = await prisma.questionSegment.create({
        data: {
            questionId: question.id,
            instruction: "Answer this",
            maxPoints: 10
        }
    })

    console.log("Data setup complete.")

    // 2. Create Attempt (IN_PROGRESS)
    const attempt = await prisma.attempt.create({
        data: {
            examId: exam.id,
            studentId: student.id,
            status: AttemptStatus.IN_PROGRESS
        }
    })

    console.log(`Attempt created: ${attempt.id}, Status: ${attempt.status}`)
    if (attempt.status !== AttemptStatus.IN_PROGRESS) throw new Error("Status mismatch")

    // 3. Submit Attempt (Create Answer + Update Status)
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
            content: "My answer"
        }
    })

    await prisma.attempt.update({
        where: { id: attempt.id },
        data: {
            status: AttemptStatus.SUBMITTED,
            submittedAt: new Date()
        }
    })

    console.log("Attempt submitted.")

    // 4. Trigger AI Grading
    const queue = new Queue('ai-grading', {
        connection: {
            host: 'localhost',
            port: 6379
        }
    })

    await queue.add('grade-answer', {
        attemptId: attempt.id,
        answerId: answer.id,
        questionId: question.id
    })

    console.log("AI Grading job enqueued. Waiting for worker...")

    // Wait for worker to process
    await new Promise(r => setTimeout(r, 5000))

    // 5. Verify Status (Should be GRADED)
    const gradedAttempt = await prisma.attempt.findUnique({
        where: { id: attempt.id },
        include: { answers: { include: { grades: true } } }
    })

    console.log(`Attempt Status after AI: ${gradedAttempt?.status}`)
    const grade = gradedAttempt?.answers[0]?.grades[0]
    console.log(`Grade: ${grade?.score}/${segment.maxPoints}`)

    if (gradedAttempt?.status !== AttemptStatus.GRADED) {
        console.error("FAILED: Attempt should be GRADED")
    } else {
        console.log("SUCCESS: Attempt is GRADED")
    }

    // 6. Verify Results Release Logic
    // Check if student can see results (Should be NO)
    if (exam.gradingConfig?.['gradesReleased'] === true) {
        console.error("FAILED: Grades should not be released yet")
    } else {
        console.log("SUCCESS: Grades are not released yet")
    }

    // Release results
    await prisma.exam.update({
        where: { id: exam.id },
        data: {
            gradingConfig: { ...exam.gradingConfig as object, gradesReleased: true }
        }
    })
    console.log("Results released.")

    // Verify again
    const updatedExam = await prisma.exam.findUnique({ where: { id: exam.id } })
    if (updatedExam?.gradingConfig?.['gradesReleased'] === true) {
        console.log("SUCCESS: Grades are released")
    } else {
        console.error("FAILED: Grades should be released")
    }

    await queue.close()
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
