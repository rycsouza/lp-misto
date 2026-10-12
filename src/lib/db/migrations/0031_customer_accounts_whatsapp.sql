-- Login da área do cliente por WhatsApp + senha: o WhatsApp da conta passa a ser único.
-- Normaliza (só dígitos; DDI 55 → 11 dígitos) antes de criar o índice.
-- Idempotente. Rollback: 0031_customer_accounts_whatsapp.rollback.sql
UPDATE "customer_accounts" SET "whatsapp" = regexp_replace("whatsapp", '[^0-9]', '', 'g')
  WHERE "whatsapp" ~ '[^0-9]';
UPDATE "customer_accounts" SET "whatsapp" = substring("whatsapp" from 3)
  WHERE "whatsapp" ~ '^55[0-9]{11}$';
UPDATE "customer_accounts" SET "whatsapp" = NULL
  WHERE "whatsapp" IS NOT NULL AND "whatsapp" !~ '^[0-9]{11}$';
-- Mesmo WhatsApp em mais de uma conta: fica com a mais antiga; as outras seguem
-- entrando pelo e-mail.
UPDATE "customer_accounts" a SET "whatsapp" = NULL
  WHERE a."whatsapp" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "customer_accounts" b
    WHERE b."whatsapp" = a."whatsapp" AND (b."created_at", b."id") < (a."created_at", a."id")
  );

CREATE UNIQUE INDEX IF NOT EXISTS "customer_accounts_whatsapp_idx" ON "customer_accounts" ("whatsapp");
