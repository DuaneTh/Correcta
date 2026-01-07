/* eslint-disable @typescript-eslint/no-unused-vars */
import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('Resetting passwords for demo users...')

    // Ensure institution exists
    const institution = await prisma.institution.upsert({
        where: { domain: 'demo.edu' },
        update: {},
        create: {
            name: 'Demo University',
            domain: 'demo.edu'
        }
    })

    const passwordHash = await bcrypt.hash('password123', 10)

    // Teacher 1
    const teacher = await prisma.user.upsert({
        where: { email: 'teacher1@demo.edu' },
        update: {
            passwordHash,
            role: UserRole.TEACHER,
            institutionId: institution.id
        },
        create: {
            email: 'teacher1@demo.edu',
            name: 'Teacher One',
            passwordHash,
            role: UserRole.TEACHER,
            institutionId: institution.id
        }
    })
    console.log('Upserted teacher1@demo.edu')

    // Student 1
    const student = await prisma.user.upsert({
        where: { email: 'student1@demo.edu' },
        update: {
            passwordHash,
            role: UserRole.STUDENT,
            institutionId: institution.id
        },
        create: {
            email: 'student1@demo.edu',
            name: 'Student One',
            passwordHash,
            role: UserRole.STUDENT,
            institutionId: institution.id
        }
    })
    console.log('Upserted student1@demo.edu')
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
