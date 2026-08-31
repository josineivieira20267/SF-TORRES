ALTER TABLE "User" ADD COLUMN "environment" TEXT NOT NULL DEFAULT 'operational';

CREATE INDEX "User_environment_idx" ON "User"("environment");
