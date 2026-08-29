CREATE TABLE "EmployeeAttendance" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT,
  "employeeName" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT,
  "markedById" TEXT,
  "markedByName" TEXT,
  "markedByRole" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmployeeAttendance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceCorrection" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT,
  "employeeName" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Pendente',
  "currentStatus" TEXT,
  "requestedById" TEXT,
  "requestedByName" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedById" TEXT,
  "approvedByName" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AttendanceCorrection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeAttendance_date_employeeName_key" ON "EmployeeAttendance"("date", "employeeName");
CREATE INDEX "EmployeeAttendance_date_idx" ON "EmployeeAttendance"("date");
CREATE INDEX "EmployeeAttendance_employeeId_idx" ON "EmployeeAttendance"("employeeId");
CREATE INDEX "EmployeeAttendance_employeeName_idx" ON "EmployeeAttendance"("employeeName");
CREATE INDEX "EmployeeAttendance_status_idx" ON "EmployeeAttendance"("status");

CREATE UNIQUE INDEX "AttendanceCorrection_date_employeeName_key" ON "AttendanceCorrection"("date", "employeeName");
CREATE INDEX "AttendanceCorrection_date_idx" ON "AttendanceCorrection"("date");
CREATE INDEX "AttendanceCorrection_employeeId_idx" ON "AttendanceCorrection"("employeeId");
CREATE INDEX "AttendanceCorrection_employeeName_idx" ON "AttendanceCorrection"("employeeName");
CREATE INDEX "AttendanceCorrection_status_idx" ON "AttendanceCorrection"("status");

ALTER TABLE "EmployeeAttendance" ADD CONSTRAINT "EmployeeAttendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "EmployeeAttendance" (
  "id",
  "employeeId",
  "employeeName",
  "date",
  "status",
  "note",
  "markedById",
  "markedByName",
  "markedByRole",
  "createdAt",
  "updatedAt"
)
SELECT DISTINCT ON (attendance_date, entry.key)
  'att_' || md5(s."key" || ':' || entry.key),
  e."id",
  entry.key,
  attendance_date,
  CASE
    WHEN jsonb_typeof(entry.value) = 'object' THEN COALESCE(entry.value->>'status', '')
    ELSE entry.value #>> '{}'
  END,
  CASE WHEN jsonb_typeof(entry.value) = 'object' THEN entry.value->>'note' ELSE NULL END,
  s."value"->'updatedBy'->>'id',
  s."value"->'updatedBy'->>'name',
  s."value"->'updatedBy'->>'role',
  COALESCE(s."createdAt", CURRENT_TIMESTAMP),
  COALESCE(s."updatedAt", CURRENT_TIMESTAMP)
FROM (
  SELECT
    "Setting".*,
    substring("Setting"."key" from 18 for 10) AS attendance_date
  FROM "Setting"
  WHERE "Setting"."key" LIKE 'leaderAttendance:____-__-__%'
) s
CROSS JOIN LATERAL jsonb_each(COALESCE(s."value"->'attendance', '{}'::jsonb)) AS entry
LEFT JOIN LATERAL (
  SELECT "id"
  FROM "Employee"
  WHERE lower("Employee"."name") = lower(entry.key)
  LIMIT 1
) e ON TRUE
WHERE attendance_date ~ '^\d{4}-\d{2}-\d{2}$'
  AND COALESCE(
    CASE
      WHEN jsonb_typeof(entry.value) = 'object' THEN entry.value->>'status'
      ELSE entry.value #>> '{}'
    END,
    ''
  ) <> ''
ON CONFLICT ("date", "employeeName") DO UPDATE SET
  "status" = EXCLUDED."status",
  "note" = EXCLUDED."note",
  "markedById" = EXCLUDED."markedById",
  "markedByName" = EXCLUDED."markedByName",
  "markedByRole" = EXCLUDED."markedByRole",
  "updatedAt" = EXCLUDED."updatedAt";

INSERT INTO "AttendanceCorrection" (
  "id",
  "employeeId",
  "employeeName",
  "date",
  "status",
  "currentStatus",
  "requestedById",
  "requestedByName",
  "requestedAt",
  "approvedById",
  "approvedByName",
  "approvedAt",
  "createdAt",
  "updatedAt"
)
SELECT DISTINCT ON (attendance_date, entry.key)
  'cor_' || md5(s."key" || ':' || entry.key),
  e."id",
  entry.key,
  attendance_date,
  COALESCE(entry.value->>'status', 'Pendente'),
  entry.value->>'currentStatus',
  entry.value->'requestedBy'->>'id',
  entry.value->'requestedBy'->>'name',
  COALESCE(NULLIF(entry.value->>'requestedAt', '')::timestamp, CURRENT_TIMESTAMP),
  entry.value->'approvedBy'->>'id',
  entry.value->'approvedBy'->>'name',
  NULLIF(entry.value->>'approvedAt', '')::timestamp,
  COALESCE(s."createdAt", CURRENT_TIMESTAMP),
  COALESCE(s."updatedAt", CURRENT_TIMESTAMP)
FROM (
  SELECT
    "Setting".*,
    substring("Setting"."key" from 18 for 10) AS attendance_date
  FROM "Setting"
  WHERE "Setting"."key" LIKE 'leaderAttendance:____-__-__%'
) s
CROSS JOIN LATERAL jsonb_each(COALESCE(s."value"->'correctionRequests', '{}'::jsonb)) AS entry
LEFT JOIN LATERAL (
  SELECT "id"
  FROM "Employee"
  WHERE lower("Employee"."name") = lower(entry.key)
  LIMIT 1
) e ON TRUE
WHERE attendance_date ~ '^\d{4}-\d{2}-\d{2}$'
ON CONFLICT ("date", "employeeName") DO UPDATE SET
  "status" = EXCLUDED."status",
  "currentStatus" = EXCLUDED."currentStatus",
  "requestedById" = EXCLUDED."requestedById",
  "requestedByName" = EXCLUDED."requestedByName",
  "requestedAt" = EXCLUDED."requestedAt",
  "approvedById" = EXCLUDED."approvedById",
  "approvedByName" = EXCLUDED."approvedByName",
  "approvedAt" = EXCLUDED."approvedAt",
  "updatedAt" = EXCLUDED."updatedAt";
