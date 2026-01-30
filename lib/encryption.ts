import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

/**
 * Encryption utility for sensitive data storage
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 32

/**
 * Get or derive the encryption key from environment variable
 * Falls back to a derived key from a secret if ENCRYPTION_KEY is not set
 */
function getEncryptionKey(): Buffer {
    const envKey = process.env.ENCRYPTION_KEY

    if (envKey) {
        // If a 64-char hex key is provided, use it directly
        if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
            return Buffer.from(envKey, 'hex')
        }
        // Otherwise derive from the provided string
        const salt = process.env.ENCRYPTION_SALT || 'correcta-default-salt'
        return scryptSync(envKey, salt, 32)
    }

    // Fallback: derive from NEXTAUTH_SECRET (should always be set)
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) {
        throw new Error('ENCRYPTION_KEY or NEXTAUTH_SECRET must be set for encryption')
    }

    const salt = 'correcta-settings-encryption'
    return scryptSync(secret, salt, 32)
}

/**
 * Encrypt a string value
 * Returns a base64-encoded string containing: salt + iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
    const key = getEncryptionKey()
    const iv = randomBytes(IV_LENGTH)
    const salt = randomBytes(SALT_LENGTH)

    const cipher = createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(plaintext, 'utf8')
    encrypted = Buffer.concat([encrypted, cipher.final()])

    const authTag = cipher.getAuthTag()

    // Combine: salt + iv + authTag + ciphertext
    const combined = Buffer.concat([salt, iv, authTag, encrypted])

    return combined.toString('base64')
}

/**
 * Decrypt a string value
 * Expects a base64-encoded string containing: salt + iv + authTag + ciphertext
 */
export function decrypt(encryptedValue: string): string {
    const key = getEncryptionKey()
    const combined = Buffer.from(encryptedValue, 'base64')

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH)
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)
    const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(ciphertext)
    decrypted = Buffer.concat([decrypted, decipher.final()])

    return decrypted.toString('utf8')
}

/**
 * Mask a sensitive value for display (e.g., "sk-abc...xyz")
 */
export function maskApiKey(value: string, visibleChars: number = 4): string {
    if (!value || value.length <= visibleChars * 2) {
        return '••••••••'
    }

    const start = value.slice(0, visibleChars)
    const end = value.slice(-visibleChars)
    return `${start}${'•'.repeat(8)}${end}`
}
