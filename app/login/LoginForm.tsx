'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { setLocale } from '@/app/actions/locale'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/config'

interface LoginFormProps {
    dictionary: Dictionary
    initialLocale: Locale
}

export default function LoginForm({ dictionary, initialLocale }: LoginFormProps) {
    const router = useRouter()
    const [step, setStep] = useState<'EMAIL' | 'PASSWORD'>('EMAIL')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [currentLocale, setCurrentLocale] = useState<Locale>(initialLocale)

    const passwordInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (step === 'PASSWORD' && passwordInputRef.current) {
            passwordInputRef.current.focus()
        }
    }, [step])

    const handleLanguageSwitch = async (locale: Locale) => {
        await setLocale(locale)
        setCurrentLocale(locale)
        router.refresh()
    }

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
                document.cookie = `correcta-institution=${data.institutionId}; path=/; max-age=300`
                const provider = data.provider || 'oidc'
                const result = await signIn(provider, { callbackUrl: '/auth/redirect', redirect: false })
                console.log('[Login] SSO SignIn Result:', result)
                if (result?.url) {
                    window.location.href = result.url
                }
            } else if (data.type === 'CREDENTIALS') {
                console.log('[Login] Credentials detected, showing password field')
                setStep('PASSWORD')
                setLoading(false)
            } else {
                console.log('[Login] Unknown type, defaulting to password')
                setStep('PASSWORD')
                setLoading(false)
            }
        } catch (err) {
            console.error('[Login] Lookup failed, falling back to password', err)
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
            const sessionRes = await fetch('/api/auth/session')
            const session = await sessionRes.json()

            console.log('[Login] Session after signin:', session)

            if (session?.user?.role === 'STUDENT') {
                router.push('/student/courses')
            } else if (session?.user?.role === 'TEACHER') {
                router.push('/teacher/courses')
            } else if (session?.user?.role === 'SCHOOL_ADMIN' || session?.user?.role === 'PLATFORM_ADMIN') {
                router.push('/admin')
            } else {
                router.push('/login')
            }
        }
    }

    const dict = dictionary.login

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-96 relative">
                <div className="absolute top-4 right-4 flex items-center gap-2 text-sm">
                    <button
                        onClick={() => handleLanguageSwitch('fr')}
                        className={currentLocale === 'fr' ? 'font-bold text-brand-900 cursor-default' : 'text-gray-500 hover:text-gray-700 cursor-pointer'}
                    >
                        {dictionary.common.languageFr}
                    </button>
                    <span className="text-gray-400">|</span>
                    <button
                        onClick={() => handleLanguageSwitch('en')}
                        className={currentLocale === 'en' ? 'font-bold text-brand-900 cursor-default' : 'text-gray-500 hover:text-gray-700 cursor-pointer'}
                    >
                        {dictionary.common.languageEn}
                    </button>
                </div>
                <div className="mb-6 text-center">
                    <div className="flex justify-center">
                        <Image
                            src="/brand/correcta-logo-header.png"
                            alt="Correcta"
                            width={140}
                            height={36}
                            className="h-6 w-auto"
                            priority
                        />
                    </div>
                    <p className="mt-2 text-lg font-semibold text-brand-900">{dict.subtitle}</p>
                </div>
                {error && (
                    <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {dict.errorInvalidCredentials}
                    </div>
                )}

                {step === 'EMAIL' ? (
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{dict.emailLabel}</label>
                            <input
                                type="email"
                                autoFocus
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-900 focus:ring-brand-900 text-gray-900 placeholder:text-gray-500 sm:text-sm p-2 border"
                                required
                                placeholder={dict.emailPlaceholder}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-brand-900 text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-900 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loading ? dict.checkingButton : dict.nextButton}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <div>
                            <p className="text-sm text-gray-500 mb-2">{dict.signingInAs} {email}</p>
                            <label className="block text-sm font-medium text-gray-700">{dict.passwordLabel}</label>
                            <input
                                ref={passwordInputRef}
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-900 focus:ring-brand-900 text-gray-900 placeholder:text-gray-500 sm:text-sm p-2 border"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-brand-900 text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-900 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loading ? dict.signingInButton : dict.signInButton}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setStep('EMAIL'); setError(''); }}
                            className="w-full text-sm text-brand-900 hover:text-brand-700"
                        >
                            {dict.backButton}
                        </button>
                    </form>
                )}

                <div className="mt-6 text-center text-sm text-gray-700" />
            </div>
        </div>
    )
}
