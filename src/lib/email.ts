import nodemailer from "nodemailer";
import { db } from "@/lib/db/client";
import { orders, orderItems, games, members, membershipPlans } from "@/lib/db/schema";
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
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

type ItemMeta = { ticketType?: string; name?: string; size?: string; variantId?: string } | null;

export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email] MAILTRAP_* env vars não configuradas — e-mail de confirmação ignorado");
    return;
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return;

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  // Determina o tipo predominante do pedido para customizar o e-mail
  const hasProducts = items.some((i) => i.type === "product");
  const hasTickets = items.some((i) => i.type === "ticket");
  const orderType: "product" | "ticket" | "mixed" = hasProducts && hasTickets
    ? "mixed"
    : hasProducts
    ? "product"
    : "ticket";

  // Busca jogos apenas se houver ingressos
  const ticketItems = items.filter((i) => i.type === "ticket");
  const gameIds = [...new Set(ticketItems.map((i) => i.referenceId).filter(Boolean))] as string[];
  const gameRows = gameIds.length > 0
    ? await db.select().from(games).where(inArray(games.id, gameIds))
    : [];
  const gameMap = Object.fromEntries(gameRows.map((g) => [g.id, g]));

  // Gera linhas da tabela de itens
  const itemsHtml = items.map((item) => {
    const meta = item.metadata as ItemMeta;

    let descLabel: string;
    let typeLabel: string;

    if (item.type === "ticket") {
      const game = item.referenceId ? gameMap[item.referenceId] : null;
      descLabel = game ? `Misto EC vs ${game.opponent} — ${formatDate(game.date)}` : "Ingresso";
      typeLabel = meta?.ticketType === "meia" ? "Meia-entrada" : "Inteira";
    } else {
      descLabel = meta?.name ?? "Produto";
      typeLabel = meta?.size ? `Tam. ${meta.size}` : "—";
    }

    return `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #333;">${descLabel}</td>
        <td style="padding:8px 0;border-bottom:1px solid #333;text-align:center;">${typeLabel}</td>
        <td style="padding:8px 0;border-bottom:1px solid #333;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #333;text-align:right;">${formatPrice(item.quantity * item.unitPriceCents)}</td>
      </tr>`;
  }).join("");

  // Textos que variam por tipo
  const headerSubtitle =
    orderType === "ticket" ? "Bilheteria Digital"
    : orderType === "product" ? "Loja Oficial"
    : "Loja &amp; Bilheteria";

  const bodyGreeting =
    orderType === "ticket"
      ? "Seu ingresso foi confirmado."
      : orderType === "product"
      ? "Seu pedido foi confirmado! Entraremos em contato pelo WhatsApp para combinar a retirada."
      : "Seu pedido foi confirmado!";

  const colLabel = orderType === "ticket" ? "Jogo" : "Produto";

  const appUrl = (process.env.APP_URL ?? "https://mistoec.com.br").replace(/\/$/, "");
  const digits = order.customerWhatsapp.replace(/\D/g, "");
  const pedidosUrl = `${appUrl}/pedidos?tel=${digits}`;

  const footerNote =
    orderType === "ticket"
      ? `Apresente este e-mail ou o número do pedido na entrada do estádio.<br>
         Dúvidas? Fale conosco pelo <a href="https://wa.me/5567991360075" style="color:#c19a5a;">WhatsApp</a>.`
      : `Seu produto estará <strong style="color:#e5e5e5;">pronto para retirada em até 10 dias</strong>. Entraremos em contato pelo WhatsApp para combinar.<br><br>
         Acompanhe seu pedido em <a href="${pedidosUrl}" style="color:#c19a5a;">${appUrl.replace(/https?:\/\//, "")}/pedidos</a>.<br><br>
         Dúvidas? Entre em contato pelo e-mail <a href="mailto:mistoesporteclubetreslagoas@gmail.com" style="color:#c19a5a;">mistoesporteclubetreslagoas@gmail.com</a>
         ou pelo <a href="https://wa.me/5567991360075" style="color:#c19a5a;">WhatsApp</a>.`;

  const subjectPrefix = orderType === "ticket" ? "Ingresso confirmado" : "Pedido confirmado";

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
          <p style="margin:4px 0 0;font-size:12px;color:#0a0a0a;letter-spacing:3px;text-transform:uppercase;">${headerSubtitle}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 24px;">
          <h2 style="margin:0 0 8px;font-size:22px;color:#c19a5a;">✓ Pagamento Confirmado!</h2>
          <p style="margin:0 0 24px;color:#999;font-size:14px;">Olá, <strong style="color:#e5e5e5;">${order.customerName}</strong>! ${bodyGreeting}</p>

          <!-- Items table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;margin-bottom:24px;">
            <thead>
              <tr style="color:#999;font-size:11px;text-transform:uppercase;letter-spacing:1px;">
                <th style="padding:6px 0;text-align:left;">${colLabel}</th>
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

          <p style="margin:0;font-size:13px;color:#999;line-height:1.6;">${footerNote}</p>
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

  const from = process.env.MAILTRAP_FROM ?? "contato@mistoec.com.br";

  await transport.sendMail({
    from: `"Misto EC" <${from}>`,
    to: order.customerEmail,
    subject: `✓ ${subjectPrefix} — Pedido #${order.id.slice(0, 8).toUpperCase()}`,
    html,
  });
}

