
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Cleaning up old exams...');

    const examsToDelete = await prisma.exam.findMany({
        where: {
            title: {
                in: ['E2E Test Exam', 'E2E Test Exam Future', 'E2E Final Exam']
            }
        },
        select: { id: true }
    });

    const examIds = examsToDelete.map(e => e.id);

    if (examIds.length > 0) {
        console.log(`Deleting ${examIds.length} exams...`);

        // Delete attempts first
        await prisma.attempt.deleteMany({
            where: { examId: { in: examIds } }
        });

        // Delete sections (should cascade questions/options if schema is set up)
        await prisma.examSection.deleteMany({
            where: { examId: { in: examIds } }
        });

        // Delete exams
        await prisma.exam.deleteMany({
            where: { id: { in: examIds } }
        });
    }

    console.log('Creating E2E Final Exam...');
    const teacher = await prisma.user.findUnique({
        where: { email: 'teacher1@demo.edu' }
    });

    if (!teacher) {
        throw new Error('Teacher not found');
    }

    const exam = await prisma.exam.create({
        data: {
            title: 'E2E Final Exam',
            description: 'Exam for end-to-end testing',
            startAt: new Date(Date.now() - 3600 * 1000), // Started 1 hour ago
            endAt: new Date(Date.now() + 3600 * 1000),   // Ends in 1 hour
            durationMinutes: 60,
            authorId: teacher.id,
            courseId: 'course-cs101', // Assuming this exists from seed
            classIds: [],
            sections: {
                create: {
                    title: 'Main Section',
                    order: 0,
                    questions: {
                        create: [
                            {
                                content: 'What is 2+2?',
                                type: 'TEXT',
                                order: 0,
                                segments: {
                                    create: [
                                        {
                                            instruction: 'Provide a short answer.',
                                            maxPoints: 1,
                                            order: 0,
                                        }
                                    ]
                                }
                            },
                            {
                                content: 'Explain the importance of testing.',
                                type: 'TEXT',
                                order: 1,
                                segments: {
                                    create: [
                                        {
                                            instruction: 'Provide a few sentences.',
                                            maxPoints: 5,
                                            order: 0,
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                }
            }
        }
    });

    console.log(`Created exam: ${exam.id}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
