import { getDb } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSiteConfig } from "@/lib/config";
import { getAppBaseUrl } from "@/lib/base-url";
import { sendWhatsappText, toBrazilPhone, isZapiConfigured } from "@/lib/whatsapp/zapi";

/**
 * Notifica o comprador por WhatsApp quando o pedido é confirmado. Os ingressos
 * (QR) vão no e-mail e ficam na área logada (/conta, WhatsApp + senha). Enviado
 * fire-and-forget a partir de sync.ts; no-op se a Z-API não estiver configurada.
 */
export async function sendOrderWhatsapp(orderId: string): Promise<void> {
  if (!isZapiConfigured()) return; // evita trabalho de DB sem provedor

  const db = await getDb();
  const [order] = await db
    .select({
      customerName: orders.customerName,
      customerWhatsapp: orders.customerWhatsapp,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order?.customerWhatsapp) return;
  const phone = toBrazilPhone(order.customerWhatsapp);
  if (!phone) return;

  const [config, baseUrl] = await Promise.all([getSiteConfig(), getAppBaseUrl()]);

  const clubName = config.siteName?.trim() || "sua bilheteria";
  const firstName = (order.customerName ?? "").trim().split(/\s+/)[0];
  const greeting = firstName ? `Olá, ${firstName}!` : "Olá!";
  const link = `${baseUrl.replace(/\/$/, "")}/conta`;

  const message =
    `${greeting} ✅ Seu pagamento no ${clubName} foi confirmado.\n\n` +
    `Seus ingressos foram enviados para o seu e-mail e ficam na sua conta (entre com este WhatsApp e sua senha):\n${link}\n\n` +
    `Basta apresentar o QR Code na entrada. Bom jogo! ⚽`;

  const result = await sendWhatsappText(phone, message);
  if (!result.ok && result.error !== "not_configured") {
    console.error("[whatsapp] envio falhou:", result.error);
  }
}
