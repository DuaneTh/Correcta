import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    const examId = "f1b42330-5179-4581-8298-8d8fd45dbfdd"

    // Set start time to 1 hour ago, duration 120 minutes
    const startAt = new Date(Date.now() - 60 * 60 * 1000)

    await prisma.exam.update({
        where: { id: examId },
        data: {
            startAt,
            durationMinutes: 120
        }
    })

    console.log(`Updated exam ${examId}`)
    console.log(`Start time: ${startAt.toISOString()}`)
    console.log(`Duration: 120 minutes`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
