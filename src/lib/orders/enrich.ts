// INTERNO (não é server action): monta os pedidos para exibição ao cliente.
// `withCredentials` (QR/token de ingresso, código de retirada) só quando o
// acesso prova que é o comprador: link enviado a ele, ou conta com e-mail
// confirmado. Número digitado → consulta sem credenciais.
import { getOrdersByEmail, type getOrdersByWhatsapp } from "@/lib/db/queries";

type RawOrders = Awaited<ReturnType<typeof getOrdersByWhatsapp>>;

export async function enrichOrders(
  orders: RawOrders,
  opts: { withCredentials: boolean }
) {
  const { getSiteConfig, DEFAULT_CLUB_LOGO_URL } = await import("@/lib/config");
  const config = await getSiteConfig();
  const clubLogoUrl = config.clubLogoUrl || DEFAULT_CLUB_LOGO_URL;
  const { ensureTicketsForOrder } = await import("@/lib/tickets/generate");
  const { signTicketToken } = await import("@/lib/tickets/token");
  const { ensurePickupCode } = await import("@/lib/pickup/code");
  const { getSoldNumbersForOrders } = await import("@/lib/raffle/queries");

  // Números de rifa de TODOS os pedidos pagos com item de rifa, em lote (3 queries
  // no total, em vez de 3 por pedido).
  const raffleOrderIds = orders
    .filter((o) => o.status === "paid" && Array.isArray(o.items) && o.items.some((it) => it.type === "raffle"))
    .map((o) => o.id);
  const raffleNumbersByOrder = await getSoldNumbersForOrders(raffleOrderIds);

  // Anexa os ingressos individuais (1 QR por ingresso) com token JWT assinado
  return Promise.all(
    orders.map(async (o) => {
      const rawTickets = o.status === "paid" ? await ensureTicketsForOrder(o.id) : [];
      const tickets = opts.withCredentials
        ? await Promise.all(
            rawTickets.map(async (t) => ({
              ...t,
              qrToken: await signTicketToken(t.id, t.gameId, t.typeCode) as string | undefined,
            }))
          )
        : // Sem credenciais: id/serial/QR do ingresso também valem na portaria
          // (código digitado), então saem todos — fica só tipo e situação.
          rawTickets.map((t, i) => ({
            ...t,
            id: `oculto-${o.id.slice(0, 8)}-${i}`,
            serialNo: null,
            qrToken: undefined as string | undefined,
          }));
      // Gera/recupera o código de retirada para pedidos de retirada pagos.
      const pickupCode = o.status === "paid" ? await ensurePickupCode(o.id) : null;
      const raffleNumbers = raffleNumbersByOrder.get(o.id) ?? [];
      // idempotencyKey nunca vai ao browser: prova que o navegador é o do comprador.
      const { idempotencyKey: _idem, ...order } = o;
      void _idem;
      return {
        ...order,
        clubLogoUrl,
        siteName: config.siteName,
        tickets,
        pickupCode: opts.withCredentials ? (pickupCode ?? o.pickupCode) : null,
        raffleNumbers,
        credentialsHidden: !opts.withCredentials,
        // Há código de retirada, mas oculto (a tela mostra o aviso no lugar).
        pickupHidden: !opts.withCredentials && !!(pickupCode ?? o.pickupCode),
      };
    })
  );
}

/** Pedidos do e-mail CONFIRMADO de uma conta logada (com credenciais). */
export async function loadOrdersForVerifiedEmail(email: string) {
  return enrichOrders(await getOrdersByEmail(email), { withCredentials: true });
}
