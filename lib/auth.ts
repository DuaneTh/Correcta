/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment */
import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { safeJson } from "@/lib/logging"
import { resolveInstitutionIdFromCookieValue } from "@/lib/institutionCookie"
import { getClientIdentifier, hashRateLimitKey, rateLimit } from "@/lib/rateLimit"

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

export const buildAuthOptions = async (institutionCookieValue?: string): Promise<NextAuthOptions> => {
    const isProduction = process.env.NODE_ENV === 'production'
    const authDebug = !isProduction && process.env.AUTH_DEBUG === 'true'
    const allowDangerousEmailAccountLinking =
        !isProduction && process.env.AUTH_ALLOW_DANGEROUS_EMAIL_LINKING === 'true'

    const logAuth = (message: string, data?: Record<string, unknown>) => {
        if (!authDebug) return
        if (data) {
            console.log(message, safeJson(data))
            return
        }
        console.log(message)
    }

    const providers: any[] = [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials, req: any) {
                try {
                    const ip = req?.headers?.get
                        ? getClientIdentifier(req as Request)
                        : (req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'] || 'unknown')
                    const email = credentials?.email ?? ''
                    const key = hashRateLimitKey(`${ip}:${email}`)
                    const limit = await rateLimit(key, { windowSeconds: 60, max: 10, prefix: 'auth_login' })
                    if (!limit.ok) {
                        return null
                    }
                } catch {
                    return null
                }

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

    const institutionId = resolveInstitutionIdFromCookieValue(institutionCookieValue)

    if (institutionId) {
        logAuth('[Auth] Building options for institution', { institutionId })
        const institution = await prisma.institution.findUnique({
            where: { id: institutionId }
        })

        if (institution?.ssoConfig) {
            const sso = institution.ssoConfig as SsoConfig
            logAuth('[Auth] Found SSO config type', { type: sso.type })
            if (sso.enabled === false) {
                logAuth('[Auth] SSO config disabled for institution', { institutionId })
            } else if (sso.type === 'oidc') {
                logAuth('[Auth] Adding OIDC provider', { institutionId })
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
                    allowDangerousEmailAccountLinking,
                    profile(profile: any) {
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
                logAuth('[Auth] Adding SAML provider', { institutionId })
                providers.push({
                    id: 'boxyhq-saml',
                    name: institution.name,
                    type: 'oauth',
                    wellKnown: undefined,
                    issuer: sso.issuer,
                    clientId: sso.clientId,
                    clientSecret: sso.clientSecret,
                    checks: ["pkce", "state"],
                    allowDangerousEmailAccountLinking,
                    authorization: {
                        url: `${sso.issuer}/api/oauth/authorize`,
                        params: {
                            provider: 'saml',
                        },
                    },
                    token: `${sso.issuer}/api/oauth/token`,
                    userinfo: `${sso.issuer}/api/oauth/userinfo`,
                    profile(profile: any) {
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
            logAuth('[Auth] No SSO config found for institution', { institutionId })
        }
    } else {
        logAuth('[Auth] No institutionId provided')
    }

    return {
        debug: authDebug,
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
