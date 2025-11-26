import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function setExamLocked(examId: string) {
    // Set startAt to 5 minutes from now (well within the T-10 window)
    const lockTime = new Date(Date.now() + 5 * 60 * 1000)

    const exam = await prisma.exam.update({
        where: { id: examId },
        data: {
            startAt: lockTime
        },
        select: {
            id: true,
            title: true,
            startAt: true
        }
    })

    console.log('✅ Exam locked successfully:')
    console.log(`   ID: ${exam.id}`)
    console.log(`   Title: ${exam.title}`)
    console.log(`   StartAt: ${exam.startAt}`)
    console.log(`   Time until start: ~5 minutes`)
    console.log(`\n🔒 The exam is now locked for editing (T-10 rule active)`)
}

async function setExamUnlocked(examId: string) {
    // Set startAt to tomorrow at 10:00
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(10, 0, 0, 0)

    const exam = await prisma.exam.update({
        where: { id: examId },
        data: {
            startAt: tomorrow
        },
        select: {
            id: true,
            title: true,
            startAt: true
        }
    })

    console.log('✅ Exam unlocked successfully:')
    console.log(`   ID: ${exam.id}`)
    console.log(`   Title: ${exam.title}`)
    console.log(`   StartAt: ${exam.startAt}`)
    console.log(`\n🔓 The exam is now editable (not within T-10 window)`)
}

async function main() {
    const examId = process.argv[2]
    const action = process.argv[3] || 'lock'

    if (!examId) {
        console.error('Usage: ts-node scripts/set_exam_lock.ts <examId> [lock|unlock]')
        process.exit(1)
    }

    if (action === 'unlock') {
        await setExamUnlocked(examId)
    } else {
        await setExamLocked(examId)
    }

    await prisma.$disconnect()
}

main().catch(console.error)
