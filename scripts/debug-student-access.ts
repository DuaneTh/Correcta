import { prisma } from "../lib/prisma"

async function main() {
    const student = await prisma.user.findUnique({
        where: { email: "student1@demo.edu" },
        include: {
            enrollments: {
                include: {
                    class: {
                        include: {
                            course: {
                                include: {
                                    exams: true
                                }
                            }
                        }
                    }
                }
            }
        }
    })

    if (!student) {
        console.log("❌ Student not found")
        return
    }

    console.log("✅ Student:", student.email, student.id)
    console.log("📚 Enrollments:", student.enrollments.length)

    student.enrollments.forEach((enrollment, idx) => {
        console.log(`\n  Enrollment ${idx + 1}:`)
        console.log(`    Class: ${enrollment.class.name} (${enrollment.class.id})`)
        console.log(`    Course: ${enrollment.class.course.name} (${enrollment.class.course.id})`)
        console.log(`    Exams in this course: ${enrollment.class.course.exams.length}`)
        enrollment.class.course.exams.forEach((exam) => {
            console.log(`      - ${exam.title} (${exam.id})`)
        })
    })

    // Check specific exam
    const exam = await prisma.exam.findFirst({
        where: {
            title: { contains: "Submit Test" }
        },
        include: {
            course: {
                include: {
                    classes: {
                        include: {
                            enrollments: {
                                where: { userId: student.id }
                            }
                        }
                    }
                }
            }
        }
    })

    if (exam) {
        console.log("\n🎯 Submit Test Exam:")
        console.log(`  ID: ${exam.id}`)
        console.log(`  Course: ${exam.course.name} (${exam.course.id})`)
        console.log(`  Classes: ${exam.course.classes.length}`)
        exam.course.classes.forEach((cls, idx) => {
            console.log(`    Class ${idx + 1}: ${cls.name} (${cls.id})`)
            console.log(`      Student enrollments: ${cls.enrollments.length}`)
        })

        const hasAccess = exam.course.classes.some(cls => cls.enrollments.length > 0)
        console.log(`  ✅ Student has access: ${hasAccess}`)
    } else {
        console.log("\n❌ Submit Test Exam not found")
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
