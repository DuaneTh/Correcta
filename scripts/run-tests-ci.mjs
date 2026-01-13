import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const workspaceRoot = process.cwd()
const distDir = path.join(workspaceRoot, '.test-dist')

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const collectTests = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectTests(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      files.push(fullPath)
    }
  }
  return files
}

await fs.rm(distDir, { recursive: true, force: true })
run('npx', ['tsc', '-p', 'tsconfig.tests.json'])

const testDir = path.join(distDir, 'tests')
const testFiles = await collectTests(testDir)
if (testFiles.length === 0) {
  console.error('No test files found in .test-dist/tests')
  process.exit(1)
}

run('node', ['--test', ...testFiles])
