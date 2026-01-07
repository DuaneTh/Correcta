import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'

const PASSWORD = 'password123'

const upsertInstitution = async (name: string, domain: string) => {
    const institution = await prisma.institution.upsert({
        where: { domain },
        update: { name },
        create: { name, domain },
    })

    await prisma.institutionDomain.upsert({
        where: { domain },
        update: { institutionId: institution.id },
        create: { domain, institutionId: institution.id },
    })

    return institution
}

const buildUsers = (count: number, role: 'STUDENT' | 'TEACHER', domain: string) => {
    return Array.from({ length: count }, (_, index) => {
        const num = index + 1
        const email = `${role === 'STUDENT' ? 'student' : 'teacher'}${num}@${domain}`
        const name = `${role === 'STUDENT' ? 'Student' : 'Teacher'} ${num}`
        return { email, name, role }
    })
}

const run = async () => {
    const [demo1, demo2] = await Promise.all([
        upsertInstitution('Demo 1', 'demo1.edu'),
        upsertInstitution('Demo 2', 'demo2.edu'),
    ])

    const passwordHash = await bcrypt.hash(PASSWORD, 10)

    const users = [
        ...buildUsers(10, 'STUDENT', 'demo1.edu').map((user) => ({
            ...user,
            institutionId: demo1.id,
        })),
        ...buildUsers(10, 'STUDENT', 'demo2.edu').map((user) => ({
            ...user,
            institutionId: demo2.id,
        })),
        ...buildUsers(5, 'TEACHER', 'demo1.edu').map((user) => ({
            ...user,
            institutionId: demo1.id,
        })),
        ...buildUsers(5, 'TEACHER', 'demo2.edu').map((user) => ({
            ...user,
            institutionId: demo2.id,
        })),
        {
            email: 'admin@demo1.edu',
            name: 'Admin Demo1',
            role: 'SCHOOL_ADMIN' as const,
            institutionId: demo1.id,
        },
        {
            email: 'admin@demo2.edu',
            name: 'Admin Demo2',
            role: 'SCHOOL_ADMIN' as const,
            institutionId: demo2.id,
        },
        {
            email: 'admin@correcta.app',
            name: 'Admin Correcta',
            role: 'PLATFORM_ADMIN' as const,
            institutionId: null,
        },
    ]

    for (const user of users) {
        await prisma.user.upsert({
            where: { email: user.email },
            update: {
                name: user.name,
                role: user.role,
                institutionId: user.institutionId ?? undefined,
                passwordHash,
            },
            create: {
                email: user.email,
                name: user.name,
                role: user.role,
                institutionId: user.institutionId ?? undefined,
                passwordHash,
            },
        })
    }

    console.log(`Created/updated ${users.length} users. Password: ${PASSWORD}`)
    await prisma.$disconnect()
}

run().catch((error) => {
    console.error(error)
    process.exit(1)
})
