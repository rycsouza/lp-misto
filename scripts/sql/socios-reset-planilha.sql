-- =============================================================================
-- Sócio-torcedor: ZERA os dados de sócio e carrega os planos da planilha.
--
-- O QUE APAGA (nesta ordem):
--   member_ticket_redemptions, members, plan_benefits, membership_benefits,
--   membership_plans.
-- NÃO mexe em leads, orders, produtos, jogos, notícias nem em nada fora do sócio.
--
-- O QUE CRIA:
--   5 planos (Raiz, Torcedor, Carcará, Elite, Empresarial) com preço, descontos,
--   ingressos grátis por jogo em casa, destaque (só o Carcará), cor do cartão e
--   público (CPF, exceto o Empresarial, que é CNPJ);
--   8 benefícios textuais e seus vínculos com cada plano.
--   Descontos em produtos e ingressos grátis NÃO viram linha de benefício: são
--   derivados dos campos do plano (src/lib/membership/plan-benefits.ts).
--
-- ATENÇÃO — IRREVERSÍVEL:
--   Todo sócio cadastrado é APAGADO (inclusive o histórico de resgates de ingresso).
--   Não há desfazer. Faça backup do banco antes, se quiser guardar os dados de teste.
--
-- PRÉ-REQUISITOS:
--   1. Rodar DEPOIS das migrações 0030, 0031, 0032, 0033, 0034 e 0035 (0032 cria as colunas novas
--      de membership_plans, plan_benefits, members e a tabela member_ticket_redemptions;
--      0035 cria membership_plans.audience e members.cnpj/company_name).
--   2. AVISO: ANTES de rodar, CANCELAR NO PAINEL DO ASAAS as assinaturas de teste.
--      Este script NÃO fala com o gateway: apagar o sócio aqui não para a cobrança
--      recorrente que continua ativa no Asaas.
--
-- COMO RODAR (banco do clube):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/socios-reset-planilha.sql
--
-- É transacional (BEGIN/COMMIT): se qualquer passo falhar, nada é aplicado.
-- Pode ser executado mais de uma vez com o mesmo resultado final.
-- =============================================================================

BEGIN;

-- ─── 1. Limpeza (ordem segura: filhos antes dos pais) ────────────────────────

DELETE FROM "member_ticket_redemptions";
DELETE FROM "members";
DELETE FROM "plan_benefits";
DELETE FROM "membership_benefits";
DELETE FROM "membership_plans";

-- ─── 2. Planos da planilha ───────────────────────────────────────────────────
-- Colunas: slug, name, icon, description, price_cents, product_discount_pct,
-- ticket_discount_pct, free_tickets_per_home_game, first_month_free, highlight,
-- highlight_label, card_color, active, order, audience.

INSERT INTO "membership_plans" (
  "slug", "name", "icon", "description", "price_cents",
  "product_discount_pct", "ticket_discount_pct", "free_tickets_per_home_game",
  "first_month_free", "highlight", "highlight_label", "card_color", "active", "order", "audience"
) VALUES
  ('raiz', 'Raiz', 'Star',
   'Para quem é Misto de raiz: carteirinha e seu nome no mural do clube.',
   990, 5, 0, 0, false, false, NULL, '#3f6212', true, 1, 'pf'),
  ('torcedor', 'Torcedor', 'Star',
   'Para quem acompanha o Misto de perto: tudo do Raiz e mais desconto na loja oficial.',
   1990, 7, 0, 0, false, false, NULL, '#1d4ed8', true, 2, 'pf'),
  ('carcara', 'Carcará', 'Star',
   'Entre no time de verdade: ingresso em treinos abertos, visitas e feijoadas, com 10% off na loja.',
   4990, 10, 0, 0, false, true, 'MAIS POPULAR', '#b45309', true, 3, 'pf'),
  ('elite', 'Elite', 'Star',
   'Viva o clube por dentro: área exclusiva no estádio, meet & greet com jogadores e ingresso grátis em jogos em casa.',
   7990, 12, 0, 1, false, false, NULL, '#111827', true, 4, 'pf'),
  ('empresarial', 'Empresarial', 'Star',
   'Para empresas que querem o Misto como vitrine: divulgação nas redes, networking e sua marca no painel de LED.',
   24900, 15, 0, 2, false, false, NULL, '#7a5c12', true, 5, 'pj');

-- ─── 3. Benefícios textuais (não automáticos) ────────────────────────────────

