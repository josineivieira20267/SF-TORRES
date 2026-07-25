ALTER TABLE "WorkOrder" ADD COLUMN "correctionRequested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorkOrder" ADD COLUMN "correctionApproved" BOOLEAN NOT NULL DEFAULT false;
