-- Rollback da migration 0001 (platform DB). Remove admins do sistema + flags.
-- ATENÇÃO: apaga TODOS os admins de plataforma e o estado de kill-switch.
DROP TABLE IF EXISTS platform_feature_overrides;
DROP TABLE IF EXISTS platform_feature_flags;
DROP TABLE IF EXISTS platform_admins;
