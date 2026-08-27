CREATE TABLE "TalentJob" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "department" TEXT,
  "location" TEXT,
  "companyUnit" TEXT NOT NULL DEFAULT 'SF TORRES',
  "contractType" TEXT,
  "workMode" TEXT,
  "summary" TEXT,
  "responsibilities" JSONB,
  "requirements" JSONB,
  "benefits" JSONB,
  "salaryRange" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Rascunho',
  "publishedAt" TIMESTAMP(3),
  "expiresAt" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TalentJob_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TalentCandidate" ALTER COLUMN "cpf" DROP NOT NULL;

CREATE TABLE "TalentApplication" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "cpf" TEXT,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "city" TEXT,
  "state" TEXT,
  "education" TEXT,
  "experienceYears" TEXT,
  "lastRole" TEXT,
  "desiredSalary" DOUBLE PRECISION,
  "availableStartDate" TEXT,
  "linkedinUrl" TEXT,
  "portfolioUrl" TEXT,
  "resume" JSONB,
  "coverLetter" TEXT,
  "source" TEXT,
  "consentStorage" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'Nova',
  "internalNotes" TEXT,
  "convertedCandidateId" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TalentApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TalentJob_status_idx" ON "TalentJob"("status");
CREATE INDEX "TalentJob_title_idx" ON "TalentJob"("title");
CREATE INDEX "TalentJob_publishedAt_idx" ON "TalentJob"("publishedAt");
CREATE INDEX "TalentApplication_jobId_idx" ON "TalentApplication"("jobId");
CREATE INDEX "TalentApplication_status_idx" ON "TalentApplication"("status");
CREATE INDEX "TalentApplication_email_idx" ON "TalentApplication"("email");
CREATE INDEX "TalentApplication_createdAt_idx" ON "TalentApplication"("createdAt");

ALTER TABLE "TalentApplication"
  ADD CONSTRAINT "TalentApplication_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "TalentJob"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
