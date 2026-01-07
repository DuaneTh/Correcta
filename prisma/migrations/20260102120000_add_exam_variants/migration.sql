-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "classId" TEXT;
ALTER TABLE "Exam" ADD COLUMN     "parentExamId" TEXT;

-- CreateIndex
CREATE INDEX "Exam_classId_idx" ON "Exam"("classId");
CREATE INDEX "Exam_parentExamId_idx" ON "Exam"("parentExamId");

-- CreateIndex (unique)
CREATE UNIQUE INDEX "Exam_parentExamId_classId_key" ON "Exam"("parentExamId", "classId");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_parentExamId_fkey" FOREIGN KEY ("parentExamId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
