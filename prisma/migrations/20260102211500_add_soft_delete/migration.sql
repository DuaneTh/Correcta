-- Add soft-delete fields
ALTER TABLE "User" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Course" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Class" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Exam" ADD COLUMN "archivedAt" TIMESTAMP(3);
