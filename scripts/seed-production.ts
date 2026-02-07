import { PrismaClient, UserRole } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('=== Seeding production database ===\n')

    // --- 1. Institution ---
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
    console.log(`Institution: ${institution.name} (${institution.id})`)

    // --- 2. Users ---
    const adminPassword = await bcrypt.hash('admin123', 10)
    const profPassword = await bcrypt.hash('prof123', 10)
    const studentPassword = await bcrypt.hash('student123', 10)

    const admin = await prisma.user.upsert({
        where: { email: 'admin@demo.edu' },
        update: { passwordHash: adminPassword },
        create: {
            email: 'admin@demo.edu',
            name: 'Platform Admin',
            passwordHash: adminPassword,
            role: UserRole.PLATFORM_ADMIN,
            institutionId: institution.id
        }
    })
    console.log(`Admin:   ${admin.email} (${admin.role})`)

    const prof = await prisma.user.upsert({
        where: { email: 'prof@demo.edu' },
        update: { passwordHash: profPassword, role: UserRole.TEACHER },
        create: {
            email: 'prof@demo.edu',
            name: 'Professor Demo',
            passwordHash: profPassword,
            role: UserRole.TEACHER,
            institutionId: institution.id
        }
    })
    console.log(`Prof:    ${prof.email} (${prof.role})`)

    const student = await prisma.user.upsert({
        where: { email: 'student@demo.edu' },
        update: { passwordHash: studentPassword, role: UserRole.STUDENT },
        create: {
            email: 'student@demo.edu',
            name: 'Student Demo',
            passwordHash: studentPassword,
            role: UserRole.STUDENT,
            institutionId: institution.id
        }
    })
    console.log(`Student: ${student.email} (${student.role})`)

    // --- 3. Courses ---
    const courseDefs = [
        { id: 'course-cs101', code: 'CS101', name: 'Introduction to Computer Science' },
        { id: 'course-cs201', code: 'CS201', name: 'Data Structures and Algorithms' },
        { id: 'course-net301', code: 'NET301', name: 'Computer Networks' },
    ]

    for (const c of courseDefs) {
        const course = await prisma.course.upsert({
            where: { id: c.id },
            update: {},
            create: { id: c.id, code: c.code, name: c.name, institutionId: institution.id }
        })
        console.log(`Course:  ${course.code} - ${course.name}`)
    }

    console.log('\n=== Seed complete ===')
    console.log('\nTest accounts:')
    console.log('  admin@demo.edu   / admin123   (PLATFORM_ADMIN)')
    console.log('  prof@demo.edu    / prof123    (TEACHER)')
    console.log('  student@demo.edu / student123 (STUDENT)')
}

main()
    .then(async () => { await prisma.$disconnect(); await pool.end() })
    .catch(async (e) => { console.error(e); await prisma.$disconnect(); await pool.end(); process.exit(1) })
