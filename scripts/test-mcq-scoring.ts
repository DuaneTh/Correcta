/**
 * Test script for MCQ auto-scoring logic
 *
 * Tests the scoreMultipleChoiceAnswer function with various scenarios:
 * 1. All correct selections (full points)
 * 2. No selections (0 points)
 * 3. Partial selections (partial credit if not requireAllCorrect)
 * 4. All or nothing mode (requireAllCorrect)
 * 5. Wrong selections only (0 points)
 * 6. Edge case: no correct options defined
 *
 * Run: npx tsx scripts/test-mcq-scoring.ts
 */

import { scoreMultipleChoiceAnswer } from '../lib/actions/exam-taking'

// Test helper
function assertEqual(actual: unknown, expected: unknown, testName: string) {
  const actualStr = JSON.stringify(actual)
  const expectedStr = JSON.stringify(expected)
  if (actualStr === expectedStr) {
    console.log(`[PASS] ${testName}`)
  } else {
    console.error(`[FAIL] ${testName}`)
    console.error(`  Expected: ${expectedStr}`)
    console.error(`  Actual:   ${actualStr}`)
    process.exitCode = 1
  }
}

// Sample question with 4 options, 2 correct (B and D)
const mcqQuestion = {
  id: 'q1',
  maxPoints: 4,
  requireAllCorrect: false,
  segments: [
    { id: 'opt-a', maxPoints: null, isCorrect: false },
    { id: 'opt-b', maxPoints: null, isCorrect: true },
    { id: 'opt-c', maxPoints: null, isCorrect: false },
    { id: 'opt-d', maxPoints: null, isCorrect: true },
  ]
}

// Test 1: All correct selections
{
  const answers = new Map([
    ['opt-b', 'true'],
    ['opt-d', 'true'],
  ])
  const result = scoreMultipleChoiceAnswer(mcqQuestion, answers)
  assertEqual(result.score, 4, 'All correct selections - full points')
  assertEqual(result.isCorrect, true, 'All correct selections - isCorrect')
}

// Test 2: No selections
{
  const answers = new Map<string, string>()
  const result = scoreMultipleChoiceAnswer(mcqQuestion, answers)
  assertEqual(result.score, 0, 'No selections - zero points')
  assertEqual(result.isCorrect, false, 'No selections - not correct')
}

// Test 3: Partial correct (1 of 2 correct selected)
{
  const answers = new Map([
    ['opt-b', 'true'],
  ])
  const result = scoreMultipleChoiceAnswer(mcqQuestion, answers)
  assertEqual(result.score, 2, 'Partial selection (1/2) - half points')
  assertEqual(result.isCorrect, false, 'Partial selection - not exact match')
}

// Test 4: Mixed - 1 correct + 1 incorrect
{
  const answers = new Map([
    ['opt-b', 'true'],
    ['opt-c', 'true'], // incorrect
  ])
  const result = scoreMultipleChoiceAnswer(mcqQuestion, answers)
  // (1 correct - 1 incorrect) / 2 total correct * 4 points = 0
  assertEqual(result.score, 0, 'Mixed selection - net zero')
  assertEqual(result.isCorrect, false, 'Mixed selection - not correct')
}

// Test 5: All or nothing mode - exact match
{
  const allOrNothingQuestion = { ...mcqQuestion, requireAllCorrect: true }
  const answers = new Map([
    ['opt-b', 'true'],
    ['opt-d', 'true'],
  ])
  const result = scoreMultipleChoiceAnswer(allOrNothingQuestion, answers)
  assertEqual(result.score, 4, 'All or nothing - exact match - full points')
  assertEqual(result.isCorrect, true, 'All or nothing - exact match - correct')
}

// Test 6: All or nothing mode - partial (should get 0)
{
  const allOrNothingQuestion = { ...mcqQuestion, requireAllCorrect: true }
  const answers = new Map([
    ['opt-b', 'true'],
  ])
  const result = scoreMultipleChoiceAnswer(allOrNothingQuestion, answers)
  assertEqual(result.score, 0, 'All or nothing - partial - zero points')
  assertEqual(result.isCorrect, false, 'All or nothing - partial - not correct')
}

// Test 7: Only wrong selections
{
  const answers = new Map([
    ['opt-a', 'true'],
    ['opt-c', 'true'],
  ])
  const result = scoreMultipleChoiceAnswer(mcqQuestion, answers)
  // (0 correct - 2 incorrect) / 2 * 4 = -4, clamped to 0
  assertEqual(result.score, 0, 'Only wrong selections - zero points')
  assertEqual(result.isCorrect, false, 'Only wrong selections - not correct')
}

// Test 8: Question with points on segments instead of maxPoints
{
  const segmentPointsQuestion = {
    id: 'q2',
    maxPoints: null, // no maxPoints, use segment totals
    requireAllCorrect: false,
    segments: [
      { id: 'opt-a', maxPoints: 2, isCorrect: true },
      { id: 'opt-b', maxPoints: 2, isCorrect: true },
      { id: 'opt-c', maxPoints: 2, isCorrect: false },
    ]
  }
  const answers = new Map([
    ['opt-a', 'true'],
    ['opt-b', 'true'],
  ])
  const result = scoreMultipleChoiceAnswer(segmentPointsQuestion, answers)
  // Total points from segments = 2+2+2 = 6
  assertEqual(result.score, 6, 'Segment points - all correct - full points')
  assertEqual(result.isCorrect, true, 'Segment points - all correct')
}

// Test 9: Answer values as "1" instead of "true"
{
  const answers = new Map([
    ['opt-b', '1'],
    ['opt-d', '1'],
  ])
  const result = scoreMultipleChoiceAnswer(mcqQuestion, answers)
  assertEqual(result.score, 4, 'Answer value "1" - full points')
  assertEqual(result.isCorrect, true, 'Answer value "1" - correct')
}

// Test 10: Empty string and "false" should not count as selected
{
  const answers = new Map([
    ['opt-a', ''],
    ['opt-b', 'true'],
    ['opt-c', 'false'],
    ['opt-d', 'true'],
  ])
  const result = scoreMultipleChoiceAnswer(mcqQuestion, answers)
  assertEqual(result.score, 4, 'Empty/"false" not selected - full points')
  assertEqual(result.isCorrect, true, 'Empty/"false" not selected - correct')
}

console.log('\n--- MCQ Scoring Tests Complete ---')