export async function sendMemberWelcomeEmail(memberId: string): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email] MAILTRAP_* env vars não configuradas — e-mail de boas-vindas ignorado");
    return;
  }

  const [member] = await db
    .select({
      id: members.id,
      name: members.name,
      email: members.email,
      memberCardToken: members.memberCardToken,
      planName: membershipPlans.name,
      planPriceCents: membershipPlans.priceCents,
    })
    .from(members)
    .leftJoin(membershipPlans, eq(members.planId, membershipPlans.id))
    .where(eq(members.id, memberId))
    .limit(1);

  if (!member) return;

  const appUrl = (process.env.APP_URL ?? "https://mistoec.com.br").replace(/\/$/, "");
  const carteirinhaUrl = member.memberCardToken
    ? `${appUrl}/socios/carteirinha/${member.memberCardToken}`
    : `${appUrl}/socios/carteirinha`;

  const from = process.env.MAILTRAP_FROM ?? "contato@mistoec.com.br";

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
          <p style="margin:4px 0 0;font-size:12px;color:#0a0a0a;letter-spacing:3px;text-transform:uppercase;">Sócio-Torcedor</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 24px;">
          <h2 style="margin:0 0 8px;font-size:22px;color:#c19a5a;">Bem-vindo ao clube, ${member.name}!</h2>
          <p style="margin:0 0 24px;color:#999;font-size:14px;">
            Sua assinatura <strong style="color:#e5e5e5;">${member.planName ?? "Sócio-Torcedor"}</strong> está ativa.
            ${member.planPriceCents ? `Valor mensal: <strong style="color:#c19a5a;">${formatPrice(member.planPriceCents)}</strong>.` : ""}
          </p>

          <!-- Card link -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td align="center">
              <a href="${carteirinhaUrl}"
                 style="display:inline-block;background:#c19a5a;color:#0a0a0a;font-weight:bold;font-size:15px;
                        padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:1px;">
                Ver minha carteirinha
              </a>
            </td></tr>
          </table>

          <p style="margin:0 0 16px;font-size:13px;color:#999;line-height:1.6;">
            Acesse sua carteirinha digital para ver seu QR Code, número de sócio e benefícios.
          </p>
          <p style="margin:0;font-size:13px;color:#999;line-height:1.6;">
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

  await transport.sendMail({
    from: `"Misto EC" <${from}>`,
    to: member.email,
    subject: `Bem-vindo ao Misto EC, ${member.name.split(" ")[0]}! Sua carteirinha está pronta`,
    html,
  });
}
