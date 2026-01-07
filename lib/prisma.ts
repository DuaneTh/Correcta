import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
    prismaPool: Pool | undefined
}

const pool =
    globalForPrisma.prismaPool ??
    new Pool({
        connectionString: process.env.DATABASE_URL,
    })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaPool = pool

const adapter = new PrismaPg(pool)

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
    })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
