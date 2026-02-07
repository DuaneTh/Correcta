-- Migration: sync production schema with local
-- Missing: 6 tables + 1 column (Class.parentId)

-- 1. Class.parentId (self-referential hierarchy)
ALTER TABLE "Class" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Class" ADD CONSTRAINT "Class_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. SystemSetting
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- 3. AIPromptConfig
CREATE TABLE "AIPromptConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "AIPromptConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AIPromptConfig_key_key" ON "AIPromptConfig"("key");

-- 4. AIGradingLog
CREATE TABLE "AIGradingLog" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT,
    "answerId" TEXT,
    "questionId" TEXT,
    "operation" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "userPrompt" TEXT NOT NULL,
    "rawResponse" TEXT,
    "score" DOUBLE PRECISION,
    "feedback" TEXT,
    "aiRationale" TEXT,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "durationMs" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "AIGradingLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AIGradingLog_attemptId_idx" ON "AIGradingLog"("attemptId");
CREATE INDEX "AIGradingLog_createdAt_idx" ON "AIGradingLog"("createdAt");

-- 5. AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "institutionId" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_institutionId_idx" ON "AuditLog"("institutionId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- 6. HarmonizationHistory
CREATE TABLE "HarmonizationHistory" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "attemptsAffected" INTEGER,
    "appliedBy" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HarmonizationHistory_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "HarmonizationHistory" ADD CONSTRAINT "HarmonizationHistory_appliedBy_fkey" FOREIGN KEY ("appliedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "HarmonizationHistory_examId_idx" ON "HarmonizationHistory"("examId");

-- 7. HarmonizationDetail
CREATE TABLE "HarmonizationDetail" (
    "id" TEXT NOT NULL,
    "harmonizationId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "originalScore" DOUBLE PRECISION NOT NULL,
    "newScore" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "HarmonizationDetail_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "HarmonizationDetail" ADD CONSTRAINT "HarmonizationDetail_harmonizationId_fkey" FOREIGN KEY ("harmonizationId") REFERENCES "HarmonizationHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HarmonizationDetail" ADD CONSTRAINT "HarmonizationDetail_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
