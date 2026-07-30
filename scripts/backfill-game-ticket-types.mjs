// Backfill: copia os tipos-padrão do clube (ticket_types com game_id NULL) para
// cada jogo que ainda NÃO tem tipos próprios. Idempotente — pula jogos que já
// têm tipos. Depois reconcilia o sold_count a partir dos pedidos reais (pago +
// PIX pendente na janela de 30min), para o limite valer mesmo com vendas antigas.
//
// Rode DEPOIS de aplicar a migration 0028_ticket_type_limits.sql no DB do tenant.
//
// Uso (lê DATABASE_URL do .env.local):
//   node scripts/backfill-game-ticket-types.mjs            # dry-run (não escreve)
//   node scripts/backfill-game-ticket-types.mjs --commit   # aplica

import { neon } from "@neondatabase/serverless";
import fs from "node:fs";

function env(key) {
  try {
    const m = fs.readFileSync(".env.local", "utf8").match(new RegExp("^" + key + "=(.*)$", "m"));
    return m ? m[1].replace(/^["']|["']$/g, "").trim() : "";
  } catch {
    return "";
  }
}

const url = env("DATABASE_URL") || process.env.DATABASE_URL || "";
const COMMIT = process.argv.includes("--commit");

if (!url) {
  console.error("Falta DATABASE_URL (no .env.local ou no ambiente).");
  process.exit(1);
}

const sql = neon(url);

const globals = await sql`SELECT count(*)::int AS n FROM ticket_types WHERE game_id IS NULL`;
if (!globals[0]?.n) {
  console.error("Nenhum tipo GLOBAL cadastrado — nada para copiar. Configure os tipos-padrão do clube primeiro.");
  process.exit(1);
}
console.log(`Tipos-padrão (globais): ${globals[0].n}`);

// Jogos SEM tipos próprios.
const games = await sql`
  SELECT g.id, g.opponent
  FROM games g
  WHERE NOT EXISTS (SELECT 1 FROM ticket_types t WHERE t.game_id = g.id)
  ORDER BY g.date DESC
`;

console.log(`Jogos sem tipos próprios: ${games.length}`);
if (games.length === 0) {
  console.log("Nada a fazer.");
  process.exit(0);
}

if (!COMMIT) {
  for (const g of games) console.log(`  [dry-run] copiaria os padrões para: vs ${g.opponent} (${g.id})`);
  console.log("\nRode de novo com --commit para aplicar.");
  process.exit(0);
}

let done = 0;
for (const g of games) {
  await sql`
    INSERT INTO ticket_types
      (game_id, code, name, description, price_cents, combo_tiers, max_quantity, sold_count, sort_order, active)
    SELECT ${g.id}, code, name, description, price_cents, combo_tiers, max_quantity, 0, sort_order, active
    FROM ticket_types WHERE game_id IS NULL
  `;
  await sql`
    UPDATE ticket_types tt SET sold_count = COALESCE((
      SELECT SUM(oi.quantity) FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.type = 'ticket'
        AND oi.reference_id = tt.game_id
        AND oi.metadata->>'ticketType' = tt.code
        AND (oi.metadata->>'isUpsell') IS DISTINCT FROM 'true'
        AND (o.status = 'paid' OR (o.status = 'pending' AND o.created_at > now() - interval '30 minutes'))
    ), 0)
    WHERE tt.game_id = ${g.id}
  `;
  done++;
  console.log(`  ✅ vs ${g.opponent}`);
}
console.log(`\nConcluído: ${done} jogo(s) preenchido(s) com os tipos-padrão.`);
