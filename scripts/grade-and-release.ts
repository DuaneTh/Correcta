import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    const examId = "f1b42330-5179-4581-8298-8d8fd45dbfdd"

    // Find the latest attempt for this exam
    const attempt = await prisma.attempt.findFirst({
        where: { examId },
        orderBy: { startedAt: 'desc' },
        include: {
            exam: { include: { sections: { include: { questions: { include: { segments: true } } } } } }
        }
    })

    if (!attempt) {
        console.log("No attempt found")
        return
    }

    console.log(`Found attempt ${attempt.id}`)

    // Grade each segment
    for (const section of attempt.exam.sections) {
        for (const question of section.questions) {
            for (const segment of question.segments) {
                // Find if this segment already has a grade
                const existingGrade = await prisma.grade.findFirst({
                    where: {
                        answerSegment: {
                            segmentId: segment.id,
                            answer: {
                                attemptId: attempt.id,
                                questionId: question.id
                            }
                        }
                    }
                })

                if (existingGrade) {
                    console.log(`Grade already exists for segment ${segment.id}`)
                    continue
                }

                // Find the answer segment
                const answerSeg = await prisma.answerSegment.findFirst({
                    where: {
                        segmentId: segment.id,
                        answer: {
                            attemptId: attempt.id,
                            questionId: question.id
                        }
                    }
                })

                if (!answerSeg) {
                    console.log(`Answer segment not found for ${segment.id}`)
                    continue
                }

                // Create grade
                await prisma.grade.create({
                    data: {
                        answerSegmentId: answerSeg.id,
                        score: 9,
                        feedback: "Excellente réponse! Vous avez bien compris le concept."
                    }
                })

                console.log(`Created grade for segment ${segment.id}: 9/${segment.maxPoints}`)
            }
        }
    }

    // Update attempt status to GRADED
    await prisma.attempt.update({
        where: { id: attempt.id },
        data: { status: 'GRADED' }
    })
    console.log("Attempt status updated to GRADED")

    // Release results
    await prisma.exam.update({
        where: { id: examId },
        data: {
            gradingConfig: {
                gradesReleased: true,
                gradesReleasedAt: new Date().toISOString()
            }
        }
    })

    console.log("Results released!")
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
