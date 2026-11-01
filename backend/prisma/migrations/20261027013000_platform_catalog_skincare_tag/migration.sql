-- Características de skincare (catálogo global; idempotente)
INSERT INTO "platform_catalog_items" ("id", "kind", "value", "label", "sortOrder", "active", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'skincare_tag', 'acido', 'Ácidos (baixa concentração)', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'skincare_tag', 'acido-alto', 'Ácidos em alta concentração', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'skincare_tag', 'retinoide', 'Retinoides', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'skincare_tag', 'fragrancia', 'Fragrância', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'skincare_tag', 'oleo', 'Óleos comedogênicos', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("kind", "value") DO NOTHING;
