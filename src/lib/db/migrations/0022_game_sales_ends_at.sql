-- Encerramento da venda de ingressos por jogo (funcional), desacoplado do
-- horário do jogo (que passa a ser só exibição). null = padrão fim do dia do jogo.
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "ticket_sales_ends_at" timestamptz;
