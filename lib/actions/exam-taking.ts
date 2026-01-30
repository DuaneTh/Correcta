'use server'

import { getServerSession } from 'next-auth'
import { buildAuthOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getExamEndAt } from '@/lib/exam-time'
import { recomputeAttemptStatus } from '@/lib/attemptStatus'

// Types for MCQ scoring
type McqScoreResult = {
  score: number
  isCorrect: boolean
  selectedOptions: string[]
  correctOptions: string[]
}

/**
 * Scores a multiple choice answer by comparing selected options to correct options.
 *
 * For MCQ questions:
 * - Segments represent options
 * - isCorrect on segment indicates it's a correct answer
 * - Student's answer for a segment is "true" or "1" if selected
 *
 * Scoring rules:
 * - If requireAllCorrect is true: all or nothing (must match exactly)
 * - If requireAllCorrect is false: partial credit based on correct selections
 */
export async function scoreMultipleChoiceAnswer(
  question: {
    id: string
    maxPoints: number | null
    requireAllCorrect: boolean
    segments: Array<{
      id: string
      maxPoints: number | null
      isCorrect: boolean | null
    }>
  },
  studentAnswers: Map<string, string> // segmentId -> content ("true"/"1" for selected)
): Promise<McqScoreResult> {
  // Get correct option IDs
  const correctOptionIds = question.segments
    .filter(seg => seg.isCorrect === true)
    .map(seg => seg.id)

  // Get selected option IDs (value is "true" or "1")
  const selectedOptionIds = question.segments
    .filter(seg => {
      const answer = studentAnswers.get(seg.id)
      return answer === 'true' || answer === '1'
    })
    .map(seg => seg.id)

  // Calculate total points for this question
  // MCQ can use maxPoints on question OR sum of segment maxPoints
  const totalPoints = question.maxPoints ??
    question.segments.reduce((sum, seg) => sum + (seg.maxPoints ?? 0), 0) ??
    1

  // Check if selections match exactly
  const correctSet = new Set(correctOptionIds)
  const selectedSet = new Set(selectedOptionIds)

  const isExactMatch =
    correctSet.size === selectedSet.size &&
    [...correctSet].every(id => selectedSet.has(id))

  // Calculate score based on requireAllCorrect mode
  let score: number

  if (question.requireAllCorrect) {
    // All or nothing: full points only if exact match
    score = isExactMatch ? totalPoints : 0
  } else {
    // Partial credit: count correct selections minus incorrect ones
    const correctSelections = selectedOptionIds.filter(id => correctSet.has(id)).length
    const incorrectSelections = selectedOptionIds.filter(id => !correctSet.has(id)).length
    const totalCorrectOptions = correctOptionIds.length

    if (totalCorrectOptions === 0) {
      // No correct options defined - give full points if nothing selected
      score = selectedOptionIds.length === 0 ? totalPoints : 0
    } else {
      // Partial scoring: (correct - incorrect) / total correct options * points
      // Minimum score is 0
      const rawScore = (correctSelections - incorrectSelections) / totalCorrectOptions
      score = Math.max(0, rawScore * totalPoints)
    }
  }

  return {
    score,
    isCorrect: isExactMatch,
    selectedOptions: selectedOptionIds,
    correctOptions: correctOptionIds
  }
}

/**
 * Starts an exam attempt for the current user.
 * Returns existing IN_PROGRESS attempt if one exists.
 */
export async function startAttempt(examId: string) {
  const cookieStore = await cookies()
  const institutionId = cookieStore.get('correcta-institution')?.value

  const authOptions = await buildAuthOptions(institutionId)
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'STUDENT') {
    throw new Error('Unauthorized')
  }

  // Check if user already has an active attempt
  const existingAttempt = await prisma.attempt.findFirst({
    where: {
      examId,
      studentId: session.user.id
    }
  })

  if (existingAttempt) {
    if (existingAttempt.status === 'IN_PROGRESS') {
      return {
        attemptId: existingAttempt.id,
        status: 'existing',
        startedAt: existingAttempt.startedAt.toISOString()
      }
    }
    throw new Error('You have already completed this exam')
  }

  // Verify exam exists and is accessible
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      course: {
        include: {
          classes: {
            where: { archivedAt: null },
            include: {
              enrollments: {
                where: { userId: session.user.id }
              }
            }
          }
        }
      }
    }
  })

  if (!exam || exam.archivedAt || exam.status === 'DRAFT') {
    throw new Error('Exam not found')
  }

  // Verify enrollment
  const enrolledClassIds = exam.course.classes
    .filter(cls => cls.enrollments.length > 0)
    .map(cls => cls.id)

  if (enrolledClassIds.length === 0) {
    throw new Error('You are not enrolled in this exam')
  }

  // Check time window
  const now = new Date()
  if (exam.startAt && now < exam.startAt) {
    throw new Error('Exam has not started yet')
  }

  const examEndAt = getExamEndAt(exam.startAt, exam.durationMinutes, exam.endAt)
  if (examEndAt && now > examEndAt) {
    throw new Error('Exam has ended')
  }

  // Create new attempt
  const attempt = await prisma.attempt.create({
    data: {
      examId,
      studentId: session.user.id,
      status: 'IN_PROGRESS',
      startedAt: new Date()
    }
  })

  revalidatePath('/student/exams')

  return {
    attemptId: attempt.id,
    status: 'created',
    startedAt: attempt.startedAt.toISOString()
  }
}

