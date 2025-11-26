import { PrismaClient, AttemptStatus, UserRole } from '@prisma/client'
import { assertAttemptContentEditable, AttemptNotEditableError } from '../lib/attemptPermissions'

const prisma = new PrismaClient()

async function main() {
    console.log('=== Testing Attempt Content Immutability ===\n')

    const student = await prisma.user.findUnique({ where: { email: 'student1@demo.edu' } })
    const teacher = await prisma.user.findUnique({ where: { email: 'teacher1@demo.edu' } })
    const admin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } })

    if (!student || !teacher) throw new Error('Users not found')

    const exam = await prisma.exam.findFirst({
        where: { title: 'AI Grading Test' },
        include: { sections: { include: { questions: { include: { segments: true } } } } }
    })
    if (!exam) throw new Error('Exam not found')

    // TEST 1: IN_PROGRESS attempt - student CAN edit
    console.log('TEST 1: IN_PROGRESS attempt - Student can edit')
    const inProgressAttempt = await prisma.attempt.create({
        data: {
            examId: exam.id,
            studentId: student.id,
            status: AttemptStatus.IN_PROGRESS
        }
    })

    try {
        await assertAttemptContentEditable(inProgressAttempt.id, {
            id: student.id,
            role: UserRole.STUDENT
        })
        console.log('  ✓ PASS - Student CAN edit IN_PROGRESS attempt\n')
    } catch (error) {
        console.log(`  ✗ FAIL - ${error instanceof Error ? error.message : 'Unknown error'}\n`)
    }

    // TEST 2: SUBMITTED attempt - student CANNOT edit
    console.log('TEST 2: SUBMITTED attempt - Student CANNOT edit')
    await prisma.attempt.update({
        where: { id: inProgressAttempt.id },
        data: { status: AttemptStatus.SUBMITTED, submittedAt: new Date() }
    })

    try {
        await assertAttemptContentEditable(inProgressAttempt.id, {
            id: student.id,
            role: UserRole.STUDENT
        })
        console.log('  ✗ FAIL - Student could edit SUBMITTED attempt\n')
    } catch (error) {
        if (error instanceof AttemptNotEditableError) {
            console.log(`  ✓ PASS - Blocked with message: "${error.message}"\n`)
        } else {
            console.log(`  ✗ FAIL - Wrong error: ${error instanceof Error ? error.message : 'Unknown'}\n`)
        }
    }

    // TEST 3: GRADED attempt - student CANNOT edit
    console.log('TEST 3: GRADED attempt - Student CANNOT edit')
    await prisma.attempt.update({
        where: { id: inProgressAttempt.id },
        data: { status: AttemptStatus.GRADED }
    })

    try {
        await assertAttemptContentEditable(inProgressAttempt.id, {
            id: student.id,
            role: UserRole.STUDENT
        })
        console.log('  ✗ FAIL - Student could edit GRADED attempt\n')
    } catch (error) {
        if (error instanceof AttemptNotEditableError) {
            console.log(`  ✓ PASS - Blocked with message: "${error.message}"\n`)
        } else {
            console.log(`  ✗ FAIL - Wrong error\n`)
        }
    }

    // TEST 4: SUBMITTED attempt - teacher CANNOT edit content
    console.log('TEST 4: SUBMITTED attempt - Teacher CANNOT edit content')
    try {
        await assertAttemptContentEditable(inProgressAttempt.id, {
            id: teacher.id,
            role: UserRole.TEACHER
        })
        console.log('  ✗ FAIL - Teacher could edit SUBMITTED attempt\n')
    } catch (error) {
        if (error instanceof AttemptNotEditableError) {
            console.log(`  ✓ PASS - Blocked with message: "${error.message}"\n`)
        } else {
            console.log(`  ✗ FAIL - Wrong error\n`)
        }
    }

    // TEST 5: SUBMITTED attempt - ADMIN CAN edit (if admin exists)
    if (admin) {
        console.log('TEST 5: SUBMITTED attempt - Admin CAN edit')
        try {
            await assertAttemptContentEditable(inProgressAttempt.id, {
                id: admin.id,
                role: UserRole.ADMIN
            })
            console.log('  ✓ PASS - Admin CAN edit SUBMITTED attempt\n')
        } catch (error) {
            console.log(`  ✗ FAIL - Admin blocked: ${error instanceof Error ? error.message : 'Unknown'}\n`)
        }
    } else {
        console.log('TEST 5: SKIPPED - No admin user found\n')
    }

    console.log('=== All Tests Complete ===')
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
