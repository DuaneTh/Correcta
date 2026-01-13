import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessAttemptAction, canReadAttempt } from '../lib/attemptAuthorization'

const baseContext = {
    attemptStudentId: 'student-1',
    attemptInstitutionId: 'inst-1',
    teacherCanAccess: true
}

test('canReadAttempt allows student for own attempt and matching institution', () => {
    const allowed = canReadAttempt({
        ...baseContext,
        sessionUser: { id: 'student-1', role: 'STUDENT', institutionId: 'inst-1' }
    })

    assert.equal(allowed, true)
})

test('canReadAttempt blocks student for other attempt', () => {
    const allowed = canReadAttempt({
        ...baseContext,
        sessionUser: { id: 'student-2', role: 'STUDENT', institutionId: 'inst-1' }
    })

    assert.equal(allowed, false)
})

test('canReadAttempt blocks on institution mismatch', () => {
    const allowed = canReadAttempt({
        ...baseContext,
        sessionUser: { id: 'student-1', role: 'STUDENT', institutionId: 'inst-2' }
    })

    assert.equal(allowed, false)
})

test('canReadAttempt blocks teacher when institution mismatch', () => {
    const allowed = canReadAttempt({
        ...baseContext,
        sessionUser: { id: 'teacher-1', role: 'TEACHER', institutionId: 'inst-2' }
    })

    assert.equal(allowed, false)
})

test('canReadAttempt allows admin when institution matches', () => {
    const allowed = canReadAttempt({
        ...baseContext,
        sessionUser: { id: 'admin-1', role: 'SCHOOL_ADMIN', institutionId: 'inst-1' }
    })

    assert.equal(allowed, true)
})

test('canReadAttempt blocks admin when institution mismatches', () => {
    const allowed = canReadAttempt({
        ...baseContext,
        sessionUser: { id: 'admin-1', role: 'SCHOOL_ADMIN', institutionId: 'inst-2' }
    })

    assert.equal(allowed, false)
})

test('canAccessAttemptAction allows student to submit own attempt', () => {
    const allowed = canAccessAttemptAction('submitAttempt', {
        ...baseContext,
        sessionUser: { id: 'student-1', role: 'STUDENT', institutionId: 'inst-1' }
    })

    assert.equal(allowed, true)
})

test('canAccessAttemptAction blocks student submitting other attempt', () => {
    const allowed = canAccessAttemptAction('submitAttempt', {
        ...baseContext,
        sessionUser: { id: 'student-2', role: 'STUDENT', institutionId: 'inst-1' }
    })

    assert.equal(allowed, false)
})

test('canAccessAttemptAction blocks submit on institution mismatch', () => {
    const allowed = canAccessAttemptAction('submitAttempt', {
        ...baseContext,
        sessionUser: { id: 'student-1', role: 'STUDENT', institutionId: 'inst-2' }
    })

    assert.equal(allowed, false)
})

test('canAccessAttemptAction allows teacher to view anti-cheat when allowed', () => {
    const allowed = canAccessAttemptAction('viewAntiCheat', {
        ...baseContext,
        sessionUser: { id: 'teacher-1', role: 'TEACHER', institutionId: 'inst-1' }
    })

    assert.equal(allowed, true)
})

test('canAccessAttemptAction blocks teacher viewing anti-cheat on institution mismatch', () => {
    const allowed = canAccessAttemptAction('viewAntiCheat', {
        ...baseContext,
        sessionUser: { id: 'teacher-1', role: 'TEACHER', institutionId: 'inst-2' }
    })

    assert.equal(allowed, false)
})

test('canAccessAttemptAction blocks teacher posting proctor events', () => {
    const allowed = canAccessAttemptAction('writeProctorEvents', {
        ...baseContext,
        sessionUser: { id: 'teacher-1', role: 'TEACHER', institutionId: 'inst-1' }
    })

    assert.equal(allowed, false)
})

test('canAccessAttemptAction allows student to view results for own attempt', () => {
    const allowed = canAccessAttemptAction('viewResults', {
        ...baseContext,
        sessionUser: { id: 'student-1', role: 'STUDENT', institutionId: 'inst-1' }
    })

    assert.equal(allowed, true)
})

test('canAccessAttemptAction blocks student viewing results for other attempt', () => {
    const allowed = canAccessAttemptAction('viewResults', {
        ...baseContext,
        sessionUser: { id: 'student-2', role: 'STUDENT', institutionId: 'inst-1' }
    })

    assert.equal(allowed, false)
})

test('canAccessAttemptAction allows teacher to view grading when allowed', () => {
    const allowed = canAccessAttemptAction('viewGrading', {
        ...baseContext,
        sessionUser: { id: 'teacher-1', role: 'TEACHER', institutionId: 'inst-1' }
    })

    assert.equal(allowed, true)
})

test('canAccessAttemptAction blocks teacher viewing grading on institution mismatch', () => {
    const allowed = canAccessAttemptAction('viewGrading', {
        ...baseContext,
        sessionUser: { id: 'teacher-1', role: 'TEACHER', institutionId: 'inst-2' }
    })

    assert.equal(allowed, false)
})
