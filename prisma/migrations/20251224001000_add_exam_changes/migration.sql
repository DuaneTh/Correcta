-- CreateEnum
CREATE TYPE "ExamChangeEntity" AS ENUM ('EXAM', 'SECTION', 'QUESTION', 'SEGMENT');

-- CreateTable
CREATE TABLE "ExamChange" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "entityType" "ExamChangeEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT,
    "field" TEXT NOT NULL,
    "beforeValue" JSONB,
    "afterValue" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamChange_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ExamChange" ADD CONSTRAINT "ExamChange_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamChange" ADD CONSTRAINT "ExamChange_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
