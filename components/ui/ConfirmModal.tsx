'use client'

import { useEffect, useRef } from 'react'

type ConfirmModalProps = {
    open: boolean
    title: string
    description: string
    confirmLabel: string
    cancelLabel: string
    onConfirm: () => void
    onCancel: () => void
    returnFocusRef?: React.RefObject<HTMLElement | null>
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

export default function ConfirmModal({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    returnFocusRef,
}: ConfirmModalProps) {
    const panelRef = useRef<HTMLDivElement | null>(null)
    const cancelRef = useRef<HTMLButtonElement | null>(null)
    const previousOverflow = useRef<string | null>(null)

    useEffect(() => {
        if (!open) return
        cancelRef.current?.focus()
        const previousOverflowValue = document.body.style.overflow
        const returnFocusEl = returnFocusRef?.current ?? null
        previousOverflow.current = previousOverflowValue
        document.body.style.overflow = 'hidden'
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onCancel()
            }
        }
        document.addEventListener('keydown', handleKey)
        return () => {
            document.removeEventListener('keydown', handleKey)
            document.body.style.overflow = previousOverflowValue
            returnFocusEl?.focus()
        }
    }, [open, onCancel, returnFocusRef])

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

    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={onCancel}
        >
            <div
                ref={panelRef}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={handleTrap}
                className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl"
            >
                <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                <p className="mt-2 text-sm text-gray-600">{description}</p>
                <div className="mt-6 flex justify-end gap-2">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={onCancel}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="rounded-md bg-brand-900 px-3 py-1.5 text-sm text-white hover:bg-brand-800"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
