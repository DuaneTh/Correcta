/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment */
import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// Force rebuild

type SsoConfig = {
    type?: 'oidc' | 'saml'
    issuer?: string
    clientId?: string
    clientSecret?: string
    roleClaim?: string
    roleMapping?: Record<string, string>
    defaultRole?: string
    enabled?: boolean
}

const normalizeClaimValues = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.map((entry) => String(entry).trim()).filter(Boolean)
    }

    if (typeof value === 'string') {
        return value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)
    }

    if (value === null || value === undefined) {
        return []
    }

    return [String(value)]
}

const resolveRoleFromProfile = (profile: any, sso: SsoConfig): string => {
    const roleClaim = sso.roleClaim ?? 'roles'
    const rawClaims =
        profile?.[roleClaim] ??
        profile?.roles ??
        profile?.groups ??
        profile?.eduPersonAffiliation

    const candidates = normalizeClaimValues(rawClaims).map((entry) => entry.toLowerCase())
    const roleMapping = Object.entries(sso.roleMapping ?? {}).reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key.toLowerCase()] = value
        return acc
    }, {})

    for (const candidate of candidates) {
        const mapped = roleMapping[candidate]
        if (mapped && mapped !== 'PLATFORM_ADMIN') {
            return mapped
        }
    }

    const fallbackMapping: Record<string, string> = {
        faculty: 'TEACHER',
        instructor: 'TEACHER',
        professor: 'TEACHER',
        teacher: 'TEACHER',
        staff: 'TEACHER',
        student: 'STUDENT',
        alumni: 'STUDENT',
        admin: 'SCHOOL_ADMIN',
        administrator: 'SCHOOL_ADMIN',
    }

    for (const candidate of candidates) {
        const fallbackRole = fallbackMapping[candidate]
        if (fallbackRole) {
            return fallbackRole
        }
    }

    return sso.defaultRole ?? 'STUDENT'
}

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

                if (!user || !user.passwordHash || user.archivedAt) {
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
            const sso = institution.ssoConfig as SsoConfig
            console.log(`[Auth] Found SSO config type: ${sso.type}`)
            if (sso.enabled === false) {
                console.log(`[Auth] SSO config disabled for institution`)
            } else if (sso.type === 'oidc') {
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
                        const role = resolveRoleFromProfile(profile, sso)
                        return {
                            id: profile.sub,
                            name: profile.name || profile.preferred_username || profile.email,
                            email: profile.email,
                            role,
                            institutionId: institution.id
                        }
                    }
                })
            } else if (sso.type === 'saml') {
                console.log(`[Auth] Adding SAML provider via BoxyHQ: ${sso.issuer}`)
                providers.push({
                    id: 'boxyhq-saml',
                    name: institution.name,
                    type: 'oauth',
                    wellKnown: undefined,
                    issuer: sso.issuer,
                    clientId: sso.clientId,
                    clientSecret: sso.clientSecret,
                    checks: ["pkce", "state"],
                    authorization: {
                        url: `${sso.issuer}/api/oauth/authorize`,
                        params: {
                            provider: 'saml',
                        },
                    },
                    token: `${sso.issuer}/api/oauth/token`,
                    userinfo: `${sso.issuer}/api/oauth/userinfo`,
                    profile(profile: any) {
                        console.log(`[Auth] SAML Profile received:`, profile.email)
                        const role = resolveRoleFromProfile(profile, sso)
                        return {
                            id: profile.id || profile.sub,
                            name: profile.name || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email,
                            email: profile.email,
                            role,
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
                const existingUser = user?.id
                    ? await prisma.user.findUnique({ where: { id: user.id } })
                    : null
                if (existingUser?.archivedAt) {
                    return false
                }

                if (account?.provider === 'oidc' || account?.provider === 'boxyhq-saml') {
                    const institution = institutionId
                        ? await prisma.institution.findUnique({ where: { id: institutionId } })
                        : null

                    const ssoConfig = institution?.ssoConfig as SsoConfig | undefined
                    if (institution && ssoConfig) {
                        const role = resolveRoleFromProfile(profile, ssoConfig)
                        const name = profile?.name || profile?.preferred_username || user.name || user.email
                        await prisma.user.update({
                            where: { id: user.id },
                            data: {
                                role,
                                institutionId: institution.id,
                                name,
                            }
                        })
                    }
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
