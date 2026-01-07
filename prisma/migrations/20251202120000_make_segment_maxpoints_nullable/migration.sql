-- Alter QuestionSegment.maxPoints to allow NULL values for MCQ options.
ALTER TABLE "QuestionSegment" ALTER COLUMN "maxPoints" DROP NOT NULL;
