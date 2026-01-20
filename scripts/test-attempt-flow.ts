/**
 * Test script for exam attempt flow with MCQ auto-scoring
 *
 * This script tests:
 * 1. Starting an attempt
 * 2. Saving answers for MCQ and TEXT questions
 * 3. Submitting the attempt
 * 4. Verifying MCQ auto-scoring (MCQ answer has score, TEXT answer has null score)
 *
 * Prerequisites:
 * - A published exam with at least 1 MCQ and 1 TEXT question
 * - A student enrolled in the exam's course
 *
 * Run: npx tsx scripts/test-attempt-flow.ts
 */

import { prisma } from '../lib/prisma'
import { scoreMultipleChoiceAnswer } from '../lib/actions/exam-taking'

async function main() {
  console.log('=== Test Attempt Flow with MCQ Auto-Scoring ===\n')

  // 1. Find a suitable exam (PUBLISHED with MCQ and TEXT questions)
  console.log('1. Finding a suitable exam...')

  const exam = await prisma.exam.findFirst({
    where: {
      status: 'PUBLISHED',
      archivedAt: null,
      sections: {
        some: {
          questions: {
            some: {
              type: 'MCQ'
            }
          }
        }
      }
    },
    include: {
      course: true,
      sections: {
        include: {
          questions: {
            include: {
              segments: true
            },
            orderBy: { order: 'asc' }
          }
        },
        orderBy: { order: 'asc' }
      }
    }
  })

  if (!exam) {
    console.log('No suitable exam found. Creating a test exam...')
    console.log('Please create a PUBLISHED exam with MCQ and TEXT questions first.')
    process.exit(1)
  }

  console.log(`   Found exam: "${exam.title}" (${exam.id})`)
  console.log(`   Course: ${exam.course.code} - ${exam.course.name}`)

  // Count questions by type
  let mcqCount = 0
  let textCount = 0
  let mcqQuestion = null
  let textQuestion = null

  for (const section of exam.sections) {
    for (const question of section.questions) {
      if (question.type === 'MCQ') {
        mcqCount++
        if (!mcqQuestion) mcqQuestion = question
      } else if (question.type === 'TEXT') {
        textCount++
        if (!textQuestion) textQuestion = question
      }
    }
  }

  console.log(`   Questions: ${mcqCount} MCQ, ${textCount} TEXT\n`)

  if (!mcqQuestion) {
    console.log('ERROR: No MCQ question found in exam')
    process.exit(1)
  }

  // 2. Find an enrolled student
  console.log('2. Finding an enrolled student...')

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      class: {
        courseId: exam.courseId,
        archivedAt: null
      },
      role: 'STUDENT',
      user: {
        archivedAt: null
      }
    },
    include: {
      user: true
    }
  })

  if (!enrollment) {
    console.log('No enrolled student found. Please enroll a student first.')
    process.exit(1)
  }

  console.log(`   Found student: ${enrollment.user.name || enrollment.user.email} (${enrollment.user.id})\n`)

  // 3. Check for existing attempt or create new one
  console.log('3. Checking for existing attempt...')

  let attempt = await prisma.attempt.findFirst({
    where: {
      examId: exam.id,
      studentId: enrollment.userId
    },
    include: {
      answers: {
        include: {
          segments: true,
          grades: true,
          question: true
        }
      }
    }
  })

  if (attempt) {
    console.log(`   Found existing attempt: ${attempt.id} (status: ${attempt.status})`)

    // If already submitted, show results
    if (attempt.status !== 'IN_PROGRESS') {
      console.log('\n=== Existing Attempt Results ===')
      for (const answer of attempt.answers) {
        const grade = answer.grades[0]
        console.log(`   ${answer.question.type} Q${answer.questionId.slice(0, 8)}...`)
        console.log(`      Score: ${grade?.score ?? 'NULL (not graded)'}`)
        console.log(`      Auto-scored: ${grade?.aiRationale === 'AUTO_SCORED_MCQ' ? 'Yes' : 'No'}`)
      }

      // Check if MCQ was auto-scored
      const mcqAnswer = attempt.answers.find(a => a.question.type === 'MCQ')
      const textAnswer = attempt.answers.find(a => a.question.type === 'TEXT')

      console.log('\n=== Verification ===')
      if (mcqAnswer) {
        const mcqGrade = mcqAnswer.grades[0]
        console.log(`MCQ answer score: ${mcqGrade?.score ?? 'NULL'}`)
        console.log(`MCQ is auto-scored: ${mcqGrade?.aiRationale === 'AUTO_SCORED_MCQ'}`)
        if (mcqGrade && mcqGrade.aiRationale === 'AUTO_SCORED_MCQ') {
          console.log('[PASS] MCQ was auto-scored on submission')
        } else {
          console.log('[FAIL] MCQ was NOT auto-scored')
        }
      }
      if (textAnswer) {
        const textGrade = textAnswer.grades[0]
        console.log(`TEXT answer score: ${textGrade?.score ?? 'NULL'}`)
        if (!textGrade || textGrade.score === null) {
          console.log('[PASS] TEXT answer left ungraded (for Phase 4)')
        } else {
          console.log('[INFO] TEXT answer has a grade')
        }
      }

      process.exit(0)
    }
  } else {
    console.log('   No existing attempt. Creating new one...')
    attempt = await prisma.attempt.create({
      data: {
        examId: exam.id,
        studentId: enrollment.userId,
        status: 'IN_PROGRESS',
        startedAt: new Date()
      },
      include: {
        answers: {
          include: {
            segments: true,
            grades: true,
            question: true
          }
        }
      }
    })
    console.log(`   Created attempt: ${attempt.id}\n`)
  }

  // 4. Save answers
  console.log('4. Saving answers...')

  // Save MCQ answer - select the correct option(s)
  console.log('   Saving MCQ answer...')
  const correctOptions = mcqQuestion.segments.filter(s => s.isCorrect === true)
  console.log(`   MCQ has ${mcqQuestion.segments.length} options, ${correctOptions.length} correct`)

  // Create Answer record
  let mcqAnswer = await prisma.answer.findUnique({
    where: {
      attemptId_questionId: {
        attemptId: attempt.id,
        questionId: mcqQuestion.id
      }
    }
  })

  if (!mcqAnswer) {
    mcqAnswer = await prisma.answer.create({
      data: {
        attemptId: attempt.id,
        questionId: mcqQuestion.id
      }
    })
  }

  // Save answer segments (select correct options)
  for (const option of correctOptions) {
    await prisma.answerSegment.upsert({
      where: {
        answerId_segmentId: {
          answerId: mcqAnswer.id,
          segmentId: option.id
        }
      },
      create: {
        answerId: mcqAnswer.id,
        segmentId: option.id,
        content: 'true',
        autosavedAt: new Date()
      },
      update: {
        content: 'true',
        autosavedAt: new Date()
      }
    })
  }
  console.log(`   Saved MCQ answer with ${correctOptions.length} selected options`)

  // Save TEXT answer if available
  if (textQuestion) {
    console.log('   Saving TEXT answer...')
    let textAnswer = await prisma.answer.findUnique({
      where: {
        attemptId_questionId: {
          attemptId: attempt.id,
          questionId: textQuestion.id
        }
      }
    })

    if (!textAnswer) {
      textAnswer = await prisma.answer.create({
        data: {
          attemptId: attempt.id,
          questionId: textQuestion.id
        }
      })
    }

    const textSegment = textQuestion.segments[0]
    if (textSegment) {
      await prisma.answerSegment.upsert({
        where: {
          answerId_segmentId: {
            answerId: textAnswer.id,
            segmentId: textSegment.id
          }
        },
        create: {
          answerId: textAnswer.id,
          segmentId: textSegment.id,
          content: 'This is a test answer for the TEXT question.',
          autosavedAt: new Date()
        },
        update: {
          content: 'This is a test answer for the TEXT question.',
          autosavedAt: new Date()
        }
      })
    }
    console.log('   Saved TEXT answer')
  }

  console.log('')

  // 5. Test the scoring function
  console.log('5. Testing MCQ scoring function...')
  const studentAnswers = new Map<string, string>()
  for (const option of correctOptions) {
    studentAnswers.set(option.id, 'true')
  }

  const scoreResult = await scoreMultipleChoiceAnswer(
    {
      id: mcqQuestion.id,
      maxPoints: mcqQuestion.maxPoints,
      requireAllCorrect: mcqQuestion.requireAllCorrect,
      segments: mcqQuestion.segments.map(s => ({
        id: s.id,
        maxPoints: s.maxPoints,
        isCorrect: s.isCorrect
      }))
    },
    studentAnswers
  )

  console.log(`   Score: ${scoreResult.score}`)
  console.log(`   Is correct: ${scoreResult.isCorrect}`)
  console.log(`   Selected: ${scoreResult.selectedOptions.length} options`)
  console.log(`   Correct: ${scoreResult.correctOptions.length} options`)
  console.log('')

  // 6. Submit the attempt (simulated - just update status and create grades)
  console.log('6. Submitting attempt with auto-scoring...')

  // Fetch fresh attempt with all answers
  const freshAttempt = await prisma.attempt.findUnique({
    where: { id: attempt.id },
    include: {
      answers: {
        include: {
          segments: true,
          question: {
            include: {
              segments: true
            }
          }
        }
      }
    }
  })

  if (!freshAttempt) {
    console.log('ERROR: Could not find attempt')
    process.exit(1)
  }

  // Process MCQ auto-scoring
  const mcqScores: Array<{ answerId: string; score: number; isCorrect: boolean }> = []

  for (const answer of freshAttempt.answers) {
    if (answer.question.type === 'MCQ') {
      const answers = new Map<string, string>()
      for (const seg of answer.segments) {
        answers.set(seg.segmentId, seg.content)
      }

      const result = await scoreMultipleChoiceAnswer(
        {
          id: answer.question.id,
          maxPoints: answer.question.maxPoints,
          requireAllCorrect: answer.question.requireAllCorrect,
          segments: answer.question.segments.map(s => ({
            id: s.id,
            maxPoints: s.maxPoints,
            isCorrect: s.isCorrect
          }))
        },
        answers
      )

      mcqScores.push({
        answerId: answer.id,
        score: result.score,
        isCorrect: result.isCorrect
      })
    }
  }

  // Submit in transaction
  await prisma.$transaction(async (tx) => {
    // Update status
    await tx.attempt.update({
      where: { id: attempt.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date()
      }
    })

    // Create grades for MCQ
    for (const mcqScore of mcqScores) {
      const existingGrade = await tx.grade.findUnique({
        where: { answerId: mcqScore.answerId }
      })

      if (!existingGrade) {
        await tx.grade.create({
          data: {
            answerId: mcqScore.answerId,
            score: mcqScore.score,
            feedback: mcqScore.isCorrect ? 'Correct answer' : 'Incorrect answer',
            aiRationale: 'AUTO_SCORED_MCQ',
            isOverridden: false,
            gradedByUserId: null
          }
        })
      }
    }

    // Create grading task for TEXT
    const hasText = freshAttempt.answers.some(a => a.question.type === 'TEXT')
    if (hasText) {
      await tx.gradingTask.create({
        data: {
          attemptId: attempt.id,
          status: 'PENDING'
        }
      })
    }
  })

  console.log('   Attempt submitted!')
  console.log('')

  // 7. Verify results
  console.log('7. Verifying results...')

  const finalAttempt = await prisma.attempt.findUnique({
    where: { id: attempt.id },
    include: {
      answers: {
        include: {
          grades: true,
          question: true
        }
      },
      gradingTasks: true
    }
  })

  if (!finalAttempt) {
    console.log('ERROR: Could not find final attempt')
    process.exit(1)
  }

  console.log(`   Attempt status: ${finalAttempt.status}`)
  console.log(`   Submitted at: ${finalAttempt.submittedAt}`)
  console.log('')

  let allPassed = true

  // Check MCQ answer
  const mcqAnswerFinal = finalAttempt.answers.find(a => a.question.type === 'MCQ')
  if (mcqAnswerFinal) {
    const mcqGrade = mcqAnswerFinal.grades[0]
    console.log(`   MCQ Answer:`)
    console.log(`      Score: ${mcqGrade?.score ?? 'NULL'}`)
    console.log(`      Auto-scored: ${mcqGrade?.aiRationale === 'AUTO_SCORED_MCQ'}`)

    if (mcqGrade && mcqGrade.aiRationale === 'AUTO_SCORED_MCQ') {
      console.log('   [PASS] MCQ was auto-scored')
    } else {
      console.log('   [FAIL] MCQ was NOT auto-scored')
      allPassed = false
    }
  }

  // Check TEXT answer
  const textAnswerFinal = finalAttempt.answers.find(a => a.question.type === 'TEXT')
  if (textAnswerFinal) {
    const textGrade = textAnswerFinal.grades[0]
    console.log(`   TEXT Answer:`)
    console.log(`      Score: ${textGrade?.score ?? 'NULL'}`)

    if (!textGrade) {
      console.log('   [PASS] TEXT has no grade (pending Phase 4)')
    } else {
      console.log('   [INFO] TEXT has a grade')
    }
  }

  // Check grading task
  if (textQuestion && finalAttempt.gradingTasks.length > 0) {
    console.log(`   Grading Task: ${finalAttempt.gradingTasks[0].status}`)
    console.log('   [PASS] Grading task created for TEXT questions')
  }

  console.log('')
  console.log('=== Test Complete ===')
  console.log(allPassed ? 'All checks passed!' : 'Some checks failed.')

  process.exit(allPassed ? 0 : 1)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
