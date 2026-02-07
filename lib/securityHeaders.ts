type SecurityHeadersOptions = {
    isProduction: boolean
    enforceCsp: boolean
    allowCamera: boolean
    allowMicrophone: boolean
}

const buildCsp = (options: SecurityHeadersOptions): string => {
    const isDev = !options.isProduction
    const scriptSrc = [
        `'self'`,
        ...(isDev ? [`'unsafe-eval'`] : [])
    ]
    const styleSrc = [`'self'`, `'unsafe-inline'`]
    const connectSrc = [
        `'self'`,
        ...(isDev ? ['ws:', 'wss:'] : []),
        'https://*.ingest.sentry.io'
    ]

    return [
        `default-src 'self'`,
        `base-uri 'self'`,
        `object-src 'none'`,
        `frame-ancestors 'none'`,
        `form-action 'self'`,
        `script-src ${scriptSrc.join(' ')}`,
        `style-src ${styleSrc.join(' ')}`,
        `img-src 'self' data: blob: https://*.s3.eu-west-3.amazonaws.com`,
        `font-src 'self' data:`,
        `connect-src ${connectSrc.join(' ')}`
    ].join('; ')
}

export function getSecurityHeaders(
    options: SecurityHeadersOptions
): Array<{ key: string; value: string }> {
    const permissions = [
        `camera=${options.allowCamera ? '(self)' : '()'}`,
        `microphone=${options.allowMicrophone ? '(self)' : '()'}`,
        'geolocation=()',
        'payment=()',
        'usb=()'
    ]

    const headers: Array<{ key: string; value: string }> = [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: permissions.join(', ') },
        { key: 'X-Frame-Options', value: 'DENY' }
    ]

    if (options.isProduction) {
        headers.push({
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
        })
    }

    const csp = buildCsp(options)
    headers.push({
        key: options.enforceCsp ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
        value: csp
    })

    return headers
}
