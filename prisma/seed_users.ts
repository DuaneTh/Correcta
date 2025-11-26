import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const institution = await prisma.institution.findFirst({
        where: { domain: 'demo.edu' }
    })

    if (!institution) {
        console.error('Institution not found!')
        return
    }

    const profPassword = await bcrypt.hash('prof123', 10)
    const studentPassword = await bcrypt.hash('student123', 10)

    const prof = await prisma.user.upsert({
        where: { email: 'prof@demo.edu' },
        update: {
            passwordHash: profPassword,
            role: UserRole.TEACHER
        },
        create: {
            email: 'prof@demo.edu',
            name: 'Professor Demo',
            passwordHash: profPassword,
            role: UserRole.TEACHER,
            institutionId: institution.id
        }
    })

    const student = await prisma.user.upsert({
        where: { email: 'student@demo.edu' },
        update: {
            passwordHash: studentPassword,
            role: UserRole.STUDENT
        },
        create: {
            email: 'student@demo.edu',
            name: 'Student Demo',
            passwordHash: studentPassword,
            role: UserRole.STUDENT,
            institutionId: institution.id
        }
    })

    console.log('Created users:', { prof, student })
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
