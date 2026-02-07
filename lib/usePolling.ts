import { useEffect, useRef } from 'react'

type UsePollingOptions = {
    /** Polling interval in milliseconds */
    intervalMs: number
    /** Set to false to pause polling (default: true) */
    enabled?: boolean
    /** Call the function immediately on mount / when enabled becomes true (default: true) */
    immediate?: boolean
}

/**
 * Generic polling hook. Calls `fn` on a fixed interval with proper cleanup.
 *
 * Uses `setTimeout` chains (not `setInterval`) so the next tick only starts
 * after the previous call completes, avoiding overlap on slow responses.
 *
 * @example
 * ```ts
 * usePolling(() => fetchStatus(), { intervalMs: 2000, enabled: isOpen })
 * ```
 */
export function usePolling(fn: () => void | Promise<void>, opts: UsePollingOptions) {
    const { intervalMs, enabled = true, immediate = true } = opts

    // Keep fn ref stable so callers don't need to memoize
    const fnRef = useRef(fn)
    fnRef.current = fn

    useEffect(() => {
        if (!enabled) return

        let timeoutId: ReturnType<typeof setTimeout>
        let stopped = false

        const tick = async () => {
            if (stopped) return
            try {
                await fnRef.current()
            } catch {
                // Errors are the caller's responsibility
            }
            if (!stopped) {
                timeoutId = setTimeout(tick, intervalMs)
            }
        }

        if (immediate) {
            tick()
        } else {
            timeoutId = setTimeout(tick, intervalMs)
        }

        return () => {
            stopped = true
            clearTimeout(timeoutId)
        }
    }, [intervalMs, enabled, immediate])
}
