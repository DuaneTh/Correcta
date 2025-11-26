// Ajouter du contenu à l'exam E2E Test Exam
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addExamContent() {
    const examId = 'ae698a9e-70df-44ac-a68c-d895acb1cd12'; // E2E Test Exam

    console.log('Adding content to E2E Test Exam...');

    // 1. Créer une section
    const section = await prisma.examSection.create({
        data: {
            examId,
            title: 'Section de test',
            order: 0
        }
    });

    console.log('Section créée:', section.id);

    // 2. Créer une question
    const question = await prisma.question.create({
        data: {
            sectionId: section.id,
            order: 0,
            content: 'Décrivez brièvement ce qu\'est un examen en ligne.',
            type: 'TEXT'
        }
    });

    console.log('Question créée:', question.id);

    // 3. Créer un segment pour cette question (pour l'IA)
    const segment = await prisma.questionSegment.create({
        data: {
            questionId: question.id,
            instruction: 'Pertinence - La réponse mentionne les aspects principaux d\'un examen en ligne',
            maxPoints: 10
        }
    });

    console.log('Segment créé:', segment.id);
    console.log('Contenu ajouté avec succès!');
}

addExamContent()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
