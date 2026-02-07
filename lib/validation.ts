/**
 * Lightweight client-side form validation utilities.
 *
 * Usage:
 * ```ts
 * const errors = validateFields({
 *     email: [required('Email requis'), email('Email invalide')],
 *     password: [required(), minLength(8, 'Min 8 caractères')],
 *     confirm: [required(), matches(password, 'Ne correspond pas')],
 * })
 * // errors = { email: 'Email invalide', password: null, confirm: null }
 * ```
 */

/** A rule returns an error message string, or null if valid. */
export type ValidationRule = (value: string) => string | null

// ── Rule factories ──────────────────────────────────────────────────

/** Value must not be empty after trimming. */
export function required(message = 'Required'): ValidationRule {
    return (v) => (v.trim() ? null : message)
}

/** Value must be at least `n` characters. */
export function minLength(n: number, message?: string): ValidationRule {
    return (v) => (v.length >= n ? null : message ?? `Min ${n} characters`)
}

/** Value must match `other` exactly. */
export function matches(other: string, message = 'Values do not match'): ValidationRule {
    return (v) => (v === other ? null : message)
}

/** Value must look like an email address. */
export function email(message = 'Invalid email'): ValidationRule {
    return (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : message)
}

/** Value must be a positive number. */
export function positiveNumber(message = 'Must be a positive number'): ValidationRule {
    return (v) => {
        const n = Number(v)
        return !isNaN(n) && n > 0 ? null : message
    }
}

/** Custom predicate rule. */
export function predicate(test: (v: string) => boolean, message: string): ValidationRule {
    return (v) => (test(v) ? null : message)
}

// ── Validation runner ───────────────────────────────────────────────

type FieldRules = Record<string, ValidationRule[]>
type FieldErrors<T extends FieldRules> = Record<keyof T, string | null>

/**
 * Run validation rules against field values.
 * Returns a map of field → first error message (or null if valid).
 *
 * `values` is a record of field name → current string value.
 * `rules` is a record of field name → array of rules to check in order.
 */
export function validateFields<T extends FieldRules>(
    values: Record<keyof T, string>,
    rules: T
): { errors: FieldErrors<T>; valid: boolean } {
    const errors = {} as FieldErrors<T>
    let valid = true

    for (const field of Object.keys(rules) as Array<keyof T>) {
        const value = values[field] ?? ''
        let fieldError: string | null = null

        for (const rule of rules[field] as ValidationRule[]) {
            const result = rule(value as string)
            if (result) {
                fieldError = result
                break // first error wins
            }
        }

        errors[field] = fieldError
        if (fieldError) valid = false
    }

    return { errors, valid }
}
