
import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log("Creating demo users...")

    // 1. Ensure Institution exists
    const institution = await prisma.institution.upsert({
        where: { domain: 'demo.edu' },
        update: {},
        create: {
            name: 'Demo University',
            domain: 'demo.edu',
            settings: {
                branding: { color: '#000000' },
                defaultAntiCheat: { webcam: false, screen: false }
            }
        }
    })
    console.log(`Institution ensured: ${institution.name}`)

    // 2. Create Users
    const users = [
        { email: 'admin@demo.edu', password: 'admin123', role: UserRole.PLATFORM_ADMIN, name: 'Demo Admin' },
        { email: 'teacher1@demo.edu', password: 'teacher123', role: UserRole.TEACHER, name: 'Demo Teacher' },
        { email: 'student1@demo.edu', password: 'student123', role: UserRole.STUDENT, name: 'Demo Student' }
    ]

    for (const u of users) {
        const hashedPassword = await bcrypt.hash(u.password, 10)
        await prisma.user.upsert({
            where: { email: u.email },
            update: {
                passwordHash: hashedPassword,
                role: u.role,
                institutionId: institution.id,
                name: u.name
            },
            create: {
                email: u.email,
                passwordHash: hashedPassword,
                role: u.role,
                institutionId: institution.id,
                name: u.name
            }
        })
        console.log(`User ensured: ${u.email}`)
    }

    // 3. Ensure Course and Class for Student Enrollment
    // We need a course for the teacher to "own" or at least exist in the institution
    const course = await prisma.course.upsert({
        where: { id: 'demo-course-101' }, // Hardcoded ID for simplicity in re-runs
        update: {},
        create: {
            id: 'demo-course-101',
            code: 'DEMO101',
            name: 'Demo Course',
            institutionId: institution.id
        }
    })

    const cls = await prisma.class.upsert({
        where: { id: 'demo-class-a' },
        update: {},
        create: {
            id: 'demo-class-a',
            name: 'Class A',
            courseId: course.id
        }
    })

    // Enroll Student
    const student = await prisma.user.findUnique({ where: { email: 'student1@demo.edu' } })
    if (student) {
        await prisma.enrollment.upsert({
            where: {
                userId_classId: {
                    userId: student.id,
                    classId: cls.id
                }
            },
            update: { role: UserRole.STUDENT },
            create: {
                userId: student.id,
                classId: cls.id,
                role: UserRole.STUDENT
            }
        })
        console.log(`Student enrolled in ${cls.name}`)
    }

    console.log("Done!")
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
