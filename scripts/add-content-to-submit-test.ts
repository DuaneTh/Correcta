import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    // Find "Submit Test Exam"
    const exam = await prisma.exam.findFirst({
        where: { title: "Submit Test Exam" },
        include: { sections: { include: { questions: { include: { segments: true } } } } }
    })

    if (!exam) {
        console.log("Exam 'Submit Test Exam' not found")
        return
    }

    console.log(`Found exam: ${exam.title}`)

    // Check if it already has content
    if (exam.sections.length > 0) {
        console.log(`Exam already has ${exam.sections.length} section(s)`)
        return
    }

    // Add a section with a question
    const section = await prisma.examSection.create({
        data: {
            examId: exam.id,
            title: "Section 1",
            order: 1,
            questions: {
                create: [
                    {
                        content: "<p>Qu'est-ce qu'un test d'intégration end-to-end?</p>",
                        type: "TEXT",
                        order: 1,
                        segments: {
                            create: [
                                {
                                    instruction: "Répondez en quelques phrases",
                                    maxPoints: 10,
                                }
                            ]
                        }
                    }
                ]
            }
        }
    })

    console.log(`Added section with question: ${section.id}`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
