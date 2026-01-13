import test from 'node:test'
import assert from 'node:assert/strict'
import { redactEmail, safeJson } from '../lib/logging'

test('redactEmail masks local part', () => {
    assert.equal(redactEmail('alice@example.com'), 'a***@example.com')
})

test('safeJson removes sensitive keys', () => {
    const input = {
        email: 'alice@example.com',
        name: 'Alice',
        token: 'secret',
        nested: {
            access_token: 'access',
            id_token: 'id',
            refresh_token: 'refresh',
            ok: true
        }
    }
    const output = safeJson(input) as Record<string, unknown>

    assert.equal(output.email, '[REDACTED]')
    assert.equal(output.name, '[REDACTED]')
    assert.equal(output.token, '[REDACTED]')
    assert.deepEqual(output.nested, {
        access_token: '[REDACTED]',
        id_token: '[REDACTED]',
        refresh_token: '[REDACTED]',
        ok: true
    })
})
