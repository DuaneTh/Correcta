import { prisma } from "../lib/prisma"

async function main() {
    const attempt = await prisma.attempt.findFirst({
        where: {
            student: { email: "student1@demo.edu" }
        },
        orderBy: { startedAt: "desc" },
        include: {
            exam: true
        }
    })

    if (!attempt) {
        console.log("❌ No attempts found for student1@demo.edu")
        return
    }

    console.log(`✅ Latest attempt:`)
    console.log(`  ID: ${attempt.id}`)
    console.log(`  Exam: ${attempt.exam.title}`)
    console.log(`  Status: ${attempt.status}`)
    console.log(`  Started: ${attempt.startedAt}`)
    console.log(`  Submitted: ${attempt.submittedAt || "Not submitted"}`)
    console.log(`\n  📎 Direct URL: http://localhost:3000/student/attempts/${attempt.id}`)
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
