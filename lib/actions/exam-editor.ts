'use server'

import { getServerSession } from 'next-auth'
import { buildAuthOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { parseContent } from '@/lib/content'
import { getExamPermissions } from '@/lib/exam-permissions'
import type { StudentToolsConfig } from '@/types/exams'

/**
 * Creates a new draft exam for the specified course.
 * Returns the new exam's ID.
 */
export async function createDraftExam(courseId: string) {
  const cookieStore = await cookies()
  const institutionId = cookieStore.get('correcta-institution')?.value

  const authOptions = await buildAuthOptions(institutionId)
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role === 'STUDENT') {
    throw new Error('Unauthorized')
  }

  // Verify course exists and user has access
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, institutionId: true, archivedAt: true }
  })

  if (!course || course.archivedAt || course.institutionId !== session.user.institutionId) {
    throw new Error('Course not found')
  }

  // Create the draft exam with a default section
  const exam = await prisma.$transaction(async (tx) => {
    const newExam = await tx.exam.create({
      data: {
        title: 'New Exam',
        courseId,
        status: 'DRAFT',
        authorId: session.user.id,
      }
    })

    // Create a default section
    await tx.examSection.create({
      data: {
        examId: newExam.id,
        title: '',
        order: 0,
        isDefault: true,
      }
    })

    return newExam
  })

  return exam.id
}

/**
 * Fetches the exam with all sections and questions for the editor.
 * Validates user has permission (author or admin).
 */
export async function getExamForEditor(examId: string) {
  const cookieStore = await cookies()
  const institutionId = cookieStore.get('correcta-institution')?.value

  const authOptions = await buildAuthOptions(institutionId)
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role === 'STUDENT') {
    throw new Error('Unauthorized')
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      course: {
        select: {
          id: true,
          code: true,
          name: true,
          institutionId: true,
          archivedAt: true,
        }
      },
      sections: {
        where: { exam: { archivedAt: null } },
        include: {
          questions: {
            include: {
              segments: {
                include: { rubric: true },
                orderBy: { order: 'asc' }
              }
            },
            orderBy: { order: 'asc' }
          }
        },
        orderBy: { order: 'asc' }
      },
      author: {
        select: {
          id: true,
          name: true,
          email: true,
        }
      }
    }
  })

  if (!exam || exam.archivedAt || exam.course.archivedAt) {
    throw new Error('Exam not found')
  }

  if (exam.course.institutionId !== session.user.institutionId) {
    throw new Error('Unauthorized')
  }

  const { canEdit } = await getExamPermissions(examId, {
    id: session.user.id,
    institutionId: session.user.institutionId,
    role: session.user.role,
  })

  if (!canEdit) {
    throw new Error('Forbidden')
  }

  // Transform the exam data for the editor
  return {
    id: exam.id,
    title: exam.title,
    description: exam.description,
    courseId: exam.courseId,
    course: {
      code: exam.course.code,
      name: exam.course.name,
    },
    status: exam.status,
    durationMinutes: exam.durationMinutes,
    startAt: exam.startAt?.toISOString() ?? null,
    endAt: exam.endAt?.toISOString() ?? null,
    author: exam.author,
    sections: exam.sections.map(section => ({
      id: section.id,
      title: section.title,
      order: section.order,
      isDefault: section.isDefault,
      customLabel: section.customLabel,
      introContent: parseContent(section.introContent),
      questions: section.questions.map(question => ({
        id: question.id,
        content: parseContent(question.content),
        answerTemplate: parseContent(question.answerTemplate),
        answerTemplateLocked: question.answerTemplateLocked,
        studentTools: question.studentTools as StudentToolsConfig | null,
        shuffleOptions: question.shuffleOptions,
        type: question.type as 'TEXT' | 'MCQ' | 'CODE',
        order: question.order,
        customLabel: question.customLabel,
        requireAllCorrect: question.requireAllCorrect,
        maxPoints: question.maxPoints,
        segments: question.segments.map(segment => ({
          id: segment.id,
          order: segment.order,
          instruction: segment.instruction,
          maxPoints: segment.maxPoints,
          isCorrect: segment.isCorrect,
          rubric: segment.rubric ? {
            id: segment.rubric.id,
            criteria: segment.rubric.criteria,
            levels: segment.rubric.levels,
            examples: segment.rubric.examples,
          } : null,
        }))
      }))
    })),
    updatedAt: exam.updatedAt.toISOString(),
  }
}

