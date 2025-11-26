import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const domain = 'demo-sso.edu'

    // Upsert Institution
    const institution = await prisma.institution.upsert({
        where: { domain },
        update: {
            ssoConfig: {
                type: 'oidc',
                issuer: 'http://localhost:8080/realms/correcta-realm',
                clientId: 'correcta-client',
                clientSecret: 'secret' // In a real app, this would be secure
            }
        },
        create: {
            name: 'Demo SSO University',
            domain,
            ssoConfig: {
                type: 'oidc',
                issuer: 'http://localhost:8080/realms/correcta-realm',
                clientId: 'correcta-client',
                clientSecret: 'secret'
            }
        }
    })

    console.log(`Created/Updated Institution: ${institution.name} (${institution.id})`)

    // Upsert User
    const email = 'prof@demo-sso.edu'
    const user = await prisma.user.upsert({
        where: { email },
        update: {
            institutionId: institution.id
        },
        create: {
            email,
            name: 'Professor SSO',
            role: 'TEACHER',
            institutionId: institution.id
        }
    })

    console.log(`Created/Updated User: ${user.email}`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
