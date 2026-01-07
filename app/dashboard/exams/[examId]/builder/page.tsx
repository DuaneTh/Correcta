import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { buildAuthOptions } from "@/lib/auth"
import { getDictionary, getLocale } from "@/lib/i18n/server"
import ExamBuilder from "@/components/exams/ExamBuilder"
import { redirect } from "next/navigation"
import { Exam, Segment } from "@/types/exams"
import { parseContent } from "@/lib/content"
import { getDraftVariantsForBaseExam } from "@/lib/exam-variants"

const DEFAULT_SECTION_NAME = '__DEFAULT__'

export default async function ExamBuilderPage({ params }: { params: Promise<{ examId: string }> }) {
    const { examId } = await params
    const authOptions = await buildAuthOptions()
    const session = await getServerSession(authOptions)
    const dictionary = await getDictionary()

    console.log("[ExamBuilder] Session:", JSON.stringify(session, null, 2))

    // Check authentication
    if (!session?.user?.institutionId) {
        console.log("[ExamBuilder] Missing institutionId, redirecting to login")
        redirect('/login')
    }

    // Check role - only teachers and admins can build exams
    if (session.user.role === 'STUDENT') {
        redirect('/dashboard/exams')
    }

    // Fetch exam with full structure
    const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: {
            course: {
                select: {
                    id: true,
                    code: true,
                    name: true,
                    institutionId: true,
                    classes: {
                        select: {
                            id: true,
                            name: true,
                            enrollments: {
                                where: { role: 'TEACHER' },
                                include: {
                                    user: {
                                        select: { name: true }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            class: {
                select: {
                    id: true,
                    name: true,
                },
            },
            variants: {
                select: {
                    id: true,
                    classId: true,
                    startAt: true,
                    endAt: true,
                    durationMinutes: true,
                    status: true,
                    class: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
            author: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            },
            sections: {
                include: {
                    questions: {
                        include: {
                            segments: {
                                include: {
                                    rubric: true
                                }
                            }
                        },
                        orderBy: { order: 'asc' }
                    }
                },
                orderBy: { order: 'asc' }
            },
            changes: {
                orderBy: { createdAt: 'desc' }
            }
        }
    })

    if (!exam) {
        redirect('/dashboard/exams')
    }

    // Exams are locked when published and already started
    const isLocked = exam.status === 'PUBLISHED' && !!(exam.startAt && new Date() >= exam.startAt)

    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SCHOOL_ADMIN' || session.user.role === 'PLATFORM_ADMIN'
    const teacherEnrollments = await prisma.enrollment.findMany({
        where: {
            userId: session.user.id,
            role: 'TEACHER',
            class: { courseId: exam.courseId },
        },
        select: {
            classId: true,
            class: { select: { name: true } },
        },
    })
    const hasDefaultEnrollment = teacherEnrollments.some(
        (enrollment) => enrollment.class?.name === DEFAULT_SECTION_NAME
    )
    const teacherClassIds = hasDefaultEnrollment
        ? exam.course.classes.map((cls) => cls.id)
        : teacherEnrollments.map((enrollment) => enrollment.classId)
    const canEdit = isAdmin
        ? true
        : exam.classId
            ? teacherClassIds.includes(exam.classId)
            : exam.authorId === session.user.id

    const courseSections = exam.course.classes.map((cls) => ({
        id: cls.id,
        name: cls.name,
        canEdit: isAdmin || teacherClassIds.includes(cls.id),
    }))

    let baseExamId = exam.parentExamId ?? exam.id
    let baseExamTitle = exam.title
    let variantList = exam.variants
    if (exam.parentExamId) {
        const baseExam = await prisma.exam.findUnique({
            where: { id: exam.parentExamId },
            select: { id: true, title: true, variants: {
                select: {
                    id: true,
                    classId: true,
                    startAt: true,
                    endAt: true,
                    durationMinutes: true,
                    status: true,
                    class: { select: { id: true, name: true } },
                }
            } },
        })
        if (baseExam) {
            baseExamId = baseExam.id
            baseExamTitle = baseExam.title
            variantList = baseExam.variants
        }
    }


    const courseTeacherName =
        exam.course.classes
            ?.flatMap(c => c.enrollments ?? [])
            .map(e => e.user?.name)
            .find(Boolean)
        ?? exam.author?.name
        ?? session.user.name
        ?? session.user.email
        ?? null

    const draftVariants =
        exam.parentExamId == null && exam.classId == null
            ? await getDraftVariantsForBaseExam(exam.id)
            : []

    const serializedExam: Exam = {
        ...exam,
        startAt: exam.startAt?.toISOString() ?? null,
        endAt: exam.endAt?.toISOString() ?? null,
        gradingConfig: exam.gradingConfig as any,
        course: {
            code: exam.course.code,
            name: exam.course.name,
            teacherName: courseTeacherName,
        },
        courseId: exam.course.id,
        classId: exam.classId ?? null,
        className: exam.class?.name ?? null,
        parentExamId: exam.parentExamId ?? null,
        classIds: exam.classIds ?? [],
        courseSections,
        canEdit,
        variants: variantList.map((variant) => ({
            id: variant.id,
            classId: variant.classId || '',
            className: variant.class?.name ?? null,
            startAt: variant.startAt ? variant.startAt.toISOString() : null,
            endAt: variant.endAt ? variant.endAt.toISOString() : null,
            durationMinutes: variant.durationMinutes ?? null,
            status: variant.status,
        })),
        changes: exam.changes.map((change) => ({
            ...change,
            createdAt: change.createdAt.toISOString(),
        })),
        draftVariantsCount: draftVariants.length,
        draftVariantsBySection: draftVariants.map((variant) => ({
            ...variant,
            updatedAt: variant.updatedAt.toISOString(),
        })),
        sections: exam.sections.map(section => ({
            ...section,
            questions: section.questions.map(question => ({
                ...question,
                studentTools: question.studentTools as any,
                content: parseContent(question.content),
                answerTemplate: parseContent(question.answerTemplate),
                answerTemplateLocked: Boolean(question.answerTemplateLocked),
                segments: question.segments.map(segment => ({
                    ...segment,
                    isCorrect: segment.isCorrect ?? undefined,
                    rubric: segment.rubric
                        ? {
                            ...segment.rubric,
                            criteria: segment.rubric.criteria || '',
                            levels: (segment.rubric.levels as any) ?? [],
                            examples: (segment.rubric.examples as any) ?? []
                        }
                        : undefined
                }))
            }))
        }))
    }

    const locale = await getLocale()

    return (
        <ExamBuilder
            examId={examId}
            initialData={{ ...serializedExam, baseExamId, baseExamTitle }}
            isLocked={isLocked}
            dictionary={dictionary}
            locale={locale}
        />
    )
}
