ALTER TABLE "Occurrence" ADD COLUMN "employeeName" TEXT;
ALTER TABLE "Occurrence" ADD COLUMN "attendanceDate" TEXT;
ALTER TABLE "Occurrence" ADD COLUMN "approvedByName" TEXT;
ALTER TABLE "Occurrence" ADD COLUMN "approvedAt" TIMESTAMP(3);

CREATE INDEX "Occurrence_employeeName_idx" ON "Occurrence"("employeeName");
CREATE INDEX "Occurrence_attendanceDate_idx" ON "Occurrence"("attendanceDate");
CREATE INDEX "Occurrence_status_idx" ON "Occurrence"("status");
