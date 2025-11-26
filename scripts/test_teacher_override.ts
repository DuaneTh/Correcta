import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Simulating teacher override...')

    const answerId = '044ac9cc-1e06-41ff-a17b-782cd259f99d'
    const teacherId = (await prisma.user.findUnique({ where: { email: 'teacher1@demo.edu' } }))?.id

    if (!teacherId) throw new Error('Teacher not found')

    // Fetch existing grade before update
    const gradeBefore = await prisma.grade.findUnique({
        where: { answerId }
    })

    console.log('Grade BEFORE teacher override:')
    console.log(`  Score: ${gradeBefore?.score}`)
    console.log(`  Feedback: ${gradeBefore?.feedback}`)
    console.log(`  gradedByUserId: ${gradeBefore?.gradedByUserId}`)
    console.log(`  isOverridden: ${gradeBefore?.isOverridden}`)

    // Simulate what the API does
    const existingGrade = await prisma.grade.findUnique({
        where: { answerId }
    })

    const isOverridingAIGrade = existingGrade !== null && existingGrade.gradedByUserId === null

    console.log(`\nIs overriding AI grade? ${isOverridingAIGrade}`)

    // Update grade (simulating teacher override)
    const updatedGrade = await prisma.grade.update({
        where: { answerId },
        data: {
            score: 8,
            feedback: 'Modified by teacher - excellent work!',
            gradedByUserId: teacherId,
            isOverridden: isOverridingAIGrade || existingGrade?.isOverridden || false
        }
    })

    console.log('\nGrade AFTER teacher override:')
    console.log(`  Score: ${updatedGrade.score}`)
    console.log(`  Feedback: ${updatedGrade.feedback}`)
    console.log(`  gradedByUserId: ${updatedGrade.gradedByUserId}`)
    console.log(`  isOverridden: ${updatedGrade.isOverridden}`)

    // Verify the result
    if (updatedGrade.score === 8 &&
        updatedGrade.gradedByUserId === teacherId &&
        updatedGrade.isOverridden === true) {
        console.log('\n✅ Override logic works correctly!')
    } else {
        console.log('\n❌ Override logic failed!')
    }
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
