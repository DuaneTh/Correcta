import { PrismaClient, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Enrolling student in exam course...')

    // Find the exam
    const exam = await prisma.exam.findFirst({
        where: { title: 'AI Grading Test' },
        include: { course: true }
    })

    if (!exam) {
        console.error('Exam "AI Grading Test" not found.')
        return
    }

    console.log(`Exam found: ${exam.title} (Course: ${exam.course.name})`)

    // Find student
    const student = await prisma.user.findUnique({
        where: { email: 'student1@demo.edu' }
    })

    if (!student) {
        console.error('Student not found')
        return
    }

    // Find teacher
    const teacher = await prisma.user.findUnique({
        where: { email: 'teacher1@demo.edu' }
    })

    // Enroll student in course (if not already)
    // We need to enroll in a class. Let's find or create a class for this course.
    let cls = await prisma.class.findFirst({
        where: { courseId: exam.courseId }
    })

    if (!cls) {
        cls = await prisma.class.create({
            data: {
                name: 'Default Class',
                courseId: exam.courseId
            }
        })
        console.log('Created default class')
    }

    // Enroll student
    await prisma.enrollment.upsert({
        where: {
            userId_classId: {
                userId: student.id,
                classId: cls.id
            }
        },
        update: {},
        create: {
            userId: student.id,
            classId: cls.id,
            role: UserRole.STUDENT
        }
    })
    console.log(`Enrolled ${student.email} in class ${cls.name}`)

    // Enroll teacher
    if (teacher) {
        await prisma.enrollment.upsert({
            where: {
                userId_classId: {
                    userId: teacher.id,
                    classId: cls.id
                }
            },
            update: {},
            create: {
                userId: teacher.id,
                classId: cls.id,
                role: UserRole.TEACHER
            }
        })
        console.log(`Enrolled ${teacher.email} in class ${cls.name}`)
    }

    // Ensure exam targets this class
    if (!exam.classIds.includes(cls.id)) {
        await prisma.exam.update({
            where: { id: exam.id },
            data: {
                classIds: {
                    push: cls.id
                }
            }
        })
        console.log('Added class to exam target list')
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