/**
 * Saves a student's answer for a question segment.
 * Verifies the attempt is IN_PROGRESS and within time window.
 */
export async function saveAnswer(
  attemptId: string,
  questionId: string,
  segmentId: string,
  content: string
) {
  const cookieStore = await cookies()
  const institutionId = cookieStore.get('correcta-institution')?.value

  const authOptions = await buildAuthOptions(institutionId)
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'STUDENT') {
    throw new Error('Unauthorized')
  }

  // Verify attempt exists and belongs to user
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: true
    }
  })

  if (!attempt || attempt.studentId !== session.user.id) {
    throw new Error('Attempt not found')
  }

  if (attempt.status !== 'IN_PROGRESS') {
    throw new Error('Attempt is not in progress')
  }

  // Check time window
  const now = new Date()
  const examEndAt = getExamEndAt(attempt.exam.startAt, attempt.exam.durationMinutes, attempt.exam.endAt)
  if (examEndAt && now > examEndAt) {
    throw new Error('Exam has ended')
  }

  // Find or create Answer for this question
  let answer = await prisma.answer.findUnique({
    where: {
      attemptId_questionId: {
        attemptId,
        questionId
      }
    }
  })

  if (!answer) {
    answer = await prisma.answer.create({
      data: {
        attemptId,
        questionId
      }
    })
  }

  // Upsert AnswerSegment
  const answerSegment = await prisma.answerSegment.upsert({
    where: {
      answerId_segmentId: {
        answerId: answer.id,
        segmentId
      }
    },
    create: {
      answerId: answer.id,
      segmentId,
      content,
      autosavedAt: new Date()
    },
    update: {
      content,
      autosavedAt: new Date()
    }
  })

  return {
    success: true,
    answerSegmentId: answerSegment.id,
    autosavedAt: answerSegment.autosavedAt?.toISOString()
  }
}

/**
 * Submits an exam attempt and auto-scores MCQ questions.
 *
 * For MCQ questions:
 * - Creates Grade records with automatic scores
 * - Sets isAutoScored flag via aiRationale field
 *
 * For TEXT questions:
 * - Leaves scores as null (pending manual/AI grading)
 *
 * Returns summary of auto-scored results.
 */
