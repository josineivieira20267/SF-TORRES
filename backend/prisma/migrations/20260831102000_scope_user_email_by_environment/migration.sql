DROP INDEX IF EXISTS "User_email_key";

CREATE UNIQUE INDEX "User_email_environment_key" ON "User"("email", "environment");
