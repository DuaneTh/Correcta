import test from 'node:test'
import assert from 'node:assert/strict'
import { getSecurityHeaders } from '../lib/securityHeaders'

const getHeaderValue = (headers: Array<{ key: string; value: string }>, key: string) =>
    headers.find((header) => header.key === key)?.value

test('getSecurityHeaders adds HSTS only in production', () => {
    const prodHeaders = getSecurityHeaders({
        isProduction: true,
        enforceCsp: false,
        allowCamera: false,
        allowMicrophone: false
    })
    const devHeaders = getSecurityHeaders({
        isProduction: false,
        enforceCsp: false,
        allowCamera: false,
        allowMicrophone: false
    })

    assert.ok(getHeaderValue(prodHeaders, 'Strict-Transport-Security'))
    assert.equal(getHeaderValue(devHeaders, 'Strict-Transport-Security'), undefined)
})

test('getSecurityHeaders includes CSP with required directives', () => {
    const headers = getSecurityHeaders({
        isProduction: true,
        enforceCsp: false,
        allowCamera: false,
        allowMicrophone: false
    })
    const csp = getHeaderValue(headers, 'Content-Security-Policy-Report-Only')
    assert.ok(csp?.includes("frame-ancestors 'none'"))
    assert.ok(csp?.includes("object-src 'none'"))
    assert.ok(csp?.includes("base-uri 'self'"))
})
