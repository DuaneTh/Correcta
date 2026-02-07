import { PrismaClient, UserRole } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
    const hash = await bcrypt.hash('KourpatLewis1!', 10)
    const institution = await prisma.institution.findFirst({ where: { domain: 'demo.edu' } })
    if (!institution) throw new Error('Institution demo.edu not found')

    const admin = await prisma.user.upsert({
        where: { email: 'admin@correcta.app' },
        update: { passwordHash: hash },
        create: {
            email: 'admin@correcta.app',
            name: 'Correcta Admin',
            passwordHash: hash,
            role: UserRole.PLATFORM_ADMIN,
            institutionId: institution.id
        }
    })
    console.log(`Created: ${admin.email} (${admin.role})`)
}

main()
    .then(async () => { await prisma.$disconnect(); await pool.end() })
    .catch(async (e) => { console.error(e); await prisma.$disconnect(); await pool.end(); process.exit(1) })
