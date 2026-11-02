-- Agendamentos gravados só com o procedureId legado depois de 20261101120000 (ex.: seeds)
INSERT INTO "appointment_procedures" ("id", "tenantId", "appointmentId", "procedureId", "sortOrder")
SELECT gen_random_uuid()::text, a."tenantId", a."id", a."procedureId", 0
FROM "appointments" a
WHERE a."procedureId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "appointment_procedures" ap WHERE ap."appointmentId" = a."id"
  );
