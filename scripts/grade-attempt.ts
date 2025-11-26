import { prisma } from "../lib/prisma"

async function main() {
    const attemptId = "e7943546-7e46-44cf-bc3f-5ac82168f6df"

    // Get attempt with answers
    const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
            answers: {
                include: {
                    question: true,
                    segments: {
                        include: {
                            segment: true
                        }
                    }
                }
            }
        }
    })

    if (!attempt) {
        console.log("❌ Attempt not found")
        return
    }

    console.log(`✅ Attempt: ${attempt.id}`)
    console.log(`  Status: ${attempt.status}`)
    console.log(`  Answers: ${attempt.answers.length}`)

    if (attempt.answers.length === 0) {
        console.log("  ⚠️ No answers found to grade")
        return
    }

    // Grade the first answer
    const answer = attempt.answers[0]
    console.log(`\n  Grading answer for question: ${answer.questionId}`)

    // Check if already graded
    const existingGrade = await prisma.grade.findUnique({
        where: { answerId: answer.id }
    })

    if (existingGrade) {
        console.log(`  ⚠️ Grade already exists: ${existingGrade.score}`)
        console.log(`  Feedback: ${existingGrade.feedback || "None"}`)
        return
    }

    // Create grade
    const grade = await prisma.grade.create({
        data: {
            answerId: answer.id,
            score: 9,
            feedback: "Très bien !",
            gradedByUserId: "teacher1-id-placeholder" // In real scenario, this would be the actual teacher ID
        }
    })

    console.log(`  ✅ Created grade: ${grade.score} points`)
    console.log(`  Feedback: "${grade.feedback}"`)

    // Note: The recomputeAttemptStatus function should be called by the API
    // For now, let's manually update the status
    const updatedAttempt = await prisma.attempt.update({
        where: { id: attemptId },
        data: { status: "GRADED" }
    })

    console.log(`\n  ✅ Updated attempt status to: ${updatedAttempt.status}`)
    console.log(`\n  📎 Results URL (student): http://localhost:3000/student/attempts/${attemptId}/results`)
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
