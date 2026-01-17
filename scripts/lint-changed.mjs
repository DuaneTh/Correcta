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

const eslintResult = spawnSync(process.execPath, [eslintBin, ...filtered], { stdio: 'inherit' })
if (eslintResult.error) {
    console.error('[lint] eslint execution failed', eslintResult.error.message)
    process.exit(1)
}
process.exit(eslintResult.status ?? 1)
