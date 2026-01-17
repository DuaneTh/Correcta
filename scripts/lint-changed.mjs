import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const excludedPrefixes = [
    'node_modules/',
    '.next/',
    '.test-dist/',
    'dist/',
    'build/',
    'coverage/',
    'tmp/',
]

const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const includeLocal = process.argv.includes('--include-local')

const runGitDiff = (args) => {
    const result = spawnSync('git', args, { encoding: 'utf8' })
    if (result.status !== 0) {
        return null
    }
    return result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
}

const runGitDiffWithBase = (baseRef) => {
    const args = ['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`]
    const result = spawnSync('git', args, { encoding: 'utf8' })
    if (result.status !== 0) {
        return null
    }
    return result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
}

let changedFiles = runGitDiffWithBase('origin/main')
if (!changedFiles) {
    changedFiles = runGitDiffWithBase('main')
}

if (!changedFiles) {
    console.log('[lint] unable to compute changed files from git')
    process.exit(1)
}

const workingTreeChanges = includeLocal
    ? runGitDiff(['diff', '--name-only', '--diff-filter=ACMR']) ?? []
    : []
const stagedChanges = includeLocal
    ? runGitDiff(['diff', '--name-only', '--diff-filter=ACMR', '--cached']) ?? []
    : []
const untracked = includeLocal
    ? runGitDiff(['ls-files', '--others', '--exclude-standard']) ?? []
    : []

const combined = [...changedFiles, ...workingTreeChanges, ...stagedChanges, ...untracked]
const filtered = Array.from(new Set(combined))
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => allowedExtensions.has(path.extname(file)))
    .filter((file) => !excludedPrefixes.some((prefix) => file.startsWith(prefix)))

if (filtered.length === 0) {
    console.log('[lint] no changed files')
    process.exit(0)
}

const eslintBin = path.join('node_modules', 'eslint', 'bin', 'eslint.js')

if (!existsSync(eslintBin)) {
    console.log('[lint] eslint binary not found at', eslintBin)
    process.exit(1)
}

console.log(`[lint] linting ${filtered.length} file(s)`)

const eslintArgs = [eslintBin, '--format', 'json', ...filtered]
const eslintResult = spawnSync(process.execPath, eslintArgs, { encoding: 'utf8' })
if (eslintResult.error) {
    console.error('[lint] eslint execution failed', eslintResult.error.message)
    process.exit(1)
}

let errorCount = null
let warningCount = null
let parsedOk = false
try {
    const parsed = JSON.parse(eslintResult.stdout ?? '[]')
    if (Array.isArray(parsed)) {
        const totals = parsed.reduce(
            (acc, entry) => {
                acc.errorCount += entry?.errorCount ?? 0
                acc.warningCount += entry?.warningCount ?? 0
                return acc
            },
            { errorCount: 0, warningCount: 0 }
        )
        errorCount = totals.errorCount
        warningCount = totals.warningCount
        parsedOk = true
    }
} catch {
    // Ignore JSON parse errors; keep default output.
}

if (!parsedOk && eslintResult.stdout) {
    process.stdout.write(eslintResult.stdout)
}
if (eslintResult.stderr) {
    process.stderr.write(eslintResult.stderr)
}

if (errorCount !== null && warningCount !== null) {
    console.log(`[lint] summary: ${errorCount} error(s), ${warningCount} warning(s)`)
}

const status = eslintResult.status ?? 1
if (status === 0) {
    console.log('[lint] PASS')
} else {
    console.log(`[lint] FAIL (code ${status})`)
}

process.exit(status)
