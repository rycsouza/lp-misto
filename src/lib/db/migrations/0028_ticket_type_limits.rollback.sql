ALTER TABLE ticket_types
  DROP COLUMN IF EXISTS max_quantity,
  DROP COLUMN IF EXISTS sold_count;
