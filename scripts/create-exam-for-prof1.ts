import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('=== Creating Test Exam for prof1@demo2.edu ===\n')

    // Find prof1@demo2.edu
    const teacher = await prisma.user.findFirst({
        where: { email: 'prof1@demo2.edu' }
    })

    if (!teacher) {
        console.log('Teacher not found!')
        return
    }
    console.log(`Using teacher: ${teacher.name} (${teacher.email})`)

    // Find students in demo2 institution
    const students = await prisma.user.findMany({
        where: {
            role: 'STUDENT',
            institutionId: teacher.institutionId
        },
        take: 4
    })
    console.log(`\nStudents found: ${students.length}`)
    students.forEach(s => console.log(`  - ${s.name} (${s.email})`))

    // Find or create a course for this teacher
    let course = await prisma.course.findFirst({
        where: {
            institutionId: teacher.institutionId!,
            archivedAt: null
        }
    })

    if (!course) {
        console.log('No course found, creating one...')
        course = await prisma.course.create({
            data: {
                name: 'Mathematiques',
                code: 'MATH-101',
                institutionId: teacher.institutionId!
            }
        })
    }
    console.log(`\nUsing course: ${course.name} (${course.code})`)

    // Create exam
    const exam = await prisma.exam.create({
        data: {
            title: 'Test Correction IA - Prof1',
            courseId: course.id,
            authorId: teacher.id,
            status: 'PUBLISHED',
            durationMinutes: 60,
            startAt: new Date(Date.now() - 86400000),
            endAt: new Date(Date.now() + 86400000 * 7),
            sections: {
                create: [{
                    title: 'Questions de calcul',
                    order: 0,
                    questions: {
                        create: [
                            {
                                type: 'TEXT',
                                content: JSON.stringify([
                                    { id: 'q1t', type: 'text', text: 'Calculer la derivee de ' },
                                    { id: 'q1m', type: 'math', latex: 'f(x) = x^3 + 2x^2 - 5x + 1' }
                                ]),
                                order: 0,
                                segments: {
                                    create: [{
                                        order: 0,
                                        maxPoints: 4,
                                        instruction: 'Appliquer les regles de derivation',
                                        rubric: {
                                            create: {
                                                criteria: 'Derivee correcte: 3x^2 + 4x - 5',
                                                levels: [
                                                    { points: 4, description: 'Parfait' },
                                                    { points: 2, description: 'Partiel' },
                                                    { points: 0, description: 'Incorrect' }
                                                ]
                                            }
                                        }
                                    }]
                                }
                            },
                            {
                                type: 'TEXT',
                                content: JSON.stringify([
                                    { id: 'q2t', type: 'text', text: 'Resoudre: ' },
                                    { id: 'q2m', type: 'math', latex: '2x + 5 = 13' }
                                ]),
                                order: 1,
                                segments: {
                                    create: [{
                                        order: 0,
                                        maxPoints: 3,
                                        instruction: 'Isoler x',
                                        rubric: {
                                            create: {
                                                criteria: 'Solution: x = 4 avec etapes',
                                                levels: [
                                                    { points: 3, description: 'Correct avec etapes' },
                                                    { points: 2, description: 'Correct sans etapes' },
                                                    { points: 0, description: 'Incorrect' }
                                                ]
                                            }
                                        }
                                    }]
                                }
                            },
                            {
                                type: 'TEXT',
                                content: JSON.stringify([
                                    { id: 'q3t', type: 'text', text: 'Expliquez le theoreme de Pythagore et donnez un exemple.' }
                                ]),
                                order: 2,
                                segments: {
                                    create: [{
                                        order: 0,
                                        maxPoints: 5,
                                        instruction: 'Definition et exemple',
                                        rubric: {
                                            create: {
                                                criteria: 'a^2 + b^2 = c^2 avec exemple numerique',
                                                levels: [
                                                    { points: 5, description: 'Complet' },
                                                    { points: 3, description: 'Partiel' },
                                                    { points: 0, description: 'Incorrect' }
                                                ]
                                            }
                                        }
                                    }]
                                }
                            }
                        ]
                    }
                }]
            }
        },
        include: {
            sections: {
                include: {
                    questions: {
                        include: { segments: true }
                    }
                }
            }
        }
    })

    console.log(`\nExam created: ${exam.title} (ID: ${exam.id})`)

    const questions = exam.sections[0].questions

    // Student answers
    const studentAnswers = [
        // Student 1 - Excellent
        {
            q1: JSON.stringify([{ id: 'a1', type: 'text', text: "f'(x) = 3x² + 4x - 5" }]),
            q2: JSON.stringify([{ id: 'a2', type: 'text', text: '2x + 5 = 13\n2x = 8\nx = 4' }]),
            q3: JSON.stringify([{ id: 'a3', type: 'text', text: 'Le theoreme de Pythagore: a² + b² = c² dans un triangle rectangle. Exemple: 3² + 4² = 9 + 16 = 25 = 5²' }])
        },
        // Student 2 - Good
        {
            q1: JSON.stringify([{ id: 'a1', type: 'text', text: "3x² + 4x - 5" }]),
            q2: JSON.stringify([{ id: 'a2', type: 'text', text: 'x = 4' }]),
            q3: JSON.stringify([{ id: 'a3', type: 'text', text: 'Pythagore: a² + b² = c². Ex: 3-4-5' }])
        },
        // Student 3 - Partial with errors
        {
            q1: JSON.stringify([{ id: 'a1', type: 'text', text: "3x² + 2x - 5" }]), // Error
            q2: JSON.stringify([{ id: 'a2', type: 'text', text: '2x = 8, x = 4' }]),
            q3: JSON.stringify([{ id: 'a3', type: 'text', text: 'Formule pour triangles' }])
        },
        // Student 4 - Poor
        {
            q1: JSON.stringify([{ id: 'a1', type: 'text', text: 'Je ne sais pas' }]),
            q2: JSON.stringify([{ id: 'a2', type: 'text', text: 'x = 5' }]), // Wrong
            q3: JSON.stringify([{ id: 'a3', type: 'text', text: '' }])
        }
    ]

    // Create attempts - use any 4 students from database
    const allStudents = await prisma.user.findMany({
        where: { role: 'STUDENT' },
        take: 4
    })

    for (let i = 0; i < Math.min(allStudents.length, 4); i++) {
        const student = allStudents[i]
        const answers = studentAnswers[i]

        const attempt = await prisma.attempt.create({
            data: {
                examId: exam.id,
                studentId: student.id,
                status: 'SUBMITTED',
                startedAt: new Date(Date.now() - 3600000),
                submittedAt: new Date(),
                answers: {
                    create: questions.map((q, idx) => ({
                        questionId: q.id,
                        segments: {
                            create: [{
                                segmentId: q.segments[0].id,
                                content: idx === 0 ? answers.q1 : idx === 1 ? answers.q2 : answers.q3
                            }]
                        }
                    }))
                }
            }
        })
        console.log(`Created attempt for ${student.name}: ${attempt.id}`)
    }

    console.log('\n=== Done ===')
    console.log(`\nExam ID: ${exam.id}`)
    console.log(`URL: /dashboard/exams/${exam.id}/grading`)
    console.log(`\nOu via: /teacher/corrections`)
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect()
        await pool.end()
    })
