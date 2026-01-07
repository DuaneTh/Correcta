-- Migration de réconciliation pour les changements de schéma appliqués via db push
-- Ces changements sont déjà présents dans la base de données

-- CreateEnum ExamStatus (si pas existe)
DO $$ BEGIN
    CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable Exam: make startAt and durationMinutes nullable
DO $$ BEGIN
    ALTER TABLE "Exam" ALTER COLUMN "startAt" DROP NOT NULL;
EXCEPTION
    WHEN others THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Exam" ALTER COLUMN "durationMinutes" DROP NOT NULL;
EXCEPTION
    WHEN others THEN null;
END $$;

-- Add status column to Exam
DO $$ BEGIN
    ALTER TABLE "Exam" ADD COLUMN "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add requireHonorCommitment column to Exam
DO $$ BEGIN
    ALTER TABLE "Exam" ADD COLUMN "requireHonorCommitment" BOOLEAN NOT NULL DEFAULT true;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add allowedMaterials column to Exam
DO $$ BEGIN
    ALTER TABLE "Exam" ADD COLUMN "allowedMaterials" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add foreign key for Exam.authorId (column already added in 20251123150306)
DO $$ BEGIN
    ALTER TABLE "Exam" ADD CONSTRAINT "Exam_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add customLabel column to ExamSection
DO $$ BEGIN
    ALTER TABLE "ExamSection" ADD COLUMN "customLabel" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add requireAllCorrect column to Question
DO $$ BEGIN
    ALTER TABLE "Question" ADD COLUMN "requireAllCorrect" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add maxPoints column to Question
DO $$ BEGIN
    ALTER TABLE "Question" ADD COLUMN "maxPoints" DOUBLE PRECISION;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add isCorrect column to QuestionSegment
DO $$ BEGIN
    ALTER TABLE "QuestionSegment" ADD COLUMN "isCorrect" BOOLEAN;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

