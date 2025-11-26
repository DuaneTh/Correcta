// Ajuster le courseId de l'exam pour correspondre à l'étudiant
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixExamCourse() {
    const examId = 'ae698a9e-70df-44ac-a68c-d895acb1cd12'; // E2E Test Exam
    const studentEmail = 'student1@demo.edu';

    // Récupérer l'étudiant et ses enrollments
    const student = await prisma.user.findUnique({
        where: { email: studentEmail },
        include: { enrollments: { include: { class: true } } }
    });

    if (!student || student.enrollments.length === 0) {
        console.log('Student introuvable ou sans enrollments');
        return;
    }

    // Utiliser le premier enrollment
    const enrollment = student.enrollments[0];
    console.log('Utilisation de:', enrollment.class.name, 'dans le cours:', enrollment.class.courseId);

    // Mettre à jour l'exam
    await prisma.exam.update({
        where: { id: examId },
        data: {
            courseId: enrollment.class.courseId,
            classIds: [enrollment.classId]
        }
    });

    console.log('Exam mis à jour avec courseId:', enrollment.class.courseId);
    console.log('Et classIds:', [enrollment.classId]);
}

fixExamCourse()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
