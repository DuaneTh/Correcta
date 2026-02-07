import test from 'node:test'
import assert from 'node:assert/strict'
import {
    required,
    minLength,
    matches,
    email,
    positiveNumber,
    predicate,
    validateFields,
} from '../lib/validation'

// ── Rule factories ──────────────────────────────────────────────────

test('required rejects empty string', () => {
    assert.equal(required('oops')(''), 'oops')
    assert.equal(required('oops')('  '), 'oops')
})

test('required accepts non-empty string', () => {
    assert.equal(required()('hello'), null)
})

test('minLength rejects short string', () => {
    assert.equal(minLength(8)('abc'), 'Min 8 characters')
    assert.equal(minLength(8, 'too short')('abc'), 'too short')
})

test('minLength accepts long enough string', () => {
    assert.equal(minLength(3)('abc'), null)
    assert.equal(minLength(3)('abcd'), null)
})

test('matches rejects mismatch', () => {
    assert.equal(matches('secret', 'no match')('wrong'), 'no match')
})

test('matches accepts exact match', () => {
    assert.equal(matches('secret')('secret'), null)
})

test('email rejects invalid emails', () => {
    assert.notEqual(email()(''), null)
    assert.notEqual(email()('nope'), null)
    assert.notEqual(email()('a@'), null)
    assert.notEqual(email()('@b.com'), null)
})

test('email accepts valid emails', () => {
    assert.equal(email()('user@example.com'), null)
    assert.equal(email()('a@b.co'), null)
})

test('positiveNumber rejects non-positive values', () => {
    assert.notEqual(positiveNumber()(''), null)
    assert.notEqual(positiveNumber()('0'), null)
    assert.notEqual(positiveNumber()('-1'), null)
    assert.notEqual(positiveNumber()('abc'), null)
})

test('positiveNumber accepts positive values', () => {
    assert.equal(positiveNumber()('1'), null)
    assert.equal(positiveNumber()('3.14'), null)
})

test('predicate custom rule', () => {
    const noSpaces = predicate((v) => !v.includes(' '), 'no spaces')
    assert.equal(noSpaces('hello'), null)
    assert.equal(noSpaces('he llo'), 'no spaces')
})

// ── validateFields ──────────────────────────────────────────────────

test('validateFields returns valid when all pass', () => {
    const { errors, valid } = validateFields(
        { name: 'Alice', age: '25' },
        { name: [required()], age: [required(), positiveNumber()] }
    )
    assert.equal(valid, true)
    assert.equal(errors.name, null)
    assert.equal(errors.age, null)
})

test('validateFields returns first error per field', () => {
    const { errors, valid } = validateFields(
        { name: '', pw: 'ab' },
        {
            name: [required('name required')],
            pw: [required(), minLength(8, 'too short')],
        }
    )
    assert.equal(valid, false)
    assert.equal(errors.name, 'name required')
    assert.equal(errors.pw, 'too short')
})

test('validateFields stops at first failing rule', () => {
    const { errors } = validateFields(
        { email: '' },
        { email: [required('required'), email('bad email')] }
    )
    // Should get 'required', not 'bad email'
    assert.equal(errors.email, 'required')
})
