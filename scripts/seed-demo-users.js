const dotenv = require('dotenv')
const { PrismaClient, UserRole } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

if (!process.env.DATABASE_URL) {
    console.error(
        'DATABASE_URL is missing. Set it in .env.local (not committed) or export it in your shell.'
    )
    process.exit(1)
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const PASSWORD = 'password123'
const SALT_ROUNDS = 10

const demoInstitutions = [
    {
        key: 'demo1',
        label: 'Demo1',
        name: 'Demo School 1',
        domain: 'demo1.edu',
        course: { id: 'demo1-course-101', code: 'DEMO1-101', name: 'Demo 1 Course' },
        class: { id: 'demo1-class-a', name: 'Class A' },
    },
    {
        key: 'demo2',
        label: 'Demo2',
        name: 'Demo School 2',
        domain: 'demo2.edu',
        course: { id: 'demo2-course-101', code: 'DEMO2-101', name: 'Demo 2 Course' },
        class: { id: 'demo2-class-a', name: 'Class A' },
    },
]

const buildUsersForDomain = ({ domain, label }) => ({
    admin: { email: `admin@${domain}`, role: UserRole.SCHOOL_ADMIN, name: `${label} Admin` },
    teachers: [
        { email: `prof1@${domain}`, role: UserRole.TEACHER, name: `${label} Prof 1` },
        { email: `prof2@${domain}`, role: UserRole.TEACHER, name: `${label} Prof 2` },
    ],
    students: Array.from({ length: 4 }).map((_, index) => ({
        email: `student${index + 1}@${domain}`,
        role: UserRole.STUDENT,
        name: `${label} Student ${index + 1}`,
    })),
})

const upsertUser = async ({ email, role, name, institutionId, passwordHash }) => {
    return prisma.user.upsert({
        where: { email },
        update: {
            role,
            institutionId,
            name,
            passwordHash,
            archivedAt: null,
        },
        create: {
            email,
            role,
            institutionId,
            name,
            passwordHash,
        },
        select: { id: true, email: true },
    })
}

const upsertEnrollment = async ({ userId, classId, role }) => {
    return prisma.enrollment.upsert({
        where: {
            userId_classId: {
                userId,
                classId,
            },
        },
        update: { role },
        create: { userId, classId, role },
    })
}

async function main() {
    console.log('Seeding demo users...')

    const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS)

    await upsertUser({
        email: 'admin@correcta.app',
        role: UserRole.PLATFORM_ADMIN,
        name: 'Platform Admin',
        institutionId: null,
        passwordHash,
    })

    for (const entry of demoInstitutions) {
        const institution = await prisma.institution.upsert({
            where: { domain: entry.domain },
            update: { name: entry.name },
            create: {
                name: entry.name,
                domain: entry.domain,
            },
        })

        await prisma.institutionDomain.upsert({
            where: { domain: entry.domain },
            update: { institutionId: institution.id },
            create: { domain: entry.domain, institutionId: institution.id },
        })

        const course = await prisma.course.upsert({
            where: { id: entry.course.id },
            update: {
                code: entry.course.code,
                name: entry.course.name,
                institutionId: institution.id,
            },
            create: {
                id: entry.course.id,
                code: entry.course.code,
                name: entry.course.name,
                institutionId: institution.id,
            },
        })

        const cls = await prisma.class.upsert({
            where: { id: entry.class.id },
            update: {
                name: entry.class.name,
                courseId: course.id,
            },
            create: {
                id: entry.class.id,
                name: entry.class.name,
                courseId: course.id,
            },
        })

        const users = buildUsersForDomain(entry)

        await upsertUser({
            email: users.admin.email,
            role: users.admin.role,
            name: users.admin.name,
            institutionId: institution.id,
            passwordHash,
        })

        for (const teacher of users.teachers) {
            const user = await upsertUser({
                email: teacher.email,
                role: teacher.role,
                name: teacher.name,
                institutionId: institution.id,
                passwordHash,
            })
            await upsertEnrollment({
                userId: user.id,
                classId: cls.id,
                role: UserRole.TEACHER,
            })
        }

        for (const student of users.students) {
            const user = await upsertUser({
                email: student.email,
                role: student.role,
                name: student.name,
                institutionId: institution.id,
                passwordHash,
            })
            await upsertEnrollment({
                userId: user.id,
                classId: cls.id,
                role: UserRole.STUDENT,
            })
        }

        console.log(`Ensured institution: ${institution.name}`)
        console.log(`Ensured course/class: ${course.code} / ${cls.name}`)
        console.log(`Ensured users: ${[users.admin, ...users.teachers, ...users.students].map((u) => u.email).join(', ')}`)
    }

    console.log('Demo users seeded.')
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
