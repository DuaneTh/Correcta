/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const email = 'prof@demo-sso.edu'
    console.log(`Updating role for ${email}...`)

    try {
        const user = await prisma.user.update({
            where: { email },
            data: { role: 'TEACHER' }
        })
        console.log('User updated:', user)
    } catch (e) {
        console.error('Error updating user:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
