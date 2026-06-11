import nodemailer from "nodemailer";
import { db } from "@/lib/db/client";
import { orders, orderItems, games } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

function getTransport() {
  const host = process.env.MAILTRAP_HOST;
  const user = process.env.MAILTRAP_USER;
  const pass = process.env.MAILTRAP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.MAILTRAP_PORT ?? 587),
    auth: { user, pass },
  });
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email] MAILTRAP_* env vars não configuradas — e-mail de confirmação ignorado");
    return;
  }

  // Fetch order + items + game names
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return;

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  const gameIds = [...new Set(items.map((i) => i.referenceId).filter(Boolean))] as string[];
  const gameRows =
    gameIds.length > 0
      ? await db.select().from(games).where(inArray(games.id, gameIds))
      : [];

  const gameMap = Object.fromEntries(gameRows.map((g) => [g.id, g]));

  const itemsHtml = items
    .map((item) => {
      const game = item.referenceId ? gameMap[item.referenceId] : null;
      const gameLabel = game
        ? `Misto EC vs ${game.opponent} — ${formatDate(game.date)}`
        : "Ingresso";
      const typeLabel = (item.metadata as { ticketType?: string } | null)?.ticketType === "meia"
        ? "Meia-entrada"
        : "Inteira";
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #333;">${gameLabel}</td>
          <td style="padding:8px 0;border-bottom:1px solid #333;text-align:center;">${typeLabel}</td>
          <td style="padding:8px 0;border-bottom:1px solid #333;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #333;text-align:right;">${formatPrice(item.quantity * item.unitPriceCents)}</td>
        </tr>`;
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;color:#e5e5e5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a;">

        <!-- Header -->
        <tr><td style="background:#c19a5a;padding:24px;text-align:center;">
          <h1 style="margin:0;font-size:28px;color:#0a0a0a;letter-spacing:2px;font-weight:900;">MISTO EC</h1>
          <p style="margin:4px 0 0;font-size:12px;color:#0a0a0a;letter-spacing:3px;text-transform:uppercase;">Bilheteria Digital</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 24px;">
          <h2 style="margin:0 0 8px;font-size:22px;color:#c19a5a;">✓ Pagamento Confirmado!</h2>
          <p style="margin:0 0 24px;color:#999;font-size:14px;">Olá, <strong style="color:#e5e5e5;">${order.customerName}</strong>! Seu ingresso foi confirmado.</p>

          <!-- Items table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;margin-bottom:24px;">
            <thead>
              <tr style="color:#999;font-size:11px;text-transform:uppercase;letter-spacing:1px;">
                <th style="padding:6px 0;text-align:left;">Jogo</th>
                <th style="padding:6px 0;text-align:center;">Tipo</th>
                <th style="padding:6px 0;text-align:center;">Qtd</th>
                <th style="padding:6px 0;text-align:right;">Valor</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>

          <!-- Total -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td style="font-size:14px;color:#999;">Total pago</td>
              <td style="font-size:20px;font-weight:bold;color:#c19a5a;text-align:right;">${formatPrice(order.totalCents)}</td>
            </tr>
          </table>

          <!-- Order ID -->
          <p style="margin:0 0 24px;font-size:12px;color:#666;">
            Pedido: <span style="font-family:monospace;color:#999;">${order.id.slice(0, 8).toUpperCase()}</span>
          </p>

          <p style="margin:0;font-size:13px;color:#999;line-height:1.6;">
            Apresente este e-mail ou o número do pedido na entrada do estádio.<br>
            Dúvidas? Fale conosco pelo <a href="https://wa.me/5567991360075" style="color:#c19a5a;">WhatsApp</a>.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 24px;border-top:1px solid #2a2a2a;text-align:center;">
          <p style="margin:0;font-size:11px;color:#555;">© 2026 Misto Esporte Clube · Três Lagoas/MS</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const from = process.env.MAILTRAP_FROM ?? "ingressos@mistoec.com.br";

  await transport.sendMail({
    from: `"Misto EC" <${from}>`,
    to: order.customerEmail,
    subject: `✓ Ingresso confirmado — Pedido #${order.id.slice(0, 8).toUpperCase()}`,
    html,
  });
}
