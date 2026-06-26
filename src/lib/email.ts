import nodemailer from "nodemailer";
import { getDb } from "@/lib/db/client";
import { orders, orderItems, games, members, membershipPlans, tickets } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getSiteConfig } from "@/lib/config";
import { signTicketToken } from "@/lib/tickets/token";

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

type ItemMeta = { ticketType?: string; typeName?: string; name?: string; size?: string; variantId?: string } | null;

export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email] MAILTRAP_* env vars não configuradas — e-mail de confirmação ignorado");
    return;
  }
  const db = await getDb();
  const [order, siteConfig] = await Promise.all([
    db.select().from(orders).where(eq(orders.id, orderId)).limit(1).then((r) => r[0]),
    getSiteConfig(),
  ]);
  if (!order) return;

  const contactWhatsapp = siteConfig.whatsapp?.trim() || null;
  const contactEmail = siteConfig.email?.trim() || null;
  const waDigits = contactWhatsapp ? contactWhatsapp.replace(/\D/g, "") : null;
  const waLink = waDigits
    ? `<a href="https://wa.me/${waDigits}" style="color:#c19a5a;">WhatsApp</a>`
    : null;

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
      typeLabel = meta?.typeName ?? (meta?.ticketType === "meia" ? "Meia-entrada" : "Inteira");
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

  const shippingAddr = order.shippingAddress as {
    logradouro?: string; numero?: string; complemento?: string;
    bairro?: string; cidade?: string; estado?: string; cep?: string;
  } | null;
  const shippingLine = shippingAddr?.cidade
    ? `${shippingAddr.logradouro ?? ""}, ${shippingAddr.numero ?? ""}${shippingAddr.complemento ? ` ${shippingAddr.complemento}` : ""} — ${shippingAddr.bairro ?? ""}, ${shippingAddr.cidade}/${shippingAddr.estado} — CEP ${shippingAddr.cep ?? ""}`
    : null;
  const shippingService = order.shippingServiceName ?? null;
  const shippingCost = order.shippingCostCents ?? 0;

  const bodyGreeting =
    orderType === "ticket"
      ? "Seu ingresso foi confirmado."
      : orderType === "product"
      ? shippingLine
        ? `Seu pedido foi confirmado! Enviaremos para o endereço abaixo.`
        : `Seu pedido foi confirmado! Entraremos em contato${contactWhatsapp ? " pelo WhatsApp" : ""} para combinar a entrega.`
      : "Seu pedido foi confirmado!";

  const colLabel = orderType === "ticket" ? "Jogo" : "Produto";

  const appUrl = (process.env.APP_URL ?? "https://mistoec.com.br").replace(/\/$/, "");

  // QR codes individuais (novo modelo) ou fallback com ID do pedido
  let qrHtml = "";
  if (hasTickets) {
    try {
      const ticketRows = await db
        .select({ id: tickets.id, typeName: tickets.typeName, gameId: tickets.gameId, typeCode: tickets.typeCode })
        .from(tickets)
        .where(eq(tickets.orderId, orderId));

      const ids = ticketRows.length > 0
        ? await Promise.all(ticketRows.map(async (t) => ({
            id: await signTicketToken(t.id, t.gameId, t.typeCode),
            label: t.typeName,
          })))
        : [{ id: orderId, label: "Ingresso" }];

      const qrCells = ids.map(({ id, label }, i) => {
        const qrUrl = `${appUrl}/api/qr/${encodeURIComponent(id)}`;
        return `
          <td align="center" style="padding:8px;">
            <table cellpadding="0" cellspacing="0" style="background:#f8f8f8;border-radius:12px;padding:12px;display:inline-block;">
              <tr><td align="center">
                <p style="margin:0 0 8px;font-size:11px;color:#555;font-weight:bold;">${label} #${i + 1}</p>
                <img src="${qrUrl}" width="160" height="160" alt="QR Code" style="display:block;border-radius:8px;" />
              </td></tr>
            </table>
          </td>`;
      });

      // Wrap em grupos de 2 por linha
      const rows: string[] = [];
      for (let i = 0; i < qrCells.length; i += 2) {
        rows.push(`<tr>${qrCells.slice(i, i + 2).join("")}</tr>`);
      }

      qrHtml = `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
          <tr><td>
            <p style="margin:0 0 16px;font-size:14px;color:#e5e5e5;font-weight:bold;">🎟️ Seus ingressos</p>
            <p style="margin:0 0 16px;font-size:13px;color:#999;">Apresente o QR Code abaixo na entrada do estádio. Um QR por pessoa.</p>
          </td></tr>
        </table>
        <table cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
          ${rows.join("")}
        </table>
        <p style="margin:0 0 24px;font-size:11px;color:#555;text-align:center;">
          Apólice 6.063.222 · Chubb Seguros Brasil S.A.
        </p>`;
    } catch {
      // QR generation failed — skip silently, fallback to pedidosUrl link
    }
  }

  const digits = order.customerWhatsapp.replace(/\D/g, "");
  const pedidosUrl = `${appUrl}/pedidos?tel=${digits}`;

  const contactParts: string[] = [];
  if (contactEmail) contactParts.push(`e-mail <a href="mailto:${contactEmail}" style="color:#c19a5a;">${contactEmail}</a>`);
  if (waLink) contactParts.push(waLink);
  const contactLine = contactParts.length > 0
    ? `Dúvidas? Entre em contato pelo ${contactParts.join(" ou pelo ")}.`
    : "";

  const footerNote =
    orderType === "ticket"
      ? [
          `Apresente os QR Codes acima na entrada do estádio, um por pessoa.`,
          `Você também pode acessar seus ingressos em <a href="${pedidosUrl}" style="color:#c19a5a;">${appUrl.replace(/https?:\/\//, "")}/pedidos</a>.`,
          contactLine,
        ].filter(Boolean).join("<br>")
      : [
          shippingLine
            ? `Envio via <strong style="color:#e5e5e5;">${shippingService ?? "Correios"}</strong> para:<br><span style="color:#999;">${shippingLine}</span>`
            : `Seu produto estará <strong style="color:#e5e5e5;">pronto para retirada em até 10 dias</strong>. Entraremos em contato${contactWhatsapp ? " pelo WhatsApp" : ""} para combinar.`,
          `Acompanhe seu pedido em <a href="${pedidosUrl}" style="color:#c19a5a;">${appUrl.replace(/https?:\/\//, "")}/pedidos</a>.`,
          contactLine,
        ].filter(Boolean).join("<br><br>");

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
            ${shippingCost > 0 ? `<tr>
              <td style="font-size:13px;color:#999;padding-bottom:6px;">Frete (${shippingService ?? ""})</td>
              <td style="font-size:13px;color:#999;text-align:right;padding-bottom:6px;">${formatPrice(shippingCost)}</td>
            </tr>` : ""}
            <tr>
              <td style="font-size:14px;color:#999;">Total pago</td>
              <td style="font-size:20px;font-weight:bold;color:#c19a5a;text-align:right;">${formatPrice(order.totalCents)}</td>
            </tr>
          </table>

          <!-- QR Codes for ticket orders -->
          ${qrHtml}

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

