// Soumettre manuellement la tentative de l'étudiant
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function submitAttempt() {
    // Trouver la dernière tentative IN_PROGRESS de student1
    const student = await prisma.user.findUnique({
        where: { email: 'student1@demo.edu' }
    });

    if (!student) {
        console.log('Student not found');
        return;
    }

    const attempt = await prisma.attempt.findFirst({
        where: {
            studentId: student.id,
            status: 'IN_PROGRESS'
        },
        orderBy: {
            startedAt: 'desc'
        }
    });

    if (!attempt) {
        console.log('No IN_PROGRESS attempt found for student');
        return;
    }

    console.log('Found attempt:', attempt.id);
    console.log('Status:', attempt.status);

    // Soumettre la tentative
    const updated = await prisma.attempt.update({
        where: { id: attempt.id },
        data: {
            status: 'SUBMITTED',
            submittedAt: new Date()
        }
    });

    console.log('Attempt submitted!');
    console.log('New status:', updated.status);
    console.log('Submitted at:', updated.submittedAt);
}

submitAttempt()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
