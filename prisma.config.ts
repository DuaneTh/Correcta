import dotenv from 'dotenv'
import { defineConfig } from 'prisma/config'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

if (!process.env.DATABASE_URL) {
    throw new Error(
        'DATABASE_URL is missing. Set it in .env.local (not committed) or export it in your shell.'
    )
}

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
    },
    datasource: {
        url: process.env.DATABASE_URL,
    },
})
