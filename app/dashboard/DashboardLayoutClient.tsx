'use client'

import UserMenu from "@/components/UserMenu"
import { MobileNav } from "@/components/MobileNav"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import type { Dictionary } from "@/lib/i18n/dictionaries"
import type { Locale } from "@/lib/i18n/config"

interface DashboardLayoutClientProps {
    children: React.ReactNode
    dictionary: Dictionary
    currentLocale: Locale
}

export default function DashboardLayoutClient({
    children,
    dictionary,
    currentLocale,
}: DashboardLayoutClientProps) {
    const pathname = usePathname()
    const { data: session } = useSession()
    const role = session?.user?.role
    const isAdmin = role === 'PLATFORM_ADMIN' || role === 'SCHOOL_ADMIN'

    const isActive = (href: string) => {
        return pathname === href || pathname.startsWith(href + '/')
    }

    // Student header: use student nav links
    if (role === 'STUDENT') {
        const studentNavLinks = [
            { href: '/student/courses', label: 'Mes cours' },
            { href: '/student/next-exam', label: 'Prochain examen' },
        ]

        return (
            <div className="min-h-screen bg-gray-50">
                <header className="bg-white shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center h-16">
                            <div className="flex items-center gap-4 md:gap-8">
                                <MobileNav links={studentNavLinks} isActive={isActive} />
                                <Link href="/student/courses" className="flex items-center">
                                    <Image
                                        src="/brand/correcta-logo-header.png"
                                        alt="Correcta"
                                        width={140}
                                        height={36}
                                        className="h-6 w-auto"
                                        priority
                                    />
                                </Link>
                                <nav className="hidden md:flex gap-6">
                                    {studentNavLinks.map((link) => (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            className={`relative text-sm font-medium transition-colors ${isActive(link.href)
                                                ? 'text-[#000040] after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-[2px] after:rounded-full after:bg-[#000040]'
                                                : 'text-gray-700 hover:text-gray-900'
                                                }`}
                                        >
                                            {link.label}
                                        </Link>
                                    ))}
                                </nav>
                            </div>
                            <UserMenu dictionary={dictionary} currentLocale={currentLocale} />
                        </div>
                    </div>
                </header>
                <main>
                    {children}
                </main>
            </div>
        )
    }

    if (isAdmin) {
        const adminNavLinks = [
            { href: '/admin', label: dictionary.common.adminNav },
        ]

        return (
            <div className="min-h-screen bg-gray-50">
                <header className="bg-white shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center h-16">
                            <div className="flex items-center gap-4 md:gap-8">
                                <MobileNav links={adminNavLinks} isActive={isActive} />
                                <Link href="/admin" className="flex items-center">
                                    <Image
                                        src="/brand/correcta-logo-header.png"
                                        alt="Correcta"
                                        width={140}
                                        height={36}
                                        className="h-6 w-auto"
                                        priority
                                    />
                                </Link>
                                <nav className="hidden md:flex gap-6">
                                    {adminNavLinks.map((link) => (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            className={`relative text-sm font-medium transition-colors ${isActive(link.href)
                                                ? 'text-[#000040] after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-[2px] after:rounded-full after:bg-[#000040]'
                                                : 'text-gray-700 hover:text-gray-900'
                                                }`}
                                        >
                                            {link.label}
                                        </Link>
                                    ))}
                                </nav>
                            </div>
                            <UserMenu dictionary={dictionary} currentLocale={currentLocale} />
                        </div>
                    </div>
                </header>
                <main>
                    {children}
                </main>
            </div>
        )
    }

    // Teacher header: use teacher nav links (same as /teacher/layout)
    const teacherNavLinks = [
        { href: '/teacher/courses', label: dictionary.teacher.header.myCourses },
        { href: '/teacher/exams', label: dictionary.teacher.header.exams },
        { href: '/teacher/corrections', label: dictionary.teacher.header.corrections },
    ]

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4 md:gap-8">
                            <MobileNav links={teacherNavLinks} isActive={isActive} />
                            <Link href="/teacher/courses" className="flex items-center">
                                <Image
                                    src="/brand/correcta-logo-header.png"
                                    alt="Correcta"
                                    width={140}
                                    height={36}
                                    className="h-6 w-auto"
                                    priority
                                />
                            </Link>
                            <nav className="hidden md:flex gap-6">
                                {teacherNavLinks.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`relative text-sm font-medium transition-colors ${isActive(link.href)
                                            ? 'text-[#000040] after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-[2px] after:rounded-full after:bg-[#000040]'
                                            : 'text-gray-700 hover:text-gray-900'
                                            }`}
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                            </nav>
                        </div>
                        <UserMenu dictionary={dictionary} currentLocale={currentLocale} />
                    </div>
                </div>
            </header>
            <main>
                {children}
            </main>
        </div>
    )
}
