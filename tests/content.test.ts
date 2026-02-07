import test from 'node:test'
import assert from 'node:assert/strict'
import {
    parseContent,
    serializeContent,
    segmentsToLatexString,
    segmentsToPlainText,
    stringToSegments,
    createTextSegment,
    createMathSegment,
} from '../lib/content'

// ── parseContent ────────────────────────────────────────────────────

test('parseContent with null returns default text segment', () => {
    const result = parseContent(null)
    assert.equal(result.length, 1)
    assert.equal(result[0].type, 'text')
})

test('parseContent with empty string returns default text segment', () => {
    const result = parseContent('')
    assert.equal(result.length, 1)
    assert.equal(result[0].type, 'text')
    assert.equal((result[0] as { text: string }).text, '')
})

test('parseContent with plain string returns text segment', () => {
    const result = parseContent('hello world')
    assert.equal(result.length, 1)
    assert.equal(result[0].type, 'text')
    assert.equal((result[0] as { text: string }).text, 'hello world')
})

test('parseContent with JSON string of segments', () => {
    const json = JSON.stringify([{ type: 'text', text: 'hello', id: 'a' }])
    const result = parseContent(json)
    assert.equal(result.length, 1)
    assert.equal(result[0].type, 'text')
    assert.equal((result[0] as { text: string }).text, 'hello')
})

test('parseContent with array of segments', () => {
    const segments = [
        { type: 'text' as const, text: 'hi', id: 'a' },
        { type: 'math' as const, latex: 'x^2', id: 'b' },
    ]
    const result = parseContent(segments)
    assert.equal(result.length, 2)
    assert.equal(result[0].type, 'text')
    assert.equal(result[1].type, 'math')
})

test('parseContent with empty array returns default segment', () => {
    const result = parseContent([])
    assert.equal(result.length, 1)
    assert.equal(result[0].type, 'text')
})

// ── segmentsToLatexString ───────────────────────────────────────────

test('segmentsToLatexString converts text + math', () => {
    const segments = [
        createTextSegment('Solve: '),
        createMathSegment('x^2 + 1'),
    ]
    assert.equal(segmentsToLatexString(segments), 'Solve: $x^2 + 1$')
})

test('segmentsToLatexString with empty array returns empty', () => {
    assert.equal(segmentsToLatexString([]), '')
})

test('segmentsToLatexString with null returns empty', () => {
    assert.equal(segmentsToLatexString(null as unknown as []), '')
})

// ── segmentsToPlainText ─────────────────────────────────────────────

test('segmentsToPlainText strips math delimiters', () => {
    const segments = [
        createTextSegment('f(x) = '),
        createMathSegment('x+1'),
    ]
    assert.equal(segmentsToPlainText(segments), 'f(x) = x+1')
})

// ── stringToSegments ────────────────────────────────────────────────

test('stringToSegments with plain text', () => {
    const result = stringToSegments('hello')
    assert.equal(result.length, 1)
    assert.equal(result[0].type, 'text')
    assert.equal((result[0] as { text: string }).text, 'hello')
})

test('stringToSegments with inline math', () => {
    const result = stringToSegments('Solve $x^2$')
    assert.equal(result.length, 2)
    assert.equal(result[0].type, 'text')
    assert.equal((result[0] as { text: string }).text, 'Solve ')
    assert.equal(result[1].type, 'math')
    assert.equal((result[1] as { latex: string }).latex, 'x^2')
})

test('stringToSegments with display math', () => {
    const result = stringToSegments('$$\\frac{1}{2}$$')
    assert.equal(result.length, 1)
    assert.equal(result[0].type, 'math')
    assert.equal((result[0] as { latex: string }).latex, '\\frac{1}{2}')
})

test('stringToSegments with empty string returns default', () => {
    const result = stringToSegments('')
    assert.equal(result.length, 1)
    assert.equal(result[0].type, 'text')
})

// ── serializeContent roundtrip ──────────────────────────────────────

test('serializeContent produces valid JSON', () => {
    const segments = [createTextSegment('hi'), createMathSegment('x')]
    const json = serializeContent(segments)
    const parsed = JSON.parse(json)
    assert.equal(parsed.length, 2)
    assert.equal(parsed[0].type, 'text')
    assert.equal(parsed[1].type, 'math')
})
