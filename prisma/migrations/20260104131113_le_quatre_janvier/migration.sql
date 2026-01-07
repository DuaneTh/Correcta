-- DropIndex
DROP INDEX "InstitutionDomain_institutionId_idx";

-- AlterTable
ALTER TABLE "Exam" ALTER COLUMN "requireHonorCommitment" SET DEFAULT false;