INSERT INTO "membership_benefits" ("label", "order") VALUES
  ('Carteirinha digital', 1),
  ('Nome no mural digital do clube', 2),
  ('Ingresso em experiências (treino aberto, visitas, feijoadas)', 3),
  ('Acesso a área exclusiva no estádio (se possível — ver termo de adesão)', 4),
  ('Meet & greet com jogadores', 5),
  ('Divulgação da empresa nas redes sociais do clube', 6),
  ('Networking com diretoria e patrocinadores', 7),
  ('Nome da empresa no painel de LED', 8);

-- ─── 4. Vínculos plano × benefício (por slug e label, sem UUID fixo) ─────────

INSERT INTO "plan_benefits" ("plan_id", "benefit_id", "included", "detail") VALUES
  -- 1 Carteirinha digital: todos
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'raiz'),        (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Carteirinha digital'), true, NULL),
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'torcedor'),    (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Carteirinha digital'), true, NULL),
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'carcara'),     (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Carteirinha digital'), true, NULL),
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'elite'),       (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Carteirinha digital'), true, NULL),
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'empresarial'), (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Carteirinha digital'), true, NULL),
  -- 2 Nome no mural digital: todos
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'raiz'),        (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Nome no mural digital do clube'), true, NULL),
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'torcedor'),    (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Nome no mural digital do clube'), true, NULL),
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'carcara'),     (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Nome no mural digital do clube'), true, NULL),
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'elite'),       (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Nome no mural digital do clube'), true, NULL),
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'empresarial'), (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Nome no mural digital do clube'), true, NULL),
  -- 3 Ingresso em experiências: Carcará, Elite, Empresarial
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'carcara'),     (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Ingresso em experiências (treino aberto, visitas, feijoadas)'), true, NULL),
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'elite'),       (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Ingresso em experiências (treino aberto, visitas, feijoadas)'), true, NULL),
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'empresarial'), (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Ingresso em experiências (treino aberto, visitas, feijoadas)'), true, NULL),
  -- 4 Área exclusiva no estádio: Elite, Empresarial
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'elite'),       (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Acesso a área exclusiva no estádio (se possível — ver termo de adesão)'), true, NULL),
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'empresarial'), (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Acesso a área exclusiva no estádio (se possível — ver termo de adesão)'), true, NULL),
  -- 5 Meet & greet: Elite, Empresarial
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'elite'),       (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Meet & greet com jogadores'), true, NULL),
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'empresarial'), (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Meet & greet com jogadores'), true, NULL),
  -- 6 Divulgação nas redes: Empresarial
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'empresarial'), (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Divulgação da empresa nas redes sociais do clube'), true, NULL),
  -- 7 Networking: Empresarial
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'empresarial'), (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Networking com diretoria e patrocinadores'), true, NULL),
  -- 8 Nome no painel de LED: Empresarial, com detalhe
  ((SELECT "id" FROM "membership_plans" WHERE "slug" = 'empresarial'), (SELECT "id" FROM "membership_benefits" WHERE "label" = 'Nome da empresa no painel de LED'), true, '3 segundos');

COMMIT;

-- ─── Conferência (somente leitura) ───────────────────────────────────────────

SELECT
  (SELECT count(*) FROM "membership_plans")                 AS planos,
  (SELECT count(*) FROM "membership_plans" WHERE "highlight") AS destaques,
  (SELECT count(*) FROM "membership_benefits")              AS beneficios,
  (SELECT count(*) FROM "plan_benefits")                    AS vinculos,
  (SELECT count(*) FROM "members")                          AS socios,
  (SELECT count(*) FROM "member_ticket_redemptions")        AS resgates;

SELECT
  p."order",
  p."slug",
  p."name",
  p."price_cents",
  p."product_discount_pct"        AS desc_produtos,
  p."ticket_discount_pct"         AS desc_ingressos,
  p."free_tickets_per_home_game"  AS ingressos_gratis_casa,
  p."highlight",
  p."highlight_label",
  p."card_color",
  p."active",
  (SELECT string_agg(b."order" || ' ' || b."label" || COALESCE(' [' || pb."detail" || ']', ''), ' | ' ORDER BY b."order")
     FROM "plan_benefits" pb
     JOIN "membership_benefits" b ON b."id" = pb."benefit_id"
    WHERE pb."plan_id" = p."id" AND pb."included") AS beneficios
FROM "membership_plans" p
ORDER BY p."order";
