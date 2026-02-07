'use client'

import { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react'
import { cn } from './cn'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

type Toast = {
    id: string
    message: string
    variant: ToastVariant
    duration: number
}

type ToastContextValue = {
    toast: (message: string, variant?: ToastVariant, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast must be used within ToastProvider')
    return ctx
}

let toastCounter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const toast = useCallback((message: string, variant: ToastVariant = 'info', duration = 4000) => {
        const id = `toast-${++toastCounter}`
        setToasts(prev => [...prev, { id, message, variant, duration }])
    }, [])

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
                ))}
            </div>
        </ToastContext.Provider>
    )
}

const icons: Record<ToastVariant, React.ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />,
    error: <XCircle className="w-5 h-5 text-red-500 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
}

const variantClasses: Record<ToastVariant, string> = {
    success: 'border-emerald-200 bg-emerald-50',
    error: 'border-red-200 bg-red-50',
    warning: 'border-amber-200 bg-amber-50',
    info: 'border-blue-200 bg-blue-50',
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
    const [visible, setVisible] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    useEffect(() => {
        // Trigger enter animation
        requestAnimationFrame(() => setVisible(true))

        timerRef.current = setTimeout(() => {
            setVisible(false)
            setTimeout(() => onDismiss(toast.id), 200)
        }, toast.duration)

        return () => clearTimeout(timerRef.current)
    }, [toast.id, toast.duration, onDismiss])

    const handleDismiss = () => {
        clearTimeout(timerRef.current)
        setVisible(false)
        setTimeout(() => onDismiss(toast.id), 200)
    }

    return (
        <div
            role="alert"
            className={cn(
                'pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg max-w-sm',
                'transition-all duration-200',
                visible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0',
                variantClasses[toast.variant]
            )}
        >
            {icons[toast.variant]}
            <p className="text-sm text-gray-800 flex-1">{toast.message}</p>
            <button
                onClick={handleDismiss}
                className="shrink-0 text-gray-400 hover:text-gray-600"
                aria-label="Dismiss"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    )
}
