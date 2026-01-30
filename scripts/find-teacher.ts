import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    // Find all teachers
    const teachers = await prisma.user.findMany({
        where: { role: { in: ['TEACHER', 'SCHOOL_ADMIN'] } },
        select: { id: true, name: true, email: true, institutionId: true }
    })
    console.log('Available teachers:')
    teachers.forEach(t => console.log(`  - ${t.email} (${t.name}) - institution: ${t.institutionId}`))

    // Find prof1@demo2
    const prof1 = teachers.find(t => t.email.includes('prof1') && t.email.includes('demo2'))
    if (prof1) {
        console.log('\nFound prof1@demo2:', prof1)
    } else {
        console.log('\nNo prof1@demo2 found. Looking for similar...')
        const similar = teachers.filter(t => t.email.includes('prof'))
        console.log('Profs:', similar)
    }
}
main().finally(async () => { await prisma.$disconnect(); await pool.end() })
