'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const [step, setStep] = useState<'EMAIL' | 'PASSWORD'>('EMAIL')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        console.log('[Login] Handling email submit:', email)
        setLoading(true)
        setError('')

        try {
            console.log('[Login] Fetching lookup...')
            const res = await fetch('/api/auth/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            })
            const data = await res.json()
            console.log('[Login] Lookup response:', data)

            if (data.error) {
                setError(data.error)
                setLoading(false)
                return
            }

            if (data.type === 'SSO') {
                console.log('[Login] SSO detected, redirecting...')
                // Set cookie for the institution
                document.cookie = `correcta-institution=${data.institutionId}; path=/; max-age=300`
                // Redirect to SSO
                const result = await signIn('oidc', { callbackUrl: '/dashboard', redirect: false })
                console.log('[Login] SSO SignIn Result:', result)
                if (result?.url) {
                    window.location.href = result.url
                }
            } else if (data.type === 'CREDENTIALS') {
                console.log('[Login] Credentials detected, showing password field')
                setStep('PASSWORD')
                setLoading(false)
            } else {
                // Fallback
                console.log('[Login] Unknown type, defaulting to password')
                setStep('PASSWORD')
                setLoading(false)
            }
        } catch (err) {
            console.error('[Login] Lookup failed, falling back to password', err)
            // Fallback to password mode if lookup fails (e.g. DB down, network issue)
            setStep('PASSWORD')
            setLoading(false)
        }
    }

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        console.log('[Login] Submitting password for:', email)

        const res = await signIn('credentials', {
            email,
            password,
            redirect: false
        })

        console.log('[Login] SignIn result:', res)

        if (res?.error) {
            setError('Invalid credentials')
            setLoading(false)
        } else {
            router.push('/dashboard')
        }
    }

    if (!mounted) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-100">Loading...</div>
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-96">
                <h1 className="text-2xl font-bold mb-6 text-center">Correcta Login</h1>
                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

                {step === 'EMAIL' ? (
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                required
                                placeholder="name@school.edu"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {loading ? 'Checking...' : 'Next'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <div>
                            <p className="text-sm text-gray-500 mb-2">Signing in as {email}</p>
                            <label className="block text-sm font-medium text-gray-700">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setStep('EMAIL'); setError(''); }}
                            className="w-full text-sm text-indigo-600 hover:text-indigo-500"
                        >
                            Back to email
                        </button>
                    </form>
                )}

                <div className="mt-6 text-center text-xs text-gray-400">
                    <p>Test SSO: prof@demo-sso.edu</p>
                    <p>Test Admin: admin@demo.edu</p>
                </div>
            </div>
        </div>
    )
}
