import { createHmac, timingSafeEqual } from 'node:crypto'

const INSTITUTION_ID_REGEX = /^[a-f0-9-]{36}$/i
const MAX_INSTITUTION_ID_LENGTH = 64

const getCookieSecret = (): string => {
    const secret = process.env.INSTITUTION_COOKIE_SECRET
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('INSTITUTION_COOKIE_SECRET is required in production')
        }
        return ''
    }
    return secret
}

const isInstitutionIdValid = (value: string): boolean => {
    if (!value || value.length > MAX_INSTITUTION_ID_LENGTH) return false
    return INSTITUTION_ID_REGEX.test(value)
}

const buildSignature = (value: string, secret: string): string =>
    createHmac('sha256', secret).update(value).digest('base64url')

export function signInstitutionId(value: string): string {
    if (!isInstitutionIdValid(value)) {
        throw new Error('Invalid institution id')
    }

    const secret = getCookieSecret()
    if (!secret) {
        throw new Error('INSTITUTION_COOKIE_SECRET is required to sign institution cookie')
    }

    const signature = buildSignature(value, secret)
    return `${value}.${signature}`
}

export function verifyInstitutionCookieValue(
    signedValue: string
): string | null {
    const secret = getCookieSecret()
    if (!secret) {
        return null
    }

    const parts = signedValue.split('.')
    if (parts.length !== 2) {
        return null
    }

    const [value, signature] = parts
    if (!isInstitutionIdValid(value)) {
        return null
    }

    const expected = buildSignature(value, secret)
    const expectedBuffer = Buffer.from(expected)
    const providedBuffer = Buffer.from(signature)

    if (expectedBuffer.length !== providedBuffer.length) {
        return null
    }

    if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
        return null
    }

    return value
}

export function resolveInstitutionIdFromCookieValue(
    cookieValue?: string | null
): string | undefined {
    if (!cookieValue) return undefined

    const verified = verifyInstitutionCookieValue(cookieValue)
    if (verified) {
        return verified
    }

    if (process.env.NODE_ENV !== 'production' && isInstitutionIdValid(cookieValue)) {
        return cookieValue
    }

    return undefined
}
