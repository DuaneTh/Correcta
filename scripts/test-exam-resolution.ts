import assert from 'node:assert/strict'
import { resolvePublishedExamsForClasses } from '@/lib/exam-variants'

type TestExam = {
    id: string
    parentExamId: string | null
    classId: string | null
    classIds: string[]
    status: 'DRAFT' | 'PUBLISHED'
}

const baseExam = (overrides: Partial<TestExam> = {}): TestExam => ({
    id: 'base-1',
    parentExamId: null,
    classId: null,
    classIds: ['section-1'],
    status: 'PUBLISHED',
    ...overrides,
})

const variantExam = (overrides: Partial<TestExam> = {}): TestExam => ({
    id: 'variant-1',
    parentExamId: 'base-1',
    classId: 'section-1',
    classIds: [],
    status: 'PUBLISHED',
    ...overrides,
})

const run = () => {
    // Case 1: base PUBLISHED + variant DRAFT => base selected
    const base1 = baseExam()
    const variantDraft = variantExam({ status: 'DRAFT' })
    const result1 = resolvePublishedExamsForClasses({
        baseExams: [base1],
        variantExams: [variantDraft].filter((e) => e.status === 'PUBLISHED'),
        classIds: ['section-1'],
        context: 'test-case-1',
    })
    assert.equal(result1.length, 1)
    assert.equal(result1[0].id, base1.id)

    // Case 2: base PUBLISHED + variant PUBLISHED => variant selected
    const base2 = baseExam({ id: 'base-2' })
    const variant2 = variantExam({ id: 'variant-2', parentExamId: base2.id })
    const result2 = resolvePublishedExamsForClasses({
        baseExams: [base2],
        variantExams: [variant2],
        classIds: ['section-1'],
        context: 'test-case-2',
    })
    assert.equal(result2.length, 1)
    assert.equal(result2[0].id, variant2.id)

    // Case 3: base DRAFT + variant PUBLISHED => variant selected
    const base3 = baseExam({ id: 'base-3', status: 'DRAFT' })
    const variant3 = variantExam({ id: 'variant-3', parentExamId: base3.id })
    const result3 = resolvePublishedExamsForClasses({
        baseExams: [base3].filter((e) => e.status === 'PUBLISHED'),
        variantExams: [variant3],
        classIds: ['section-1'],
        context: 'test-case-3',
    })
    assert.equal(result3.length, 1)
    assert.equal(result3[0].id, variant3.id)

    // Case 4: base PUBLISHED but section not targeted => no exam
    const base4 = baseExam({ id: 'base-4', classIds: ['section-2'] })
    const result4 = resolvePublishedExamsForClasses({
        baseExams: [base4],
        variantExams: [],
        classIds: ['section-1'],
        context: 'test-case-4',
    })
    assert.equal(result4.length, 0)

    console.log('Exam resolution tests passed')
}

run()
