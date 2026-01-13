import test from 'node:test'
import assert from 'node:assert/strict'
import { signInstitutionId, verifyInstitutionCookieValue, resolveInstitutionIdFromCookieValue } from '../lib/institutionCookie'

test('signInstitutionId + verifyInstitutionCookieValue round trip', () => {
    process.env.INSTITUTION_COOKIE_SECRET = 'test-secret'
    const signed = signInstitutionId('11111111-1111-1111-1111-111111111111')
    const verified = verifyInstitutionCookieValue(signed)
    assert.equal(verified, '11111111-1111-1111-1111-111111111111')
})

test('verifyInstitutionCookieValue rejects tampering', () => {
    process.env.INSTITUTION_COOKIE_SECRET = 'test-secret'
    const signed = signInstitutionId('22222222-2222-2222-2222-222222222222')
    const tampered = signed.replace('2222', '3333')
    const verified = verifyInstitutionCookieValue(tampered)
    assert.equal(verified, null)
})

test('resolveInstitutionIdFromCookieValue rejects invalid format', () => {
    process.env.INSTITUTION_COOKIE_SECRET = 'test-secret'
    const result = resolveInstitutionIdFromCookieValue('not-a-valid-id')
    assert.equal(result, undefined)
})
