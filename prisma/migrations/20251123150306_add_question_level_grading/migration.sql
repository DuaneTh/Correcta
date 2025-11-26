/*
  Warnings:

  - A unique constraint covering the columns `[answerId]` on the table `Grade` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Grade" DROP CONSTRAINT "Grade_answerSegmentId_fkey";

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "authorId" TEXT;

-- AlterTable
ALTER TABLE "Grade" ADD COLUMN     "answerId" TEXT,
ALTER COLUMN "answerSegmentId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Grade_answerId_key" ON "Grade"("answerId");

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_answerSegmentId_fkey" FOREIGN KEY ("answerSegmentId") REFERENCES "AnswerSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
