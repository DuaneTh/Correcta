// Vérifier et assigner l'exam E2E Test Exam à l'étudiant
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function assignExamToStudent() {
    const examId = 'ae698a9e-70df-44ac-a68c-d895acb1cd12'; // E2E Test Exam

    // 1. Récupérer l'exam
    const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: { course: true }
    });

    console.log('Exam:', exam?.title);
    console.log('Course:', exam?.course.name);
    console.log('ClassIds assigned:', exam?.classIds);

    // 2. Récupérer student1
    const student = await prisma.user.findUnique({
        where: { email: 'student1@demo.edu' },
        include: { enrollments: { include: { class: true } } }
    });

    console.log('\nStudent:', student?.email);
    console.log('Student ID:', student?.id);
    console.log('Student enrollments:', student?.enrollments.map(e => ({
        classId: e.classId,
        className: e.class.name,
        courseId: e.class.courseId
    })));

    if (!exam || !student) {
        console.log('Exam ou Student introuvable');
        return;
    }

    // 3. Vérifier si l'étudiant a une classe du course de l'exam
    const studentClasses = student.enrollments.map(e => e.classId);
    const examClasses = exam.classIds;

    const hasAccess = studentClasses.some(sc => examClasses.includes(sc));
    console.log('\nStudent has access to exam?', hasAccess);

    if (!hasAccess) {
        console.log('\nAjout de la classe de l\'étudiant aux classIds de l\'exam...');
        const studentClassInCourse = student.enrollments.find(e => e.class.courseId === exam.courseId);

        if (studentClassInCourse) {
            await prisma.exam.update({
                where: { id: examId },
                data: {
                    classIds: [...examClasses, studentClassInCourse.classId]
                }
            });
            console.log('Classe ajoutée:', studentClassInCourse.classId);
        } else {
            console.log('Étudiant n\'est pas inscrit dans le cours de l\'exam');
        }
    }
}

assignExamToStudent()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
