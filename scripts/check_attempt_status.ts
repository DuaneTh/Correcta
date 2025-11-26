import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const attemptId = process.argv[2]

    if (!attemptId) {
        console.error('Usage: npx tsx scripts/check_attempt_status.ts <attemptId>')
        process.exit(1)
    }

    const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
            exam: {
                include: {
                    sections: {
                        include: {
                            questions: true
                        }
                    }
                }
            },
            answers: {
                include: {
                    grades: true
                }
            }
        }
    })

    if (!attempt) {
        console.error(`Attempt ${attemptId} not found`)
        process.exit(1)
    }

    // Count total questions
    const totalQuestions = attempt.exam.sections.reduce(
        (sum, section) => sum + section.questions.length,
        0
    )

    // Count graded answers
    const gradedAnswers = attempt.answers.filter(answer => answer.grades.length > 0)
    const gradedCount = gradedAnswers.length

    console.log('\n=== Attempt Status Check ===')
    console.log(`Attempt ID: ${attempt.id}`)
    console.log(`Status: ${attempt.status}`)
    console.log(`Submitted At: ${attempt.submittedAt || 'Not submitted'}`)
    console.log(`\nGrading Progress:`)
    console.log(`  Total Questions: ${totalQuestions}`)
    console.log(`  Graded Answers: ${gradedCount}`)
    console.log(`  Progress: ${totalQuestions > 0 ? Math.round((gradedCount / totalQuestions) * 100) : 0}%`)
    console.log(`\nExpected Status:`)

    if (gradedCount === 0) {
        console.log(`  → SUBMITTED (0 graded)`)
    } else if (gradedCount < totalQuestions) {
        console.log(`  → GRADING_IN_PROGRESS (${gradedCount}/${totalQuestions} graded)`)
    } else {
        console.log(`  → GRADED (all ${totalQuestions} questions graded)`)
    }

    console.log(`\nActual Status: ${attempt.status}`)
    console.log('===========================\n')
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
