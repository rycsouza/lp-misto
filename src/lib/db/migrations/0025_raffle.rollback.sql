-- Rollback da migration 0025 (tenant DB). Remove a feature de rifa.
-- ATENÇÃO: apaga todos os sorteios, números e prêmios/ganhadores.
DROP TABLE IF EXISTS raffle_prizes;
DROP TABLE IF EXISTS raffle_numbers;
DROP TABLE IF EXISTS raffles;
