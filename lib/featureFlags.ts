/**
 * Centralized feature flag configuration.
 *
 * All feature flags are environment-variable based (FEATURE_* or ENABLE_*).
 * Default values are specified here so the behaviour is explicit and documented.
 *
 * Usage:
 * ```ts
 * import { flags } from '@/lib/featureFlags'
 * if (flags.gradingQueue) { ... }
 * ```
 */

const isTrue = (value: string | undefined): boolean => value === 'true'

const isProduction = process.env.NODE_ENV === 'production'

export const flags = {
    /** Queue-based AI grading (requires Redis + worker process) */
    gradingQueue: isTrue(process.env.ENABLE_GRADING_QUEUE),

    /** Enforce Content-Security-Policy (vs Report-Only) */
    cspEnforce: isTrue(process.env.CSP_ENFORCE),

    /** CSRF protection (defaults to on in production) */
    csrf: process.env.CSRF_ENABLED !== undefined
        ? isTrue(process.env.CSRF_ENABLED)
        : isProduction,

    /** Rate limiting (defaults to on) */
    rateLimit: process.env.RATE_LIMIT_ENABLED !== 'false',

    /** Allow camera access in Permissions-Policy */
    allowCamera: isTrue(process.env.SECURITY_ALLOW_CAMERA),

    /** Allow microphone access in Permissions-Policy */
    allowMicrophone: isTrue(process.env.SECURITY_ALLOW_MICROPHONE),
} as const
