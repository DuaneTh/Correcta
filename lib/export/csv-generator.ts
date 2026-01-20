import * as Papa from 'papaparse'
import { prisma } from '@/lib/prisma'

interface CSVExportOptions {
  examId: string
  classIds?: string[]  // Optional filter by class/subgroup
}

export async function generateGradesCSV(options: CSVExportOptions): Promise<string> {
  const { examId, classIds } = options

  // Build where clause with optional class filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {
    examId,
    status: { in: ['GRADED', 'SUBMITTED'] }  // Include submitted for completeness
  }

  if (classIds && classIds.length > 0) {
    // Get all class IDs including subgroups (children)
    const allClassIds = await getClassIdsWithChildren(classIds)
    whereClause.student = {
      enrollments: {
        some: { classId: { in: allClassIds } }
      }
    }
  }

  // Fetch exam with questions to get question order
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      sections: {
        include: {
          questions: {
            select: {
              id: true,
              order: true,
              segments: { select: { maxPoints: true } }
            },
            orderBy: { order: 'asc' }
          }
        },
        orderBy: { order: 'asc' }
      }
    }
  })

  if (!exam) throw new Error('Exam not found')

  // Build question order map and calculate max points
  const questions = exam.sections.flatMap(s => s.questions)
  const questionMaxPoints: Record<string, number> = {}
  let totalMaxPoints = 0

  questions.forEach(q => {
    const maxPts = q.segments.reduce((sum, seg) => sum + (seg.maxPoints ?? 0), 0)
    questionMaxPoints[q.id] = maxPts
    totalMaxPoints += maxPts
  })

  // Fetch attempts with grades
  const attempts = await prisma.attempt.findMany({
    where: whereClause,
    include: {
      student: { select: { name: true, email: true } },
      answers: {
        include: {
          grades: { select: { score: true } },
          question: {
            select: { id: true, order: true }
          }
        }
      }
    },
    orderBy: { student: { name: 'asc' } }
  })

  // Transform to CSV rows
  const rows = attempts.map(attempt => {
    const row: Record<string, string | number> = {
      'Etudiant': attempt.student.name || '',
      'Email': attempt.student.email || ''
    }

    let total = 0

    // Add question scores in order
    questions.forEach((q, idx) => {
      const answer = attempt.answers.find(a => a.questionId === q.id)
      const score = answer?.grades[0]?.score
      const colName = `Q${idx + 1}`

      if (score !== undefined && score !== null) {
        row[colName] = score
        total += score
      } else {
        row[colName] = ''  // Not graded yet
      }
    })

    row['Total'] = total
    row['Maximum'] = totalMaxPoints

    return row
  })

  // Generate CSV with semicolon delimiter (French locale)
  return Papa.unparse(rows, {
    header: true,
    delimiter: ';'
  })
}

async function getClassIdsWithChildren(classIds: string[]): Promise<string[]> {
  const classes = await prisma.class.findMany({
    where: {
      OR: [
        { id: { in: classIds } },
        { parentId: { in: classIds } }
      ]
    },
    select: { id: true }
  })
  return classes.map(c => c.id)
}
