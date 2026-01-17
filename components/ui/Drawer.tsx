'use client'

import { useEffect, useRef } from 'react'

type DrawerProps = {
    open: boolean
    title: string
    onClose: () => void
    children: React.ReactNode
    returnFocusRef?: React.RefObject<HTMLElement | null>
    closeOnOverlayClick?: boolean
}

const getFocusable = (container: HTMLElement | null): HTMLElement[] => {
    if (!container) return []
    const selectors = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ]
    return Array.from(container.querySelectorAll<HTMLElement>(selectors.join(',')))
}

export default function Drawer({
    open,
    title,
    onClose,
    children,
    returnFocusRef,
    closeOnOverlayClick = true,
}: DrawerProps) {
    const panelRef = useRef<HTMLDivElement | null>(null)
    const closeRef = useRef<HTMLButtonElement | null>(null)
    const previousOverflow = useRef<string | null>(null)

    useEffect(() => {
        if (!open) return
        closeRef.current?.focus()
        previousOverflow.current = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
            }
        }
        document.addEventListener('keydown', handleKey)
        return () => {
            document.removeEventListener('keydown', handleKey)
            document.body.style.overflow = previousOverflow.current ?? ''
            if (returnFocusRef?.current) {
                returnFocusRef.current.focus()
            }
        }
    }, [open, onClose, returnFocusRef])

    const handleTrap = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Tab') return
        const focusable = getFocusable(panelRef.current)
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
        }
    }

    if (!open) {
        return null
    }

    return (
        <div
            className="fixed inset-0 z-50 flex justify-end bg-black/30"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={closeOnOverlayClick ? onClose : undefined}
        >
            <div
                ref={panelRef}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={handleTrap}
                className="flex h-full w-[420px] flex-col border-l border-gray-200 bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                    <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {children}
                </div>
            </div>
        </div>
    )
}
