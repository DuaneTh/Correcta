import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// Force rebuild

export const buildAuthOptions = async (institutionId?: string): Promise<NextAuthOptions> => {
    const providers: any[] = [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email }
                })

                if (!user || !user.passwordHash) {
                    return null
                }

                const isPasswordValid = await bcrypt.compare(
                    credentials.password,
                    user.passwordHash
                )

                if (!isPasswordValid) {
                    return null
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    institutionId: user.institutionId
                }
            }
        })
    ]

    if (institutionId) {
        console.log(`[Auth] Building options for institutionId: ${institutionId}`)
        const institution = await prisma.institution.findUnique({
            where: { id: institutionId }
        })

        if (institution?.ssoConfig) {
            const sso = institution.ssoConfig as any
            console.log(`[Auth] Found SSO config type: ${sso.type}`)
            if (sso.type === 'oidc') {
                console.log(`[Auth] Adding OIDC provider: ${sso.issuer}`)
                providers.push({
                    id: 'oidc',
                    name: institution.name,
                    type: 'oauth',
                    wellKnown: `${sso.issuer}/.well-known/openid-configuration`,
                    issuer: sso.issuer,
                    clientId: sso.clientId,
                    clientSecret: sso.clientSecret,
                    authorization: { params: { scope: "openid email profile" } },
                    idToken: true,
                    checks: ["pkce", "state"],
                    allowDangerousEmailAccountLinking: true,
                    profile(profile: any) {
                        console.log(`[Auth] OIDC Profile received:`, profile.email)
                        return {
                            id: profile.sub,
                            name: profile.name || profile.preferred_username,
                            email: profile.email,
                            role: 'STUDENT', // Default, will be updated by JIT logic
                            institutionId: institution.id
                        }
                    }
                })
            }
        } else {
            console.log(`[Auth] No SSO config found for institution`)
        }
    } else {
        console.log(`[Auth] No institutionId provided`)
    }

    return {
        debug: true,
        adapter: {
            ...PrismaAdapter(prisma),
            linkAccount: (account: any) => {
                const sanitizedAccount = { ...account }
                delete (sanitizedAccount as any)['not-before-policy']
                delete (sanitizedAccount as any)['refresh_expires_in']
                return PrismaAdapter(prisma).linkAccount(sanitizedAccount)
            },
        },
        session: { strategy: "jwt" },
        pages: { signIn: "/login" },
        providers,
        callbacks: {
            async signIn({ user, account, profile }) {
                if (account?.provider === 'oidc') {
                    return true
                }
                return true
            },
            async session({ session, token }) {
                if (token) {
                    session.user.id = token.id as string
                    session.user.role = token.role as string
                    session.user.institutionId = token.institutionId as string
                    // @ts-ignore
                    session.user.provider = token.provider as string
                }
                return session
            },
            async jwt({ token, user, account }: { token: any, user: any, account: any }) {
                if (user) {
                    token.id = user.id
                    token.role = user.role
                    token.institutionId = user.institutionId
                }
                if (account) {
                    token.provider = account.provider
                }
                return token
            }
        }
    }
}
