-- Aposenta o Bar (substituído pela Cantina). Remove SÓ as tabelas do Bar.
-- ATENÇÃO: destrutivo — apaga catálogo/ofertas do Bar (irreversível quanto a dados).
-- NÃO remove orders.game_id / orders.service_fee_cents: a Cantina e o checkout
-- ainda usam essas colunas. Linhas históricas em order_items com type='bar'
-- permanecem (apenas registro; sem FK).

DROP TABLE IF EXISTS "bar_game_offerings";  -- child (FK p/ bar_menu_items) primeiro
DROP TABLE IF EXISTS "bar_menu_items";

-- Limpeza opcional das chaves de config do Bar no KV.
DELETE FROM "site_config" WHERE "key" LIKE 'bar.%';
