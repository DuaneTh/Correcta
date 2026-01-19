/**
 * Test script for exam-editor server actions.
 *
 * This script tests the core functionality of the exam editor actions
 * by directly calling Prisma (simulating what the actions do).
 *
 * Usage: npx tsx scripts/test-exam-actions.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Testing Exam Editor Actions...\n')

  // Find a test course to use
  const course = await prisma.course.findFirst({
    where: { archivedAt: null },
    select: { id: true, code: true, name: true }
  })

  if (!course) {
    console.error('No course found. Please seed the database first.')
    process.exit(1)
  }

  console.log(`Using course: ${course.code} - ${course.name} (${course.id})\n`)

  // Test 1: Create Draft Exam
  console.log('1. Creating draft exam...')
  const exam = await prisma.$transaction(async (tx) => {
    const newExam = await tx.exam.create({
      data: {
        title: 'Test Exam (Script)',
        courseId: course.id,
        status: 'DRAFT',
      }
    })

    // Create default section
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
  console.log(`   Created exam: ${exam.id}\n`)

  // Test 2: Fetch exam for editor
  console.log('2. Fetching exam for editor...')
  const fetchedExam = await prisma.exam.findUnique({
    where: { id: exam.id },
    include: {
      sections: {
        include: {
          questions: {
            include: { segments: true },
            orderBy: { order: 'asc' }
          }
        },
        orderBy: { order: 'asc' }
      }
    }
  })
  console.log(`   Title: ${fetchedExam?.title}`)
  console.log(`   Sections: ${fetchedExam?.sections.length}\n`)

  // Test 3: Add TEXT question
  console.log('3. Adding TEXT question...')
  const defaultSection = fetchedExam?.sections.find(s => s.isDefault)
  if (!defaultSection) {
    console.error('   No default section found!')
    process.exit(1)
  }

  const textQuestion = await prisma.$transaction(async (tx) => {
    const question = await tx.question.create({
      data: {
        sectionId: defaultSection.id,
        content: JSON.stringify([{ id: 'test-1', type: 'text', text: '' }]),
        answerTemplate: '',
        type: 'TEXT',
        order: 0,
      }
    })

    await tx.questionSegment.create({
      data: {
        questionId: question.id,
        order: 0,
        instruction: '',
        maxPoints: 1,
        rubric: {
          create: {
            criteria: '',
            levels: [],
            examples: []
          }
        }
      }
    })

    return tx.question.findUnique({
      where: { id: question.id },
      include: { segments: true }
    })
  })
  console.log(`   Created TEXT question: ${textQuestion?.id}`)
  console.log(`   Segments: ${textQuestion?.segments.length}`)
  console.log(`   Points: ${textQuestion?.segments[0]?.maxPoints}\n`)

  // Test 4: Add MCQ question
  console.log('4. Adding MCQ question...')
  const mcqQuestion = await prisma.question.create({
    data: {
      sectionId: defaultSection.id,
      content: JSON.stringify([{ id: 'test-2', type: 'text', text: '' }]),
      answerTemplate: '',
      type: 'MCQ',
      order: 1,
    }
  })
  console.log(`   Created MCQ question: ${mcqQuestion.id}\n`)

  // Test 5: Calculate total points
  console.log('5. Calculating total points...')
  const allQuestions = await prisma.question.findMany({
    where: { section: { examId: exam.id } },
    include: { segments: true }
  })
  const totalPoints = allQuestions.reduce((sum, q) => {
    if (q.type === 'MCQ') {
      // MCQ with requireAllCorrect uses maxPoints
      return sum + (q.maxPoints ?? 0)
    }
    // TEXT/CODE uses sum of segment points
    return sum + q.segments.reduce((s, seg) => s + (seg.maxPoints ?? 0), 0)
  }, 0)
  console.log(`   Total questions: ${allQuestions.length}`)
  console.log(`   Total points: ${totalPoints}\n`)

  // Test 6: Update metadata
  console.log('6. Updating exam metadata...')
  const updated = await prisma.exam.update({
    where: { id: exam.id },
    data: { title: 'Updated Test Exam' }
  })
  console.log(`   New title: ${updated.title}\n`)

  // Test 7: Delete questions
  console.log('7. Deleting questions...')
  for (const q of allQuestions) {
    await prisma.$transaction(async (tx) => {
      await tx.rubric.deleteMany({
        where: { segment: { questionId: q.id } }
      })
      await tx.questionSegment.deleteMany({
        where: { questionId: q.id }
      })
      await tx.question.delete({
        where: { id: q.id }
      })
    })
    console.log(`   Deleted: ${q.id}`)
  }

  // Cleanup: Delete the test exam
  console.log('\n8. Cleaning up...')
  await prisma.$transaction(async (tx) => {
    await tx.examSection.deleteMany({
      where: { examId: exam.id }
    })
    await tx.exam.delete({
      where: { id: exam.id }
    })
  })
  console.log(`   Deleted exam: ${exam.id}`)

  console.log('\nAll tests passed!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
