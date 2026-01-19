import { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { buildAuthOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isStudent } from '@/lib/api-auth'
import { getExamEndAt } from '@/lib/exam-time'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import ExamStartPage from './ExamStartPage'

export const metadata: Metadata = {
  title: 'Take Exam | Correcta',
}

interface TakeExamPageProps {
  params: Promise<{
    examId: string
  }>
}

/**
 * Take Exam Page
 *
 * Entry point for students to start or resume an exam.
 *
 * Behavior:
 * 1. If no attempt exists: Shows "Start Exam" cover page
 * 2. If IN_PROGRESS attempt exists: Redirects to exam room
 * 3. If SUBMITTED attempt exists: Redirects to exams list
 */
export default async function TakeExamPage({ params }: TakeExamPageProps) {
  const { examId } = await params
  const authOptions = await buildAuthOptions()
  const session = await getServerSession(authOptions)

  // Auth check
  if (!session || !session.user) {
    redirect('/login')
  }

  if (!isStudent(session)) {
    const role = session.user.role
    if (role === 'TEACHER') {
      redirect('/teacher/courses')
    }
    if (role === 'SCHOOL_ADMIN' || role === 'PLATFORM_ADMIN') {
      redirect('/admin')
    }
    redirect('/login')
  }

  // Load exam with enrollment check
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
      },
      author: {
        select: {
          id: true,
          name: true,
          email: true,
        }
      },
      sections: {
        include: {
          questions: {
            select: { id: true, type: true }
          }
        }
      }
    }
  })

  // Exam validation
  if (!exam || exam.archivedAt || exam.course.archivedAt) {
    notFound()
  }

  // Must be PUBLISHED and have valid config
  const hasValidDuration = exam.durationMinutes !== null && exam.durationMinutes > 0
  const hasValidStartDate = exam.startAt !== null && exam.startAt > new Date('2000-01-01')
  if (exam.status === 'DRAFT' || !hasValidDuration || !hasValidStartDate) {
    notFound()
  }

  // Check enrollment
  const enrolledClassIds = exam.course.classes
    .filter((cls) => cls.enrollments.length > 0)
    .map((cls) => cls.id)

  if (enrolledClassIds.length === 0) {
    redirect('/student/exams')
  }

  // Check time window
  const now = new Date()
  const examEndAt = getExamEndAt(exam.startAt, exam.durationMinutes, exam.endAt)

  if (exam.startAt && now < exam.startAt) {
    // Exam hasn't started yet - redirect to exams list
    redirect('/student/exams')
  }

  if (examEndAt && now > examEndAt) {
    // Exam has ended - redirect to exams list
    redirect('/student/exams')
  }

  // Check for existing attempt
  const existingAttempt = await prisma.attempt.findFirst({
    where: {
      examId,
      studentId: session.user.id
    },
    select: {
      id: true,
      status: true
    }
  })

  // If attempt exists and in progress, redirect to exam room
  if (existingAttempt?.status === 'IN_PROGRESS') {
    redirect(`/student/attempts/${existingAttempt.id}`)
  }

  // If attempt submitted, redirect to exams list
  if (existingAttempt) {
    redirect('/student/exams')
  }

  // Count questions
  const questionCount = exam.sections.reduce(
    (sum, section) => sum + section.questions.length,
    0
  )

  // No attempt exists - show start page
  const locale = await getLocale()
  const dictionary = await getDictionary()

  const examData = {
    id: exam.id,
    title: exam.title,
    description: exam.description,
    durationMinutes: exam.durationMinutes,
    startAt: exam.startAt?.toISOString() ?? null,
    endAt: exam.endAt?.toISOString() ?? null,
    examEndAt: examEndAt?.toISOString() ?? null,
    requireHonorCommitment: exam.requireHonorCommitment,
    allowedMaterials: exam.allowedMaterials,
    course: {
      code: exam.course.code,
      name: exam.course.name,
    },
    author: exam.author
      ? {
          name: exam.author.name,
        }
      : null,
    questionCount,
  }

  return (
    <ExamStartPage
      exam={examData}
      studentName={session.user.name}
      dictionary={dictionary}
      locale={locale}
    />
  )
}
