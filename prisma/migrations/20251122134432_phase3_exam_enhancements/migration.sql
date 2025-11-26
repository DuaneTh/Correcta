/*
  Warnings:

  - You are about to drop the column `groupId` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the `QuestionGroup` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `sectionId` to the `Question` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProctorEventType" ADD VALUE 'INACTIVITY';
ALTER TYPE "ProctorEventType" ADD VALUE 'MULTI_SESSION';

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_groupId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionGroup" DROP CONSTRAINT "QuestionGroup_examId_fkey";

-- AlterTable
ALTER TABLE "AnswerSegment" ADD COLUMN     "autosavedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "classIds" TEXT[],
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Question" DROP COLUMN "groupId",
ADD COLUMN     "sectionId" TEXT NOT NULL;

-- DropTable
DROP TABLE "QuestionGroup";

-- CreateTable
CREATE TABLE "ExamSection" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExamSection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ExamSection" ADD CONSTRAINT "ExamSection_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ExamSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