export async function submitAttempt(attemptId: string) {
  const cookieStore = await cookies()
  const institutionId = cookieStore.get('correcta-institution')?.value

  const authOptions = await buildAuthOptions(institutionId)
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'STUDENT') {
    throw new Error('Unauthorized')
  }

  // Fetch attempt with all answers and question details
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        include: {
          sections: {
            include: {
              questions: {
                include: {
                  segments: true
                }
              }
            }
          }
        }
      },
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

  if (!attempt || attempt.studentId !== session.user.id) {
    throw new Error('Attempt not found')
  }

  if (attempt.status !== 'IN_PROGRESS') {
    throw new Error('Attempt already submitted')
  }

  // Check time window with grace period (60 seconds)
  const now = new Date()
  const gracePeriodSeconds = 60
  const examEndAt = getExamEndAt(attempt.exam.startAt, attempt.exam.durationMinutes, attempt.exam.endAt)

  if (examEndAt) {
    const endAtWithGrace = new Date(examEndAt.getTime() + gracePeriodSeconds * 1000)
    if (now > endAtWithGrace) {
      throw new Error('Exam has ended, submission not allowed')
    }
  }

  // Process MCQ auto-scoring
  const mcqScores: Array<{
    questionId: string
    answerId: string
    score: number
    isCorrect: boolean
  }> = []

  let totalAutoScoredPoints = 0

  for (const answer of attempt.answers) {
    const question = answer.question

    if (question.type === 'MCQ') {
      // Build map of student answers for this question
      const studentAnswers = new Map<string, string>()
      for (const seg of answer.segments) {
        studentAnswers.set(seg.segmentId, seg.content)
      }

      // Score the MCQ
      const scoreResult = await scoreMultipleChoiceAnswer(
        {
          id: question.id,
          maxPoints: question.maxPoints,
          requireAllCorrect: question.requireAllCorrect,
          segments: question.segments.map(s => ({
            id: s.id,
            maxPoints: s.maxPoints,
            isCorrect: s.isCorrect
          }))
        },
        studentAnswers
      )

      mcqScores.push({
        questionId: question.id,
        answerId: answer.id,
        score: scoreResult.score,
        isCorrect: scoreResult.isCorrect
      })

      totalAutoScoredPoints += scoreResult.score
    }
    // TEXT questions: leave ungraded for now
  }

  // Execute submission in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update attempt status
    const updatedAttempt = await tx.attempt.update({
      where: { id: attemptId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date()
      }
    })

    // Create Grade records for MCQ answers
    for (const mcqScore of mcqScores) {
      // Check if grade already exists
      const existingGrade = await tx.grade.findUnique({
        where: { answerId: mcqScore.answerId }
      })

      if (!existingGrade) {
        await tx.grade.create({
          data: {
            answerId: mcqScore.answerId,
            score: mcqScore.score,
            feedback: mcqScore.isCorrect
              ? 'Correct answer'
              : 'Incorrect answer',
            aiRationale: 'AUTO_SCORED_MCQ', // Flag indicating auto-scored
            isOverridden: false,
            gradedByUserId: null // null indicates automatic grading
          }
        })
      }
    }

    // Create grading task placeholder for TEXT questions (Phase 4)
    const hasTextQuestions = attempt.answers.some(
      a => a.question.type === 'TEXT'
    )

    if (hasTextQuestions) {
      await tx.gradingTask.create({
        data: {
          attemptId,
          status: 'PENDING'
        }
      })
    }

    return updatedAttempt
  })

  // Recompute status after transaction (MCQ-only exams should be marked GRADED immediately)
  await recomputeAttemptStatus(attemptId)

  revalidatePath('/student/exams')
  revalidatePath(`/student/attempts/${attemptId}`)

  return {
    success: true,
    attemptId: result.id,
    status: result.status,
    submittedAt: result.submittedAt?.toISOString(),
    autoScoredResults: {
      mcqCount: mcqScores.length,
      totalAutoScoredPoints,
      scores: mcqScores
    }
  }
}

/**
 * Gets the current state of an attempt for the student.
 * Returns attempt details with exam info and saved answers.
 */
export async function getAttemptState(attemptId: string) {
  const cookieStore = await cookies()
  const institutionId = cookieStore.get('correcta-institution')?.value

  const authOptions = await buildAuthOptions(institutionId)
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'STUDENT') {
    throw new Error('Unauthorized')
  }

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        include: {
          course: {
            select: {
              code: true,
              name: true
            }
          },
          author: {
            select: {
              name: true
            }
          },
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
      },
      answers: {
        include: {
          segments: true,
          grades: true
        }
      }
    }
  })

  if (!attempt || attempt.studentId !== session.user.id) {
    throw new Error('Attempt not found')
  }

  // Calculate deadline
  const examEndAt = getExamEndAt(
    attempt.exam.startAt,
    attempt.exam.durationMinutes,
    attempt.exam.endAt
  )
  const deadlineFromStart = attempt.exam.durationMinutes
    ? new Date(attempt.startedAt.getTime() + attempt.exam.durationMinutes * 60 * 1000)
    : null
  const deadline = examEndAt && deadlineFromStart
    ? (examEndAt < deadlineFromStart ? examEndAt : deadlineFromStart)
    : examEndAt || deadlineFromStart

  return {
    attemptId: attempt.id,
    status: attempt.status,
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    deadlineAt: deadline?.toISOString() ?? null,
    exam: {
      id: attempt.exam.id,
      title: attempt.exam.title,
      durationMinutes: attempt.exam.durationMinutes,
      course: attempt.exam.course,
      author: attempt.exam.author,
      sections: attempt.exam.sections
    },
    answers: attempt.answers.map(a => ({
      questionId: a.questionId,
      segments: a.segments.map(s => ({
        segmentId: s.segmentId,
        content: s.content
      })),
      grade: a.grades[0] ? {
        score: a.grades[0].score,
        feedback: a.grades[0].feedback,
        isAutoScored: a.grades[0].aiRationale === 'AUTO_SCORED_MCQ'
      } : null
    }))
  }
}
