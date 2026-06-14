import type { AgentTool } from "@/lib/ai/types";

export type ConfirmationLevel = "auto" | "preview" | "danger";

export interface ToolDefinition extends AgentTool {
  displayName: string;
  confirmationLevel: ConfirmationLevel;
  formatConfirmation: (params: Record<string, unknown>) => string;
}

function brl(v: unknown) {
  return typeof v === "number"
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : String(v ?? "—");
}

export const tools: ToolDefinition[] = [
  // ─── CUPONS ─────────────────────────────────────────────────────────────────
  {
    name: "list_coupons",
    displayName: "Listar Cupons",
    description: "Lista todos os cupons de desconto cadastrados no sistema.",
    parameters: { type: "object", properties: {} },
    confirmationLevel: "auto",
    formatConfirmation: () => "Listar todos os cupons",
  },
  {
    name: "create_coupon",
    displayName: "Criar Cupom",
    description:
      "Cria um novo cupom de desconto. discountType: 'pct' (percentual) ou 'fixed' (valor fixo em reais). appliesTo: 'order' (pedido inteiro), 'tickets' (ingressos), 'products' (produtos). Valores monetários em reais.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "Código do cupom em maiúsculas (ex: PROMO10). Se omitido, será gerado automaticamente." },
        discountType: { type: "string", enum: ["pct", "fixed"], description: "'pct' para percentual, 'fixed' para valor fixo em reais" },
        discountValue: { type: "number", description: "Valor do desconto: percentual (ex: 10 para 10%) ou valor em reais (ex: 5 para R$5,00)" },
        appliesTo: { type: "string", enum: ["order", "tickets", "products"], description: "A que o cupom se aplica" },
        description: { type: "string", description: "Descrição opcional do cupom" },
        minOrderValueBRL: { type: "number", description: "Valor mínimo do pedido em reais para o cupom ser válido" },
        maxUsages: { type: "number", description: "Número máximo de usos total (null = ilimitado)" },
        maxUsagesPerCustomer: { type: "number", description: "Número máximo de usos por cliente (null = ilimitado)" },
        expiresAt: { type: "string", description: "Data de expiração em formato ISO 8601 (ex: 2025-12-31T23:59:59)" },
        active: { type: "boolean", description: "Se o cupom estará ativo ao ser criado (padrão: true)" },
      },
      required: ["discountType", "discountValue", "appliesTo"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => {
      const discount =
        p.discountType === "pct" ? `${p.discountValue}% OFF` : `${brl(p.discountValue)} OFF`;
      const applyMap: Record<string, string> = { order: "pedido geral", tickets: "ingressos", products: "produtos" };
      const parts = [`Criar cupom ${p.code || "(código automático)"} — ${discount} em ${applyMap[String(p.appliesTo)] ?? p.appliesTo}`];
      if (p.maxUsagesPerCustomer) parts.push(`limite ${p.maxUsagesPerCustomer}×/cliente`);
      if (p.maxUsages) parts.push(`${p.maxUsages} usos totais`);
      if (p.minOrderValueBRL) parts.push(`mín. ${brl(p.minOrderValueBRL)}`);
      return parts.join(" · ");
    },
  },
  {
    name: "update_coupon",
    displayName: "Editar Cupom",
    description: "Atualiza um cupom existente. Requer o código do cupom. Informe apenas os campos a alterar.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "Código atual do cupom a editar" },
        newCode: { type: "string", description: "Novo código (se quiser alterar)" },
        discountType: { type: "string", enum: ["pct", "fixed"] },
        discountValue: { type: "number" },
        appliesTo: { type: "string", enum: ["order", "tickets", "products"] },
        description: { type: "string" },
        minOrderValueBRL: { type: "number" },
        maxUsages: { type: "number" },
        maxUsagesPerCustomer: { type: "number" },
        expiresAt: { type: "string" },
        active: { type: "boolean" },
      },
      required: ["code"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Editar cupom ${p.code}`,
  },
  {
    name: "toggle_coupon_active",
    displayName: "Ativar/Desativar Cupom",
    description: "Ativa ou desativa um cupom pelo código.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "Código do cupom" },
        active: { type: "boolean", description: "true = ativar, false = desativar" },
      },
      required: ["code", "active"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `${p.active ? "Ativar" : "Desativar"} cupom ${p.code}`,
  },
  {
    name: "delete_coupon",
    displayName: "Excluir Cupom",
    description: "Exclui permanentemente um cupom e seu histórico de uso.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "Código do cupom a excluir" },
      },
      required: ["code"],
    },
    confirmationLevel: "danger",
    formatConfirmation: (p) => `Excluir permanentemente o cupom ${p.code}`,
  },

  // ─── UPSELL ─────────────────────────────────────────────────────────────────
  {
    name: "list_upsell_offers",
    displayName: "Listar Ofertas Upsell",
    description: "Lista todas as ofertas de upsell cadastradas.",
    parameters: { type: "object", properties: {} },
    confirmationLevel: "auto",
    formatConfirmation: () => "Listar ofertas de upsell",
  },
  {
    name: "create_upsell_offer",
    displayName: "Criar Oferta Upsell",
    description:
      "Cria uma nova oferta de upsell exibida no checkout. offerType: 'ticket' (ingresso extra com desconto) ou 'product' (produto da loja). " +
      "triggerType controla quando a oferta aparece: 'any' = qualquer compra, 'ticket' = compras com ingresso, 'product' = compras com qualquer produto, 'specific_product' = compras que contenham um produto específico (nesse caso forneça triggerProductId com o ID do produto — use list_products para obtê-lo). " +
      "Se o usuário mencionar um produto específico como condição de exibição, SEMPRE use triggerType='specific_product' e busque o ID com list_products antes. " +
      "timerMinutes padrão é 5 se não especificado. " +
      "Gere nome e descrição criativos baseados no contexto — nunca peça ao usuário.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome interno da oferta (gere automaticamente se não fornecido)" },
        description: { type: "string", description: "Descrição exibida ao cliente (gere automaticamente se não fornecida)" },
        offerType: { type: "string", enum: ["ticket", "product"], description: "Tipo da oferta" },
        triggerType: {
          type: "string",
          enum: ["any", "ticket", "product", "specific_product"],
          description: "Quando exibir a oferta. Use 'specific_product' quando o usuário mencionar um produto específico como condição.",
        },
        triggerProductId: { type: "string", description: "ID do produto que dispara a oferta (obrigatório quando triggerType='specific_product')" },
        discountPct: { type: "number", description: "Percentual de desconto (ex: 20 para 20%)" },
        timerMinutes: { type: "number", description: "Contador regressivo em minutos. Padrão: 5. Use 0 apenas se o usuário pedir explicitamente sem timer." },
        minOrderValueBRL: { type: "number", description: "Valor mínimo do pedido em reais para exibir a oferta" },
        offerQuantity: { type: "number", description: "Quantidade do item incluída na oferta (padrão: 1)" },
        active: { type: "boolean", description: "Se a oferta estará ativa (padrão: true)" },
      },
      required: ["name", "offerType", "discountPct"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Criar oferta upsell "${p.name ?? p.title}" — ${p.discountPct}% OFF (${p.offerType === "ticket" ? "ingresso" : "produto"})`,
  },
  {
    name: "toggle_upsell_offer_active",
    displayName: "Ativar/Desativar Upsell",
    description: "Ativa ou desativa uma oferta de upsell pelo ID.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID da oferta de upsell" },
        active: { type: "boolean" },
      },
      required: ["id", "active"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `${p.active ? "Ativar" : "Desativar"} oferta upsell`,
  },
  {
    name: "delete_upsell_offer",
    displayName: "Excluir Oferta Upsell",
    description: "Exclui permanentemente uma oferta de upsell.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID da oferta de upsell" },
      },
      required: ["id"],
    },
    confirmationLevel: "danger",
    formatConfirmation: () => "Excluir oferta de upsell permanentemente",
  },

  // ─── PEDIDOS ─────────────────────────────────────────────────────────────────
  {
    name: "list_orders",
    displayName: "Listar Pedidos",
    description: "Lista pedidos com filtros opcionais. Status: 'pending', 'paid', 'cancelled', 'refunded'.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "paid", "cancelled", "refunded"], description: "Filtrar por status" },
        search: { type: "string", description: "Buscar por nome do cliente ou WhatsApp" },
        limit: { type: "number", description: "Número de resultados (padrão: 10, máx: 50)" },
      },
    },
    confirmationLevel: "auto",
    formatConfirmation: (p) => `Listar pedidos${p.status ? ` (${p.status})` : ""}`,
  },
  {
    name: "get_order_detail",
    displayName: "Detalhes do Pedido",
    description: "Busca detalhes completos de um pedido pelo ID.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "ID completo ou prefixo do pedido" },
      },
      required: ["orderId"],
    },
    confirmationLevel: "auto",
    formatConfirmation: (p) => `Ver detalhes do pedido ${String(p.orderId).slice(0, 8)}`,
  },
  {
    name: "cancel_order",
    displayName: "Cancelar Pedido",
    description: "Cancela um pedido pendente.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "ID do pedido a cancelar" },
      },
      required: ["orderId"],
    },
    confirmationLevel: "danger",
    formatConfirmation: (p) => `Cancelar pedido ${String(p.orderId).slice(0, 8).toUpperCase()}`,
  },
  {
    name: "refund_order",
    displayName: "Reembolsar Pedido",
    description: "Registra o reembolso de um pedido pago.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "ID do pedido a reembolsar" },
      },
      required: ["orderId"],
    },
    confirmationLevel: "danger",
    formatConfirmation: (p) => `Reembolsar pedido ${String(p.orderId).slice(0, 8).toUpperCase()}`,
  },

  // ─── JOGOS ────────────────────────────────────────────────────────────────────
  {
    name: "list_games",
    displayName: "Listar Jogos",
    description: "Lista jogos cadastrados.",
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Buscar por adversário" },
        limit: { type: "number", description: "Número de resultados" },
      },
    },
    confirmationLevel: "auto",
    formatConfirmation: () => "Listar jogos",
  },
  {
    name: "create_game",
    displayName: "Criar Jogo",
    description: "Cria um novo jogo no calendário. Todos os jogos criados via assistente são jogos em casa (isHome: true) por padrão.",
    parameters: {
      type: "object",
      properties: {
        opponent: { type: "string", description: "Nome do adversário" },
        date: { type: "string", description: "Data e hora no formato ISO 8601 (ex: 2025-08-15T19:00:00)" },
        venue: { type: "string", description: "Local do jogo (ex: Estádio Pedro Pedrossian)" },
        competition: { type: "string", description: "Nome da competição (ex: Campeonato Sul-Mato-Grossense)" },
        round: { type: "string", description: "Rodada ou fase (ex: Rodada 1, Semifinal)" },
        isHome: { type: "boolean", description: "Jogo em casa? (padrão: true)" },
        active: { type: "boolean", description: "Exibir na bilheteria? (padrão: true)" },
      },
      required: ["opponent", "date", "venue"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) =>
      `Criar jogo vs ${p.opponent} em ${new Date(String(p.date)).toLocaleDateString("pt-BR")} — ${p.venue}`,
  },
  {
    name: "update_game",
    displayName: "Editar Jogo",
    description: "Atualiza dados de um jogo. Requer o ID do jogo.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do jogo" },
        opponent: { type: "string" },
        date: { type: "string" },
        venue: { type: "string" },
        competition: { type: "string" },
        round: { type: "string" },
        active: { type: "boolean" },
      },
      required: ["id"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Editar jogo ${p.id ? String(p.id).slice(0, 8) : ""}`,
  },
  {
    name: "toggle_game_active",
    displayName: "Ativar/Desativar Jogo",
    description: "Ativa ou desativa um jogo na bilheteria.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do jogo" },
        active: { type: "boolean" },
      },
      required: ["id", "active"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `${p.active ? "Ativar" : "Desativar"} jogo na bilheteria`,
  },

  // ─── CONFIGURAÇÕES ────────────────────────────────────────────────────────────
  {
    name: "get_site_config",
    displayName: "Ver Configurações",
    description: "Retorna as configurações atuais do site, incluindo preços dos ingressos e outras opções.",
    parameters: { type: "object", properties: {} },
    confirmationLevel: "auto",
    formatConfirmation: () => "Ver configurações do site",
  },
  {
    name: "update_site_config",
    displayName: "Atualizar Configurações",
    description: "Atualiza configurações do site. Forneça os valores em reais.",
    parameters: {
      type: "object",
      properties: {
        ticketPriceInteiraBRL: { type: "number", description: "Preço do ingresso inteira em reais" },
        ticketPriceMeiaBRL: { type: "number", description: "Preço do ingresso meia em reais" },
      },
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => {
      const parts: string[] = [];
      if (p.ticketPriceInteiraBRL) parts.push(`Inteira: ${brl(p.ticketPriceInteiraBRL)}`);
      if (p.ticketPriceMeiaBRL) parts.push(`Meia: ${brl(p.ticketPriceMeiaBRL)}`);
      return `Atualizar preços: ${parts.join(", ")}`;
    },
  },

  // ─── CLIENTES ─────────────────────────────────────────────────────────────────
  {
    name: "search_customers",
    displayName: "Buscar Clientes",
    description: "Busca clientes por nome ou WhatsApp.",
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Nome ou número de WhatsApp" },
        limit: { type: "number", description: "Número de resultados (padrão: 10)" },
      },
      required: ["search"],
    },
    confirmationLevel: "auto",
    formatConfirmation: (p) => `Buscar clientes: "${p.search}"`,
  },
  {
    name: "get_customer_detail",
    displayName: "Detalhes do Cliente",
    description: "Retorna dados completos de um cliente e seu histórico de pedidos.",
    parameters: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "ID do cliente" },
      },
      required: ["customerId"],
    },
    confirmationLevel: "auto",
    formatConfirmation: () => "Ver detalhes do cliente",
  },

  // ─── PRODUTOS ─────────────────────────────────────────────────────────────────
  {
    name: "list_products",
    displayName: "Listar Produtos",
    description: "Lista produtos da loja.",
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Buscar por nome do produto" },
        limit: { type: "number" },
      },
    },
    confirmationLevel: "auto",
    formatConfirmation: () => "Listar produtos da loja",
  },
  {
    name: "toggle_product_active",
    displayName: "Ativar/Desativar Produto",
    description: "Ativa ou desativa um produto na loja.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do produto" },
        active: { type: "boolean" },
      },
      required: ["id", "active"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `${p.active ? "Ativar" : "Desativar"} produto na loja`,
  },
];

export function getToolsForAI(): AgentTool[] {
  return tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
}

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return tools.find((t) => t.name === name);
}
