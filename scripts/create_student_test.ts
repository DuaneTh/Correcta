
import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    // 1. Find the institution with the exam
    const exam = await prisma.exam.findFirst({
        include: { course: true }
    })

    if (!exam) {
        console.error("No exam found! Please create an exam first.")
        process.exit(1)
    }

    const institutionId = exam.course.institutionId
    console.log(`Found exam in institution: ${institutionId}`)

    // 2. Create Student User
    const hashedPassword = await bcrypt.hash('student123', 10)
    const email = 'student1@demo.edu'

    const student = await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash: hashedPassword,
            role: UserRole.STUDENT,
            institutionId
        },
        create: {
            email,
            name: 'Test Student',
            passwordHash: hashedPassword,
            role: UserRole.STUDENT,
            institutionId
        }
    })
    console.log(`Student created/updated: ${student.email}`)

    // 3. Ensure a Class exists for the Course
    let cls = await prisma.class.findFirst({
        where: { courseId: exam.courseId }
    })

    if (!cls) {
        cls = await prisma.class.create({
            data: {
                name: 'Group A',
                courseId: exam.courseId
            }
        })
        console.log(`Class created: ${cls.name}`)
    } else {
        console.log(`Class found: ${cls.name}`)
    }

    // 4. Enroll Student in the Class
    const enrollment = await prisma.enrollment.upsert({
        where: {
            userId_classId: {
                userId: student.id,
                classId: cls.id
            }
        },
        update: {
            role: UserRole.STUDENT
        },
        create: {
            userId: student.id,
            classId: cls.id,
            role: UserRole.STUDENT
        }
    })
    console.log(`Student enrolled in class: ${cls.name}`)
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
