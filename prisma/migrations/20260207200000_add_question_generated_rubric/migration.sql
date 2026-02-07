-- Add missing generatedRubric column to Question table
ALTER TABLE "Question" ADD COLUMN "generatedRubric" JSONB;
