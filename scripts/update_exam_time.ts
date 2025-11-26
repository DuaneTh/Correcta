
import { prisma } from '@/lib/prisma'

async function main() {
    console.log("Updating Exam Start Time...")

    const exam = await prisma.exam.findFirst({
        where: { title: "Audit Exam UI 2" }
    })

    if (!exam) {
        console.error("Exam 'Audit Exam UI 2' not found")
        return
    }

    // Set start time to 1 hour ago
    const newStart = new Date(Date.now() - 60 * 60 * 1000)

    await prisma.exam.update({
        where: { id: exam.id },
        data: {
            startAt: newStart
        }
    })

    console.log(`Exam start time updated to ${newStart.toISOString()}`)
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
