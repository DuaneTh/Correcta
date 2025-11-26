import type { Metadata } from "next"
import UserMenu from "@/components/UserMenu"
import Link from "next/link"

export const metadata: Metadata = {
    title: "Dashboard - Correcta",
    description: "Teacher Dashboard",
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-8">
                            <Link href="/dashboard" className="text-xl font-bold text-gray-900">
                                Correcta
                            </Link>
                            <nav className="hidden md:flex gap-6">
                                <Link
                                    href="/dashboard"
                                    className="text-gray-700 hover:text-gray-900 text-sm font-medium"
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    href="/dashboard/exams"
                                    className="text-gray-700 hover:text-gray-900 text-sm font-medium"
                                >
                                    Examens
                                </Link>
                            </nav>
                        </div>
                        <UserMenu />
                    </div>
                </div>
            </header>
            <main>
                {children}
            </main>
        </div>
    )
}