// ─── Campanha de e-mail (comunicados em massa) ───────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Substitui as variáveis suportadas no assunto/corpo da campanha. */
function resolveTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : ""
  );
}

export interface CampaignEmailResult {
  success: boolean;
  error?: string;
  skipped?: boolean;
}

/**
 * Envia um e-mail de campanha (comunicado) para o cliente de um pedido.
 * Suporta as variáveis {{nome}}, {{codigo}} (código de retirada) e {{locais}}
 * (pontos de retirada configurados), resolvidas por pedido.
 */
export async function sendCampaignEmail(
  orderId: string,
  input: { subject: string; body: string }
): Promise<CampaignEmailResult> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email] MAILTRAP_* não configurado — campanha ignorada");
    return { success: false, error: "Serviço de e-mail não configurado." };
  }

  const db = await getDb();
  const [order, siteConfig] = await Promise.all([
    db.select().from(orders).where(eq(orders.id, orderId)).limit(1).then((r) => r[0]),
    getSiteConfig(),
  ]);
  if (!order) return { success: false, error: "Pedido não encontrado." };
  if (!order.customerEmail) return { success: false, skipped: true, error: "Pedido sem e-mail." };

  // Código de retirada (gera sob demanda se ainda não existir e o pedido qualificar)
  let pickupCode = order.pickupCode ?? "";
  if (!pickupCode) {
    try {
      const { ensurePickupCode } = await import("@/lib/pickup/code");
      pickupCode = (await ensurePickupCode(orderId)) ?? "";
    } catch {
      /* ignora — variável {{codigo}} fica vazia */
    }
  }

  const locations = Array.isArray(siteConfig.pickupLocations) ? siteConfig.pickupLocations : [];
  const locaisText = locations
    .map((l) => [l.name, l.address, l.hours ? `(${l.hours})` : ""].filter(Boolean).join(" — "))
    .join("\n");

  const vars: Record<string, string> = {
    nome: order.customerName,
    codigo: pickupCode,
    locais: locaisText,
  };

  const subject = resolveTemplate(input.subject, vars).trim() || "Comunicado — Misto EC";
  const resolvedBody = resolveTemplate(input.body, vars);
  // Corpo: escapa HTML e converte quebras de linha; destaca o código de retirada.
  const bodyHtml = escapeHtml(resolvedBody).replace(/\n/g, "<br>");

  const appUrl = (process.env.APP_URL ?? "https://mistoec.com.br").replace(/\/$/, "");
  const digits = order.customerWhatsapp.replace(/\D/g, "");
  const pedidosUrl = `${appUrl}/pedidos?tel=${digits}`;

  // Bloco de código de retirada (só quando há código e a variável não foi usada no corpo)
  const codeBlock =
    pickupCode && !/\{\{\s*codigo\s*\}\}/.test(input.body)
      ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr><td align="center" style="background:#0f0f0f;border:1px solid #2a2a2a;border-radius:12px;padding:20px;">
          <p style="margin:0 0 6px;font-size:11px;color:#999;letter-spacing:2px;text-transform:uppercase;">Código de retirada</p>
          <p style="margin:0;font-size:32px;font-weight:bold;color:#c19a5a;letter-spacing:8px;font-family:monospace;">${pickupCode}</p>
        </td></tr>
      </table>`
      : "";

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
          <p style="margin:4px 0 0;font-size:12px;color:#0a0a0a;letter-spacing:3px;text-transform:uppercase;">Comunicado</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 24px;">
          <p style="margin:0;font-size:14px;color:#e5e5e5;line-height:1.7;">${bodyHtml}</p>
          ${codeBlock}
          <p style="margin:24px 0 0;font-size:12px;color:#666;">
            Acompanhe seu pedido em <a href="${pedidosUrl}" style="color:#c19a5a;">${appUrl.replace(/https?:\/\//, "")}/pedidos</a>.
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

  const from = process.env.MAILTRAP_FROM ?? "contato@mistoec.com.br";
  try {
    await transport.sendMail({
      from: `"Misto EC" <${from}>`,
      to: order.customerEmail,
      subject,
      html,
    });
    return { success: true };
  } catch (err) {
    console.error("sendCampaignEmail error:", err);
    return { success: false, error: "Falha ao enviar o e-mail." };
  }
}

export async function sendMemberWelcomeEmail(memberId: string): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email] MAILTRAP_* env vars não configuradas — e-mail de boas-vindas ignorado");
    return;
  }
  const db = await getDb();
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
  const memberConfig = await getSiteConfig();
  const memberWaDigits = memberConfig.whatsapp?.trim() ? memberConfig.whatsapp.replace(/\D/g, "") : null;
  const memberContactEmail = memberConfig.email?.trim() || null;
  const memberContactParts: string[] = [];
  if (memberContactEmail) memberContactParts.push(`e-mail <a href="mailto:${memberContactEmail}" style="color:#c19a5a;">${memberContactEmail}</a>`);
  if (memberWaDigits) memberContactParts.push(`<a href="https://wa.me/${memberWaDigits}" style="color:#c19a5a;">WhatsApp</a>`);
  const memberContactLine = memberContactParts.length > 0
    ? `Dúvidas? Fale conosco pelo ${memberContactParts.join(" ou pelo ")}.`
    : "";

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
          ${memberContactLine ? `<p style="margin:0;font-size:13px;color:#999;line-height:1.6;">${memberContactLine}</p>` : ""}
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
