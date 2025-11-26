// Récupérer l'ID du dernier exam créé et ajouter du contenu
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupTestExam() {
    // Trouver le dernier exam créé (Submit Test Exam)
    const exam = await prisma.exam.findFirst({
        where: {
            title: { contains: 'Submit Test' }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    if (!exam) {
        console.log('Exam "Submit Test Exam" not found');
        return;
    }

    console.log('Found exam:', exam.id, exam.title);

    // Ajouter une section et une question
    const section = await prisma.examSection.create({
        data: {
            examId: exam.id,
            title: 'Section unique',
            order: 0
        }
    });

    const question = await prisma.question.create({
        data: {
            sectionId: section.id,
            order: 0,
            content: 'Expliquez ce qu\'est un test d\'interface utilisateur.',
            type: 'TEXT'
        }
    });

    const segment = await prisma.questionSegment.create({
        data: {
            questionId: question.id,
            instruction: 'Réponse attendue avec des exemples concrets',
            maxPoints: 10
        }
    });

    console.log('Content added:');
    console.log('  Section:', section.id);
    console.log('  Question:', question.id);
    console.log('  Segment:', segment.id);

    // Assigner à la classe de l'étudiant
    await prisma.exam.update({
        where: { id: exam.id },
        data: {
            classIds: ['class-1'] // student1@demo.edu est dans class-1
        }
    });

    console.log('Exam assigned to class-1');
    console.log('\nReady for testing!');
    console.log('Exam ID:', exam.id);
}

setupTestExam()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