/**
 * Updates the top-level exam properties.
 */
export async function updateExamMetadata(
  examId: string,
  data: {
    title?: string
    description?: string | null
    durationMinutes?: number | null
  }
) {
  const cookieStore = await cookies()
  const institutionId = cookieStore.get('correcta-institution')?.value

  const authOptions = await buildAuthOptions(institutionId)
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role === 'STUDENT') {
    throw new Error('Unauthorized')
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { course: true }
  })

  if (!exam || exam.archivedAt || exam.course.archivedAt) {
    throw new Error('Exam not found')
  }

  if (exam.course.institutionId !== session.user.institutionId) {
    throw new Error('Unauthorized')
  }

  const { canEdit } = await getExamPermissions(examId, {
    id: session.user.id,
    institutionId: session.user.institutionId,
    role: session.user.role,
  })

  if (!canEdit) {
    throw new Error('Forbidden')
  }

  const updateData: Record<string, unknown> = {}
  if (data.title !== undefined) updateData.title = data.title
  if (data.description !== undefined) updateData.description = data.description
  if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes

  if (Object.keys(updateData).length === 0) {
    throw new Error('No fields to update')
  }

  const updated = await prisma.exam.update({
    where: { id: examId },
    data: updateData,
    select: {
      id: true,
      title: true,
      description: true,
      durationMinutes: true,
      updatedAt: true,
    }
  })

  revalidatePath(`/teacher/exams/${examId}/edit`)

  return {
    ...updated,
    updatedAt: updated.updatedAt.toISOString(),
  }
}

/**
 * Adds a new question to the exam.
 * Creates a new question with the specified type and appends it to the section.
 */
