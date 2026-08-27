CREATE TABLE "TalentCandidate" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "cpf" TEXT NOT NULL,
  "rg" TEXT,
  "birthDate" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "zipCode" TEXT,
  "street" TEXT,
  "number" TEXT,
  "complement" TEXT,
  "district" TEXT,
  "city" TEXT,
  "state" TEXT,
  "education" TEXT,
  "courses" JSONB,
  "experiences" JSONB,
  "lastRole" TEXT,
  "desiredRole" TEXT,
  "startAvailability" TEXT,
  "scheduleAvailability" JSONB,
  "salaryExpectation" DOUBLE PRECISION,
  "hasCnh" BOOLEAN NOT NULL DEFAULT false,
  "cnhCategory" TEXT,
  "cnhNumber" TEXT,
  "cnhExpiration" TEXT,
  "resume" JSONB,
  "internalNotes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Novo cadastro',
  "relatedCompany" TEXT NOT NULL DEFAULT 'Banco Geral',
  "consentStorage" BOOLEAN NOT NULL DEFAULT false,
  "consentDate" TEXT,
  "consentOrigin" TEXT,
  "source" TEXT,
  "registeredBy" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TalentCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TalentCandidateHistory" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "note" TEXT,
  "userId" TEXT,
  "userName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TalentCandidateHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TalentCandidate_cpf_key" ON "TalentCandidate"("cpf");
CREATE INDEX "TalentCandidate_fullName_idx" ON "TalentCandidate"("fullName");
CREATE INDEX "TalentCandidate_status_idx" ON "TalentCandidate"("status");
CREATE INDEX "TalentCandidate_desiredRole_idx" ON "TalentCandidate"("desiredRole");
CREATE INDEX "TalentCandidate_relatedCompany_idx" ON "TalentCandidate"("relatedCompany");
CREATE INDEX "TalentCandidate_city_idx" ON "TalentCandidate"("city");
CREATE INDEX "TalentCandidate_createdAt_idx" ON "TalentCandidate"("createdAt");
CREATE INDEX "TalentCandidateHistory_candidateId_idx" ON "TalentCandidateHistory"("candidateId");
CREATE INDEX "TalentCandidateHistory_createdAt_idx" ON "TalentCandidateHistory"("createdAt");

ALTER TABLE "TalentCandidateHistory"
  ADD CONSTRAINT "TalentCandidateHistory_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "TalentCandidate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
