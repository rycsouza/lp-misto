-- Platform DB migration 0002 — escopo público do kill-switch.
-- Roda no PLATFORM_DATABASE_URL. Idempotente.
-- public_too=false (default): desligar a feature só afeta o PAINEL admin.
-- public_too=true: desligar também esconde no SITE PÚBLICO (nav/telas do torcedor).

ALTER TABLE platform_feature_flags
  ADD COLUMN IF NOT EXISTS public_too boolean NOT NULL DEFAULT false;
