'use client'

import UserMenu from "@/components/UserMenu"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import type { Dictionary } from "@/lib/i18n/dictionaries"
import type { Locale } from "@/lib/i18n/config"

interface TeacherLayoutClientProps {
    children: React.ReactNode
    dictionary: Dictionary
    currentLocale: Locale
}

export default function TeacherLayoutClient({ children, dictionary, currentLocale }: TeacherLayoutClientProps) {
    const pathname = usePathname()

    const navLinks = [
        { href: '/teacher/courses', label: dictionary.teacher.header.myCourses },
        { href: '/teacher/exams', label: dictionary.teacher.header.exams },
        { href: '/teacher/corrections', label: dictionary.teacher.header.corrections },
    ]

    const isActive = (href: string) => {
        return pathname === href || pathname.startsWith(href + '/')
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-8">
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
                                {navLinks.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`relative text-sm font-medium transition-colors ${isActive(link.href)
                                            ? 'text-brand-900 after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-[2px] after:rounded-full after:bg-brand-900'
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
