import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set')

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('=== Creating Test Exam ===\n')

    // 1. Find teacher (prof 1)
    const teachers = await prisma.user.findMany({
        where: { role: { in: ['TEACHER', 'SCHOOL_ADMIN'] } },
        take: 5
    })
    console.log('Teachers found:', teachers.map(t => ({ id: t.id, name: t.name, email: t.email })))

    if (teachers.length === 0) {
        console.log('No teachers found. Creating a test teacher...')
        return
    }

    const teacher = teachers[0]
    console.log(`\nUsing teacher: ${teacher.name} (${teacher.email})`)

    // 2. Find students
    const students = await prisma.user.findMany({
        where: { role: 'STUDENT' },
        take: 4
    })
    console.log('\nStudents found:', students.map(s => ({ id: s.id, name: s.name, email: s.email })))

    if (students.length < 4) {
        console.log(`Only ${students.length} students found. Need 4 students.`)
    }

    // 3. Find or create a course
    let course = await prisma.course.findFirst({
        where: {
            institutionId: teacher.institutionId!,
            archivedAt: null
        }
    })

    if (!course) {
        console.log('No course found. Creating one...')
        course = await prisma.course.create({
            data: {
                name: 'Mathematiques - Test',
                code: 'MATH101',
                institutionId: teacher.institutionId!,
            }
        })
    }
    console.log(`\nUsing course: ${course.name} (${course.code})`)

    // 4. Create exam
    const exam = await prisma.exam.create({
        data: {
            title: 'Examen Test - Correction IA',
            courseId: course.id,
            authorId: teacher.id,
            status: 'PUBLISHED',
            durationMinutes: 60,
            startAt: new Date(Date.now() - 86400000), // Started yesterday
            endAt: new Date(Date.now() + 86400000), // Ends tomorrow
            sections: {
                create: [
                    {
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
                                                    criteria: 'Derivee correcte: 3x^2 + 4x - 5. Points pour chaque terme correctement derive.',
                                                    levels: [
                                                        { points: 4, description: 'Derivee parfaitement correcte' },
                                                        { points: 2, description: 'Derivee partiellement correcte' },
                                                        { points: 0, description: 'Derivee incorrecte' }
                                                    ]
                                                }
                                            }
                                        }]
                                    }
                                },
                                {
                                    type: 'TEXT',
                                    content: JSON.stringify([
                                        { id: 'q2t', type: 'text', text: 'Resoudre l\'equation: ' },
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
                                                    criteria: 'Solution: x = 4. Montrer les etapes de calcul.',
                                                    levels: [
                                                        { points: 3, description: 'Solution correcte avec etapes' },
                                                        { points: 2, description: 'Solution correcte sans etapes' },
                                                        { points: 0, description: 'Solution incorrecte' }
                                                    ]
                                                }
                                            }
                                        }]
                                    }
                                },
                                {
                                    type: 'TEXT',
                                    content: JSON.stringify([
                                        { id: 'q3t', type: 'text', text: 'Qu\'est-ce que le theoreme de Pythagore ? Donnez un exemple d\'application.' }
                                    ]),
                                    order: 2,
                                    segments: {
                                        create: [{
                                            order: 0,
                                            maxPoints: 5,
                                            instruction: 'Definition et exemple',
                                            rubric: {
                                                create: {
                                                    criteria: 'Definition correcte (a^2 + b^2 = c^2 pour triangle rectangle). Exemple concret avec calcul.',
                                                    levels: [
                                                        { points: 5, description: 'Definition et exemple parfaits' },
                                                        { points: 3, description: 'Definition correcte, exemple incomplet' },
                                                        { points: 1, description: 'Definition approximative' },
                                                        { points: 0, description: 'Reponse incorrecte ou vide' }
                                                    ]
                                                }
                                            }
                                        }]
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        },
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
    })

    console.log(`\nExam created: ${exam.title} (ID: ${exam.id})`)
    console.log(`Questions: ${exam.sections[0].questions.length}`)

    // 5. Create attempts with different answers for each student
    const questions = exam.sections[0].questions

    // Student answers - varying quality
    const studentAnswers = [
        // Student 1 - Excellent answers
        {
            q1: JSON.stringify([{ id: 'a1', type: 'text', text: 'La derivee de f(x) est: ' }, { id: 'a1m', type: 'math', latex: "f'(x) = 3x^2 + 4x - 5" }]),
            q2: JSON.stringify([{ id: 'a2', type: 'text', text: '2x + 5 = 13\n2x = 13 - 5\n2x = 8\nx = 4' }]),
            q3: JSON.stringify([{ id: 'a3', type: 'text', text: 'Le theoreme de Pythagore stipule que dans un triangle rectangle, le carre de l\'hypotenuse est egal a la somme des carres des deux autres cotes: a² + b² = c². Exemple: un triangle avec cotes 3 et 4, l\'hypotenuse = √(9+16) = √25 = 5.' }])
        },
        // Student 2 - Good answers with minor errors
        {
            q1: JSON.stringify([{ id: 'a1', type: 'text', text: 'f\'(x) = 3x² + 4x - 5' }]),
            q2: JSON.stringify([{ id: 'a2', type: 'text', text: 'x = 4' }]),
            q3: JSON.stringify([{ id: 'a3', type: 'text', text: 'Pythagore dit que a² + b² = c² dans un triangle rectangle. Par exemple 3² + 4² = 5².' }])
        },
        // Student 3 - Partial answers
        {
            q1: JSON.stringify([{ id: 'a1', type: 'text', text: 'f\'(x) = 3x² + 2x - 5' }]), // Error in middle term
            q2: JSON.stringify([{ id: 'a2', type: 'text', text: '2x = 8 donc x = 4' }]),
            q3: JSON.stringify([{ id: 'a3', type: 'text', text: 'C\'est une formule pour les triangles.' }])
        },
        // Student 4 - Poor/empty answers
        {
            q1: JSON.stringify([{ id: 'a1', type: 'text', text: 'Je ne sais pas' }]),
            q2: JSON.stringify([{ id: 'a2', type: 'text', text: 'x = 5' }]), // Wrong answer
            q3: JSON.stringify([{ id: 'a3', type: 'text', text: '' }]) // Empty
        }
    ]

    for (let i = 0; i < Math.min(students.length, 4); i++) {
        const student = students[i]
        const answers = studentAnswers[i]

        // Create attempt
        const attempt = await prisma.attempt.create({
            data: {
                examId: exam.id,
                studentId: student.id,
                status: 'SUBMITTED',
                startedAt: new Date(Date.now() - 3600000), // 1 hour ago
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

        console.log(`\nCreated attempt for ${student.name}: ${attempt.id}`)
    }

    console.log('\n=== Test Exam Created Successfully ===')
    console.log(`\nExam ID: ${exam.id}`)
    console.log(`Go to: /dashboard/exams/${exam.id}/grading`)
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect()
        await pool.end()
    })