export async function addQuestion(
  examId: string,
  type: 'TEXT' | 'MCQ',
  sectionId?: string
) {
  const cookieStore = await cookies()
  const institutionId = cookieStore.get('correcta-institution')?.value

  const authOptions = await buildAuthOptions(institutionId)
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role === 'STUDENT') {
    throw new Error('Unauthorized')
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { course: true }
  })

  if (!exam || exam.archivedAt || exam.course.archivedAt) {
    throw new Error('Exam not found')
  }

  if (exam.course.institutionId !== session.user.institutionId) {
    throw new Error('Unauthorized')
  }

  const { canEdit } = await getExamPermissions(examId, {
    id: session.user.id,
    institutionId: session.user.institutionId,
    role: session.user.role,
  })

  if (!canEdit) {
    throw new Error('Forbidden')
  }

  if (!['TEXT', 'MCQ'].includes(type)) {
    throw new Error('Invalid question type')
  }

  const result = await prisma.$transaction(async (tx) => {
    // Find target section (use provided, or find/create default)
    let targetSection

    if (sectionId) {
      targetSection = await tx.examSection.findUnique({
        where: { id: sectionId }
      })
      if (!targetSection || targetSection.examId !== examId) {
        throw new Error('Invalid section')
      }
    } else {
      // Use or create default section
      targetSection = await tx.examSection.findFirst({
        where: { examId, isDefault: true }
      })

      if (!targetSection) {
        targetSection = await tx.examSection.create({
          data: {
            examId,
            title: '',
            order: 0,
            isDefault: true,
          }
        })
      }
    }

    // Get max order in section
    const lastQuestion = await tx.question.findFirst({
      where: { sectionId: targetSection.id },
      orderBy: { order: 'desc' },
      select: { order: true }
    })

    const newOrder = (lastQuestion?.order ?? -1) + 1

    // Create the question with default points of 1
    const question = await tx.question.create({
      data: {
        sectionId: targetSection.id,
        content: JSON.stringify([{ id: crypto.randomUUID(), type: 'text', text: '' }]),
        answerTemplate: '',
        type,
        order: newOrder,
      }
    })

    // Create default segment with 1 point (only for TEXT questions)
    // MCQ questions use segments as options, handled differently
    if (type === 'TEXT') {
      await tx.questionSegment.create({
        data: {
          questionId: question.id,
          order: 0,
          instruction: '',
          maxPoints: 1, // Default to 1 point
          rubric: {
            create: {
              criteria: '',
              levels: [],
              examples: []
            }
          }
        }
      })
    }

    // Fetch the created question with its segments
    const fullQuestion = await tx.question.findUnique({
      where: { id: question.id },
      include: {
        segments: {
          include: { rubric: true },
          orderBy: { order: 'asc' }
        }
      }
    })

    return {
      question: fullQuestion ? {
        id: fullQuestion.id,
        content: parseContent(fullQuestion.content),
        answerTemplate: parseContent(fullQuestion.answerTemplate),
        answerTemplateLocked: fullQuestion.answerTemplateLocked,
        studentTools: fullQuestion.studentTools as StudentToolsConfig | null,
        shuffleOptions: fullQuestion.shuffleOptions,
        type: fullQuestion.type as 'TEXT' | 'MCQ' | 'CODE',
        order: fullQuestion.order,
        customLabel: fullQuestion.customLabel,
        requireAllCorrect: fullQuestion.requireAllCorrect,
        maxPoints: fullQuestion.maxPoints,
        segments: fullQuestion.segments.map(segment => ({
          id: segment.id,
          order: segment.order,
          instruction: segment.instruction,
          maxPoints: segment.maxPoints,
          isCorrect: segment.isCorrect,
          rubric: segment.rubric ? {
            id: segment.rubric.id,
            criteria: segment.rubric.criteria,
            levels: segment.rubric.levels,
            examples: segment.rubric.examples,
          } : null,
        }))
      } : null,
      sectionId: targetSection.id,
    }
  })

  revalidatePath(`/teacher/exams/${examId}/edit`)

  return result
}

/**
 * Deletes a question from the exam.
 */
export async function deleteQuestion(questionId: string) {
  const cookieStore = await cookies()
  const institutionId = cookieStore.get('correcta-institution')?.value

  const authOptions = await buildAuthOptions(institutionId)
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role === 'STUDENT') {
    throw new Error('Unauthorized')
  }

  // Find the question and its exam
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      section: {
        include: {
          exam: {
            include: { course: true }
          }
        }
      }
    }
  })

  if (!question) {
    throw new Error('Question not found')
  }

  const exam = question.section.exam

  if (exam.archivedAt || exam.course.archivedAt) {
    throw new Error('Exam not found')
  }

  if (exam.course.institutionId !== session.user.institutionId) {
    throw new Error('Unauthorized')
  }

  const { canEdit } = await getExamPermissions(exam.id, {
    id: session.user.id,
    institutionId: session.user.institutionId,
    role: session.user.role,
  })

  if (!canEdit) {
    throw new Error('Forbidden')
  }

  // Delete the question (cascades to segments and rubrics)
  await prisma.$transaction(async (tx) => {
    // First delete rubrics for the question's segments
    await tx.rubric.deleteMany({
      where: {
        segment: {
          questionId: questionId
        }
      }
    })

    // Then delete the segments
    await tx.questionSegment.deleteMany({
      where: { questionId: questionId }
    })

    // Finally delete the question
    await tx.question.delete({
      where: { id: questionId }
    })
  })

  revalidatePath(`/teacher/exams/${exam.id}/edit`)

  return { success: true }
}
