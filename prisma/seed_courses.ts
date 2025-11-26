import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const institution = await prisma.institution.findFirst({
        where: { domain: 'demo.edu' }
    })

    if (!institution) {
        console.error('Institution not found. Run seed.ts first!')
        return
    }

    // Create some test courses
    const courses = await Promise.all([
        prisma.course.upsert({
            where: {
                id: 'course-cs101'
            },
            update: {},
            create: {
                id: 'course-cs101',
                code: 'CS101',
                name: 'Introduction to Computer Science',
                institutionId: institution.id
            }
        }),
        prisma.course.upsert({
            where: {
                id: 'course-cs201'
            },
            update: {},
            create: {
                id: 'course-cs201',
                code: 'CS201',
                name: 'Data Structures and Algorithms',
                institutionId: institution.id
            }
        }),
        prisma.course.upsert({
            where: {
                id: 'course-net301'
            },
            update: {},
            create: {
                id: 'course-net301',
                code: 'NET301',
                name: 'Computer Networks',
                institutionId: institution.id
            }
        })
    ])

    console.log('Created courses:', courses)
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
