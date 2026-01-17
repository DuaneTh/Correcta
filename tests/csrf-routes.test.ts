import test from 'node:test'
import assert from 'node:assert/strict'
import Module from 'node:module'
import path from 'node:path'

const env = process.env as Record<string, string | undefined>

const withCsrfEnabled = async (fn: () => void | Promise<void>) => {
    const originalEnabled = env.CSRF_ENABLED
    const originalNodeEnv = env.NODE_ENV
    env.CSRF_ENABLED = 'true'
    env.NODE_ENV = 'test'
    await fn()
    if (originalEnabled === undefined) {
        delete env.CSRF_ENABLED
    } else {
        env.CSRF_ENABLED = originalEnabled
    }
    if (originalNodeEnv === undefined) {
        delete env.NODE_ENV
    } else {
        env.NODE_ENV = originalNodeEnv
    }
}

test('POST /api/exams rejects missing CSRF token', async () => {
    await withCsrfEnabled(async () => {
        const moduleApi = Module as unknown as {
            _load: (request: string, parent: unknown, isMain: boolean) => unknown
        }
        const originalLoad = moduleApi._load
        moduleApi._load = function (request: string, parent: unknown, isMain: boolean) {
            if (request === 'next-auth') {
                return {
                    getServerSession: async () => ({
                        user: { id: 'user-1', role: 'TEACHER', institutionId: 'inst-1' }
                    })
                }
            }
            if (request === '@/lib/auth') {
                return {
                    buildAuthOptions: async () => ({})
                }
            }
            if (request.startsWith('@/')) {
                const resolved = path.join(process.cwd(), '.test-dist', request.slice(2))
                return originalLoad(resolved, parent, isMain)
            }
            return originalLoad(request, parent, isMain)
        }

        try {
            const { POST } = await import('../app/api/exams/route')
            const req = new Request('https://example.com/api/exams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            })

            const res = await POST(req)
            assert.equal(res.status, 403)
        } finally {
            moduleApi._load = originalLoad
        }
    })
})
