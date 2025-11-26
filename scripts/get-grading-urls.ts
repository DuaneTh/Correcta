import { prisma } from "../lib/prisma"

async function main() {
    const exam = await prisma.exam.findFirst({
        where: {
            title: { contains: "Submit Test" }
        }
    })

    if (!exam) {
        console.log("❌ Exam not found")
        return
    }

    console.log(`✅ Exam: ${exam.title}`)
    console.log(`  ID: ${exam.id}`)
    console.log(`  📎 Grading URL: http://localhost:3000/dashboard/exams/${exam.id}/grading`)

    // Find attempts for this exam
    const attempts = await prisma.attempt.findMany({
        where: { examId: exam.id },
        include: { student: true },
        orderBy: { startedAt: "desc" }
    })

    console.log(`\n  Attempts: ${attempts.length}`)
    attempts.forEach((attempt, idx) => {
        console.log(`    ${idx + 1}. ${attempt.student.email} - ${attempt.status} (${attempt.id})`)
    })

    if (attempts.length > 0) {
        const latestAttempt = attempts[0]
        console.log(`\n  📎 Grade latest attempt: http://localhost:3000/dashboard/exams/${exam.id}/grading/${latestAttempt.id}`)
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
