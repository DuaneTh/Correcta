import { prisma } from "../lib/prisma"

async function main() {
    // Find the Submit Test Exam and its course
    const exam = await prisma.exam.findFirst({
        where: { title: { contains: "Submit Test" } },
        include: { course: true }
    })

    if (!exam) {
        console.log("❌ Submit Test Exam not found")
        return
    }

    console.log(`✅ Found exam: ${exam.title}`)
    console.log(`  Course: ${exam.course.name} (${exam.course.id})`)

    // Check if there's already a class for this course
    const existingClass = await prisma.class.findFirst({
        where: { courseId: exam.course.id }
    })

    let classToEnroll

    if (existingClass) {
        console.log(`  Class already exists: ${existingClass.name}`)
        classToEnroll = existingClass
    } else {
        // Create a new class for this course
        console.log(`  Creating new class...`)
        classToEnroll = await prisma.class.create({
            data: {
                name: "Test Class",
                courseId: exam.course.id
            }
        })
        console.log(`  ✅ Created class: ${classToEnroll.name} (${classToEnroll.id})`)
    }

    // Find student1
    const student = await prisma.user.findUnique({
        where: { email: "student1@demo.edu" }
    })

    if (!student) {
        console.log("❌ Student not found")
        return
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.enrollment.findUnique({
        where: {
            userId_classId: {
                userId: student.id,
                classId: classToEnroll.id
            }
        }
    })

    if (existingEnrollment) {
        console.log(`  Student already enrolled`)
    } else {
        // Enroll the student
        await prisma.enrollment.create({
            data: {
                userId: student.id,
                classId: classToEnroll.id,
                role: "STUDENT"
            }
        })
        console.log(`  ✅ Enrolled ${student.email} in ${classToEnroll.name}`)
    }

    console.log("\n🎉 Setup complete! Student should now have access to Submit Test Exam")
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
