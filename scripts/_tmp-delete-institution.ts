import 'dotenv/config'
import { prisma } from '../lib/prisma'

const run = async () => {
    const institution = await prisma.institution.findFirst({
        where: { name: 'ESSEC' },
        select: { id: true },
    })
    if (!institution) {
        console.log('No institution found')
        return
    }
    await prisma.institution.delete({ where: { id: institution.id } })
    console.log(`Deleted institution ${institution.id}`)
    await prisma.$disconnect()
}

run().catch((error) => {
    console.error(error)
    process.exit(1)
})
