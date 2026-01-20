import * as React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import { latexToReactPdf, parseMathContent, extractSvgDimensions, latexToSvg } from './math-to-svg'
import { parseContent, segmentsToPlainText } from '@/lib/content'
import type { ContentSegment } from '@/types/exams'

// PDF styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica'
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  subheader: {
    fontSize: 14,
    marginBottom: 10,
    color: '#374151'
  },
  studentInfo: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 4
  },
  studentName: {
    fontSize: 14,
    fontWeight: 'bold'
  },
  studentEmail: {
    fontSize: 10,
    color: '#6b7280'
  },
  totalScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginTop: 5
  },
  question: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottom: '1px solid #e5e7eb'
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  questionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937'
  },
  questionScore: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  scoreGood: {
    color: '#059669'
  },
  scoreMedium: {
    color: '#d97706'
  },
  scoreLow: {
    color: '#dc2626'
  },
  contentLabel: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 8,
    marginBottom: 4
  },
  answerBox: {
    backgroundColor: '#fafafa',
    padding: 8,
    borderRadius: 4,
    marginTop: 4
  },
  feedback: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 4,
    borderLeft: '3px solid #3b82f6'
  },
  feedbackLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1d4ed8',
    marginBottom: 4
  },
  feedbackText: {
    fontSize: 10,
    color: '#1e40af',
    fontStyle: 'italic'
  },
  text: {
    fontSize: 11,
    lineHeight: 1.4
  },
  mathContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  mathInline: {
    marginHorizontal: 2,
    marginVertical: 1
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 9,
    color: '#9ca3af',
    textAlign: 'center'
  }
})

// Types
export interface QuestionExportData {
  id: string
  order: number
  sectionOrder: number
  content: string  // JSON string of ContentSegment[]
  maxPoints: number
  studentAnswer: string  // Plain text or LaTeX string
  score: number | null
  feedback: string | null
}

export interface AttemptExportData {
  id: string
  student: {
    name: string
    email: string
  }
  submittedAt: string | null
  totalScore: number
  maxPoints: number
  questions: QuestionExportData[]
}

export interface ExportDocumentProps {
  exam: {
    title: string
    description?: string | null
  }
  attempts: AttemptExportData[]
  generatedAt: string
}

/**
 * Render LaTeX as actual SVG using MathJax + react-pdf transformation
 * NOT a placeholder - renders real formatted math
 */
function MathSvg({ latex }: { latex: string }) {
  // Convert LaTeX to react-pdf Svg element
  const svgElement = latexToReactPdf(latex, false)

  if (!svgElement) {
    // Fallback: show LaTeX source if conversion fails
    return <Text style={{ fontSize: 10, color: '#6b7280' }}>[{latex}]</Text>
  }

  // Get dimensions for proper sizing
  const svgString = latexToSvg(latex, false)
  const { width, height } = extractSvgDimensions(svgString)

  return (
    <View style={[styles.mathInline, { width, height }]}>
      {svgElement}
    </View>
  )
}

/**
 * Render content with math as Text + SVG components
 */
function MathContent({ content }: { content: string }) {
  // For complex content (JSON segments), convert to plain text first
  let textContent = content
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) {
      textContent = segmentsToPlainText(parsed as ContentSegment[])
    }
  } catch {
    // Not JSON, use as-is
  }

  const parts = parseMathContent(textContent)

  // If no math, render as simple text
  if (parts.every(p => p.type === 'text')) {
    return <Text style={styles.text}>{textContent}</Text>
  }

  return (
    <View style={styles.mathContainer}>
      {parts.map((part, idx) => {
        if (part.type === 'math') {
          return <MathSvg key={idx} latex={part.content} />
        }
        return <Text key={idx} style={styles.text}>{part.content}</Text>
      })}
    </View>
  )
}

/**
 * Get score color based on percentage
 */
function getScoreStyle(score: number, maxPoints: number) {
  if (maxPoints === 0) return styles.text
  const percentage = (score / maxPoints) * 100
  if (percentage >= 70) return styles.scoreGood
  if (percentage >= 40) return styles.scoreMedium
  return styles.scoreLow
}

/**
 * Single student report page
 */
function StudentReport({ exam, attempt }: { exam: ExportDocumentProps['exam']; attempt: AttemptExportData }) {
  const scorePercentage = attempt.maxPoints > 0
    ? Math.round((attempt.totalScore / attempt.maxPoints) * 100)
    : 0

  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <Text style={styles.header}>{exam.title}</Text>

      {/* Student info */}
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{attempt.student.name}</Text>
        <Text style={styles.studentEmail}>{attempt.student.email}</Text>
        <Text style={[styles.totalScore, getScoreStyle(attempt.totalScore, attempt.maxPoints)]}>
          Score: {attempt.totalScore} / {attempt.maxPoints} ({scorePercentage}%)
        </Text>
      </View>

      {/* Questions */}
      {attempt.questions.map((q) => (
        <View key={q.id} style={styles.question} wrap={false}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionLabel}>
              Question {q.sectionOrder}.{q.order + 1}
            </Text>
            <Text style={[styles.questionScore, q.score !== null ? getScoreStyle(q.score, q.maxPoints) : {}]}>
              {q.score !== null ? `${q.score} / ${q.maxPoints}` : 'Non note'}
            </Text>
          </View>

          {/* Student answer */}
          <Text style={styles.contentLabel}>Reponse de l&apos;etudiant</Text>
          <View style={styles.answerBox}>
            <MathContent content={q.studentAnswer || '(Pas de reponse)'} />
          </View>

          {/* Feedback */}
          {q.feedback && (
            <View style={styles.feedback}>
              <Text style={styles.feedbackLabel}>Commentaire</Text>
              <Text style={styles.feedbackText}>{q.feedback}</Text>
            </View>
          )}
        </View>
      ))}

      {/* Footer */}
      <Text style={styles.footer} fixed>
        Genere par Correcta - {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString('fr-FR') : ''}
      </Text>
    </Page>
  )
}

/**
 * Full export document with all students
 */
export function ExportDocument({ exam, attempts }: ExportDocumentProps) {
  return (
    <Document>
      {attempts.map(attempt => (
        <StudentReport key={attempt.id} exam={exam} attempt={attempt} />
      ))}
    </Document>
  )
}

/**
 * Single student report document
 */
export function StudentReportDocument({ exam, attempt }: { exam: ExportDocumentProps['exam']; attempt: AttemptExportData }) {
  return (
    <Document>
      <StudentReport exam={exam} attempt={attempt} />
    </Document>
  )
}
