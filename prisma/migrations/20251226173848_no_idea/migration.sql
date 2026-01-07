-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "shuffleOptions" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "QuestionSegment" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;
