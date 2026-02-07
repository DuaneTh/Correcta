'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

type NavLink = {
    href: string
    label: string
}

type MobileNavProps = {
    links: NavLink[]
    isActive: (href: string) => boolean
}

export function MobileNav({ links, isActive }: MobileNavProps) {
    const [open, setOpen] = useState(false)
    const pathname = usePathname()

    // Close on route change
    useEffect(() => { setOpen(false) }, [pathname])

    // Lock body scroll when open
    useEffect(() => {
        if (!open) return
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = prev }
    }, [open])

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="md:hidden p-2 -ml-2 text-gray-700 hover:text-gray-900"
                aria-label="Open menu"
            >
                <Menu className="w-5 h-5" />
            </button>

            {open && (
                <div className="fixed inset-0 z-50 md:hidden">
                    {/* Overlay */}
                    <div
                        className="absolute inset-0 bg-black/30"
                        onClick={() => setOpen(false)}
                    />
                    {/* Panel */}
                    <nav className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl flex flex-col">
                        <div className="flex items-center justify-between px-4 h-16 border-b border-gray-200">
                            <span className="font-semibold text-gray-900">Menu</span>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="p-2 text-gray-600 hover:text-gray-900"
                                aria-label="Close menu"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto py-4">
                            {links.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`block px-4 py-3 text-sm font-medium transition-colors ${
                                        isActive(link.href)
                                            ? 'text-brand-900 bg-indigo-50 border-l-2 border-brand-900'
                                            : 'text-gray-700 hover:bg-gray-50 border-l-2 border-transparent'
                                    }`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </nav>
                </div>
            )}
        </>
    )
}
