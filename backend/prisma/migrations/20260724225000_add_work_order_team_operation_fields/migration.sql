ALTER TABLE "WorkOrder" ADD COLUMN "product" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN "teamMembers" JSONB;
ALTER TABLE "WorkOrder" ADD COLUMN "attendance" JSONB;
ALTER TABLE "WorkOrder" ADD COLUMN "teamNote" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN "operationStart" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN "operationEnd" TEXT;
