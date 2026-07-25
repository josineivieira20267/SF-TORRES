-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "employee" TEXT NOT NULL,
    "role" TEXT,
    "weekStart" TEXT NOT NULL,
    "base" TEXT,
    "monday" TEXT,
    "tuesday" TEXT,
    "wednesday" TEXT,
    "thursday" TEXT,
    "friday" TEXT,
    "saturday" TEXT,
    "sunday" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Programada',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);
