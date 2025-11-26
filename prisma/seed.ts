import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const hashedPassword = await bcrypt.hash('admin123', 10)

    const institution = await prisma.institution.upsert({
        where: { domain: 'demo.edu' },
        update: {},
        create: {
            name: 'Demo University',
            domain: 'demo.edu',
            settings: {
                branding: { color: '#000000' },
                defaultAntiCheat: { webcam: false, screen: false }
            }
        }
    })

    const admin = await prisma.user.upsert({
        where: { email: 'admin@demo.edu' },
        update: {
            passwordHash: hashedPassword
        },
        create: {
            email: 'admin@demo.edu',
            name: 'Platform Admin',
            passwordHash: hashedPassword,
            role: UserRole.PLATFORM_ADMIN,
            institutionId: institution.id
        }
    })

    const ssoInstitution = await prisma.institution.upsert({
        where: { domain: 'demo-sso.edu' },
        update: {},
        create: {
            name: 'SSO Demo University',
            domain: 'demo-sso.edu',
            settings: {
                branding: { color: '#0000FF' },
                defaultAntiCheat: { webcam: true, screen: false }
            },
            ssoConfig: {
                type: 'oidc',
                issuer: 'http://localhost:8080/realms/correcta-realm',
                clientId: 'correcta-client',
                clientSecret: 'correcta-secret-key'
            }
        }
    })

    console.log({ institution, admin, ssoInstitution })
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
