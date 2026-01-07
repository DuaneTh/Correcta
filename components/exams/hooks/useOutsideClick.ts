import { useEffect, RefObject } from 'react'

export function useOutsideClick<T extends HTMLElement>(
    ref: RefObject<T>,
    isActive: boolean,
    onClose: () => void
) {
    useEffect(() => {
        if (!isActive) return
        const handleClick = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [isActive, onClose, ref])
}

