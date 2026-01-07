'use client'

import { signOut, useSession } from "next-auth/react"

export default function SignOutButton() {
    const { data: session } = useSession()

    const handleLogout = async () => {
        const isOidc = session?.user?.provider === 'oidc'

        if (isOidc) {
            // 1. Clear local NextAuth session without redirecting yet
            await signOut({ redirect: false })

            // 2. Redirect to Keycloak Logout
            const keycloakLogoutUrl = 'http://localhost:8080/realms/correcta-realm/protocol/openid-connect/logout'
            const params = new URLSearchParams({
                // Use root URL as it's more likely to be whitelisted than /login
                post_logout_redirect_uri: window.location.origin,
                client_id: 'correcta-client'
            })

            window.location.href = `${keycloakLogoutUrl}?${params.toString()}`
        } else {
            // Credentials logout - just clear session and redirect to login
            await signOut({ callbackUrl: '/login' })
        }
    }

    return (
        <button
            onClick={handleLogout}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
            Sign Out {session?.user?.email}
        </button>
    )
}
