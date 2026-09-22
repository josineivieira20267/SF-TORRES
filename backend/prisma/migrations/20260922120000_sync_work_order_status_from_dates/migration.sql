-- Reconcile existing orders once, using the same priority as the OS editor.
-- Orders without operation dates retain their current status.
UPDATE "WorkOrder"
SET "status" = CASE
      WHEN COALESCE("operationEnd", '') ~ '[^[:space:]]' THEN 'Finalizado'
      ELSE 'Em execucao'
    END,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE (
    COALESCE("operationEnd", '') ~ '[^[:space:]]'
    OR COALESCE("operationStart", '') ~ '[^[:space:]]'
  )
  AND "status" IS DISTINCT FROM CASE
    WHEN COALESCE("operationEnd", '') ~ '[^[:space:]]' THEN 'Finalizado'
    ELSE 'Em execucao'
  END;
