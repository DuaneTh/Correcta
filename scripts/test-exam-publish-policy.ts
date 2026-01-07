import assert from 'node:assert/strict'
import { getPublishPolicyResult } from '@/lib/exam-variants'

const baseClassIds = ['section-1', 'section-2']
const draftVariants = [
    { id: 'draft-1', classId: 'section-1', className: 'Group A' },
    { id: 'draft-2', classId: 'section-3', className: 'Group C' },
]

const run = () => {
    const publishAll = getPublishPolicyResult('PUBLISH_ALL', baseClassIds, draftVariants)
    assert.deepEqual(publishAll.updatedClassIds, baseClassIds)
    assert.deepEqual(publishAll.deletedDraftVariantIds, [])

    const publishExcept = getPublishPolicyResult('PUBLISH_EXCEPT_DRAFT_SECTIONS', baseClassIds, draftVariants)
    assert.deepEqual(publishExcept.updatedClassIds, ['section-2'])
    assert.deepEqual(publishExcept.deletedDraftVariantIds, [])

    const deleteDrafts = getPublishPolicyResult('DELETE_DRAFTS_THEN_PUBLISH', baseClassIds, draftVariants)
    assert.deepEqual(deleteDrafts.updatedClassIds, baseClassIds)
    assert.deepEqual(deleteDrafts.deletedDraftVariantIds, ['draft-1', 'draft-2'])

    console.log('Exam publish policy tests passed')
}

run()
