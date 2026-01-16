import { RefObject, useEffect } from 'react'

export function useColumnHeightSync(
    separatorRef: RefObject<HTMLDivElement | null>,
    leftRef: RefObject<HTMLDivElement | null>,
    rightRef: RefObject<HTMLDivElement | null>
) {
    useEffect(() => {
        const separatorEl = separatorRef.current
        const leftEl = leftRef.current
        const rightEl = rightRef.current
        if (!separatorEl || (!leftEl && !rightEl)) return
        if (typeof ResizeObserver === 'undefined') return

        const updateHeight = () => {
            const separatorElCurrent = separatorRef.current
            if (!separatorElCurrent) return
            const leftHeight = leftRef.current?.scrollHeight ?? 0
            const rightHeight = rightRef.current?.scrollHeight ?? 0
            const maxHeight = Math.max(leftHeight, rightHeight, 200)
            separatorElCurrent.style.height = `${maxHeight}px`
        }

        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(updateHeight)
        })

        if (leftEl) resizeObserver.observe(leftEl)
        if (rightEl) resizeObserver.observe(rightEl)

        updateHeight()

        return () => {
            resizeObserver.disconnect()
        }
    }, [separatorRef, leftRef, rightRef])
}
