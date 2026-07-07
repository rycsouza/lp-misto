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
    description: "Ativa ou desativa uma oferta de upsell. Passe o ID ou o nome da oferta no campo 'id'.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID (UUID) ou nome da oferta de upsell" },
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
    description: "Exclui permanentemente uma oferta de upsell. Passe o ID ou o nome da oferta no campo 'id' — o sistema fará o lookup automaticamente.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID (UUID) ou nome da oferta de upsell" },
      },
      required: ["id"],
    },
    confirmationLevel: "danger",
    formatConfirmation: (p) => `Excluir oferta de upsell "${p.id}" permanentemente`,
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
  {
    name: "delete_game",
    displayName: "Excluir Jogo",
    description: "Desativa e remove um jogo do calendário. Aceita ID do jogo.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do jogo a excluir" },
      },
      required: ["id"],
    },
    confirmationLevel: "danger",
    formatConfirmation: (p) => `Excluir jogo ${String(p.id).slice(0, 8)}`,
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
    description: "Atualiza configurações do site: preços de ingressos e informações de contato do clube (WhatsApp, e-mail, Instagram). Forneça valores monetários em reais.",
    parameters: {
      type: "object",
      properties: {
        ticketPriceInteiraBRL: { type: "number", description: "Preço do ingresso inteira em reais" },
        ticketPriceMeiaBRL: { type: "number", description: "Preço do ingresso meia em reais" },
        whatsapp: { type: "string", description: "Número WhatsApp do clube (ex: +5567991360075)" },
        email: { type: "string", description: "E-mail de contato do clube" },
        instagram: { type: "string", description: "URL do Instagram do clube" },
      },
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => {
      const parts: string[] = [];
      if (p.ticketPriceInteiraBRL) parts.push(`Inteira: ${brl(p.ticketPriceInteiraBRL)}`);
      if (p.ticketPriceMeiaBRL) parts.push(`Meia: ${brl(p.ticketPriceMeiaBRL)}`);
      if (p.whatsapp) parts.push(`WhatsApp: ${p.whatsapp}`);
      if (p.email) parts.push(`E-mail: ${p.email}`);
      if (p.instagram) parts.push(`Instagram: ${p.instagram}`);
      return `Atualizar configurações: ${parts.join(", ")}`;
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
    name: "create_product",
    displayName: "Criar Produto",
    description:
      "Cria um novo produto na loja. category: 'camisa_oficial', 'camisa_torcedor' ou 'infantil' (camiseta infantil). priceBRL em reais. " +
      "imageUrl: URL da imagem — use a URL fornecida pelo usuário via anexo, se houver. " +
      "Gere nome e slug criativos baseados no contexto — nunca peça ao usuário.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome do produto (gere automaticamente se não fornecido)" },
        category: { type: "string", enum: ["camisa_oficial", "camisa_torcedor", "infantil"], description: "Categoria do produto" },
        priceBRL: { type: "number", description: "Preço em reais" },
        imageUrl: { type: "string", description: "URL da imagem do produto (use a imagem anexada pelo usuário, se houver)" },
        stock: { type: "number", description: "Estoque inicial (opcional)" },
        active: { type: "boolean", description: "Se true, o produto fica visível na loja imediatamente" },
      },
      required: ["name", "category", "priceBRL"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => {
      const labels: Record<string, string> = { camisa_oficial: "Camisa Oficial", camisa_torcedor: "Camisa Torcedor", infantil: "Camiseta Infantil" };
      return `Criar produto "${p.name}" — ${brl(p.priceBRL)} (${labels[String(p.category)] ?? String(p.category)})`;
    },
  },
  {
    name: "update_product",
    displayName: "Atualizar Produto",
    description: "Atualiza dados de um produto existente. Aceita ID ou nome do produto. Informe apenas os campos a alterar.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome do produto" },
        name: { type: "string", description: "Novo nome" },
        category: { type: "string", enum: ["camisa_oficial", "camisa_torcedor"], description: "Nova categoria" },
        priceBRL: { type: "number", description: "Novo preço em reais" },
        salePriceBRL: { type: "number", description: "Preço promocional em reais (null para remover promoção)" },
        imageUrl: { type: "string", description: "Nova URL de imagem (use a imagem anexada pelo usuário, se houver)" },
        stock: { type: "number", description: "Novo estoque (null = ilimitado)" },
        active: { type: "boolean", description: "Ativar/desativar na loja" },
        comingSoon: { type: "boolean", description: "Marcar como Em Breve (true/false)" },
        limitedStock: { type: "boolean", description: "Exibir badge 'Estoque Limitado' no card do produto (true/false)" },
      },
      required: ["id"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Atualizar produto "${p.id}"`,
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

  {
    name: "list_product_variants",
    displayName: "Listar Variantes do Produto",
    description: "Lista todas as variantes (cor + tamanho + estoque) de um produto. Aceita ID ou nome do produto.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string", description: "ID ou nome do produto" },
      },
      required: ["productId"],
    },
    confirmationLevel: "auto",
    formatConfirmation: (p) => `Listar variantes de "${p.productId}"`,
  },
  {
    name: "create_variants_bulk",
    displayName: "Criar Variantes em Lote",
    description:
      "Cria múltiplas variantes de uma vez para um produto — combinando cores e tamanhos. " +
      "Ideal para cadastrar todas as variações de uma vez: ex. branca + preta × todos os tamanhos. " +
      "colors: array de objetos {color, colorImageUrl?}. " +
      "IMPORTANTE: se a mensagem contiver '[Imagem 1 anexada pelo usuário: URL1]' e '[Imagem 2 ...: URL2]', " +
      "SEMPRE inclua colorImageUrl para cada cor na ordem correspondente. " +
      "Ex: [{color:'Branca', colorImageUrl:'URL1'}, {color:'Preta', colorImageUrl:'URL2'}]. " +
      "sizes: array de tamanhos. Se omitido, usa todos: ['PP','P','M','G','GG','XGG','Único']. " +
      "Preço por variante (opcional): use priceBRL dentro de cada cor para preço só daquela cor " +
      "(ex: 'azul custa 79' → {color:'Azul', priceBRL:79}), ou priceBRL no topo como padrão para todas. " +
      "Sem preço, a variante usa o preço do produto. " +
      "Aceita ID ou nome do produto em productId.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string", description: "ID ou nome do produto" },
        colors: {
          type: "array",
          description: "Lista de cores. Cada item pode ter 'color' (nome), 'colorImageUrl' (URL da imagem) e 'priceBRL' (preço só desta cor).",
          items: {
            type: "object",
            properties: {
              color: { type: "string", description: "Nome da cor (ex: Branca, Preta)" },
              colorImageUrl: { type: "string", description: "URL da imagem desta cor (use a imagem anexada pelo usuário)" },
              priceBRL: { type: "number", description: "Preço em reais só desta cor (opcional; vazio = usa o preço do produto)" },
            },
            required: ["color"],
          },
        },
        sizes: {
          type: "array",
          description: "Tamanhos a criar. Se omitido usa todos: PP, P, M, G, GG, XGG, Único.",
          items: { type: "string" },
        },
        stock: { type: "number", description: "Estoque por variante (vazio = ilimitado)" },
        priceBRL: { type: "number", description: "Preço em reais aplicado a todas as variantes criadas (opcional; o preço por cor tem prioridade)" },
        active: { type: "boolean", description: "Ativar variantes ao criar (padrão: true)" },
      },
      required: ["productId", "colors"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => {
      const colorsArr = p.colors as Array<{ color: string; colorImageUrl?: string; priceBRL?: number }>;
      const defaultPrice = typeof p.priceBRL === "number" ? p.priceBRL : undefined;
      const colorLabels = colorsArr
        .map((c) => {
          const price = typeof c.priceBRL === "number" ? c.priceBRL : defaultPrice;
          const parts = [c.color];
          if (c.colorImageUrl) parts.push("[foto]");
          if (price != null) parts.push(`(${brl(price)})`);
          return parts.join(" ");
        })
        .join(", ");
      const sizes = Array.isArray(p.sizes) ? (p.sizes as string[]).join(", ") : "PP, P, M, G, GG, XGG, Único";
      const count = colorsArr.length * (Array.isArray(p.sizes) ? (p.sizes as unknown[]).length : 7);
      return `Criar ${count} variantes para "${p.productId}" — cores: ${colorLabels} · tamanhos: ${sizes}`;
    },
  },
  {
    name: "delete_variant",
    displayName: "Excluir Variante",
    description: "Exclui permanentemente uma variante de produto. Use list_product_variants para obter os IDs das variantes antes de excluir.",
    parameters: {
      type: "object",
      properties: {
        variantId: { type: "string", description: "ID da variante a excluir" },
      },
      required: ["variantId"],
    },
    confirmationLevel: "danger",
    formatConfirmation: (p) => `Excluir variante ${String(p.variantId).slice(0, 8)} permanentemente`,
  },

  // ─── DASHBOARD ───────────────────────────────────────────────────────────────
  {
    name: "get_dashboard_stats",
    displayName: "Estatísticas do Painel",
    description: "Retorna métricas do painel: receita hoje, receita do mês, pedidos hoje, pendentes, pagos, cancelados e gráfico dos últimos 7 dias.",
    parameters: { type: "object", properties: {} },
    confirmationLevel: "auto",
    formatConfirmation: () => "Buscar estatísticas do painel",
  },

  // ─── LEADS ───────────────────────────────────────────────────────────────────
  {
    name: "list_leads",
    displayName: "Listar Leads",
    description: "Lista os leads cadastrados (pessoas que demonstraram interesse). Pode filtrar por fonte e busca por nome/e-mail.",
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Busca por nome ou e-mail" },
        source: { type: "string", description: "Fonte: ticket_checkout, membership_interest, sponsorship_interest, newsletter, history_gallery" },
        limit: { type: "number", description: "Máximo de resultados (padrão 20)" },
      },
    },
    confirmationLevel: "auto",
    formatConfirmation: () => "Listar leads",
  },

  // ─── NOTÍCIAS ────────────────────────────────────────────────────────────────
  {
    name: "list_news",
    displayName: "Listar Notícias",
    description: "Lista as notícias cadastradas no site.",
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Busca por título" },
        limit: { type: "number" },
      },
    },
    confirmationLevel: "auto",
    formatConfirmation: () => "Listar notícias",
  },
  {
    name: "toggle_news_active",
    displayName: "Publicar/Despublicar Notícia",
    description: "Publica ou despublica uma notícia pelo ID ou título.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou trecho do título da notícia" },
        active: { type: "boolean", description: "true = publicar, false = despublicar" },
      },
      required: ["id", "active"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `${p.active ? "Publicar" : "Despublicar"} notícia`,
  },
  {
    name: "create_news",
    displayName: "Criar Notícia",
    description: "Cria uma nova notícia. category: 'futebol_profissional', 'base', 'institucional', 'socio_torcedor' ou 'patrocinadores'. imageUrl: URL da imagem — use a imagem anexada pelo usuário, se houver. Gere título e resumo automaticamente se não fornecidos.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título da notícia" },
        summary: { type: "string", description: "Resumo/texto da notícia" },
        category: { type: "string", enum: ["futebol_profissional", "base", "institucional", "socio_torcedor", "patrocinadores"] },
        imageUrl: { type: "string", description: "URL da imagem (use imagem anexada se houver)" },
        featured: { type: "boolean", description: "Destacar na home?" },
        active: { type: "boolean", description: "Publicar imediatamente?" },
      },
      required: ["title", "summary", "category"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Criar notícia "${p.title}"`,
  },
  {
    name: "update_news",
    displayName: "Atualizar Notícia",
    description: "Atualiza dados de uma notícia (título, resumo, imagem, status). Aceita ID ou trecho do título.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou trecho do título da notícia" },
        title: { type: "string" },
        summary: { type: "string" },
        imageUrl: { type: "string", description: "Nova URL de imagem (use imagem anexada se houver)" },
        active: { type: "boolean" },
        featured: { type: "boolean" },
      },
      required: ["id"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Atualizar notícia "${p.id}"`,
  },

  {
    name: "delete_news",
    displayName: "Excluir Notícia",
    description: "Exclui (desativa) uma notícia. Aceita ID ou trecho do título.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou trecho do título da notícia" },
      },
      required: ["id"],
    },
    confirmationLevel: "danger",
    formatConfirmation: (p) => `Excluir notícia "${p.id}"`,
  },

  // ─── ELENCO ───────────────────────────────────────────────────────────────────
  {
    name: "list_players",
    displayName: "Listar Elenco",
    description: "Lista jogadores do elenco. Pode filtrar por temporada ou posição.",
    parameters: {
      type: "object",
      properties: {
        season: { type: "number", description: "Temporada (ano). Se omitido, usa a atual." },
        position: { type: "string", enum: ["goleiro", "zagueiro", "lateral", "volante", "meia", "atacante"] },
      },
    },
    confirmationLevel: "auto",
    formatConfirmation: () => "Listar elenco",
  },
  {
    name: "create_player",
    displayName: "Cadastrar Jogador",
    description: "Cadastra um jogador no elenco. position: 'goleiro','zagueiro','lateral','volante','meia','atacante'. photoUrl: use a imagem anexada se houver.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome do jogador" },
        number: { type: "number", description: "Número da camisa" },
        position: { type: "string", enum: ["goleiro", "zagueiro", "lateral", "volante", "meia", "atacante"] },
        photoUrl: { type: "string", description: "URL da foto (use imagem anexada se houver)" },
        season: { type: "number", description: "Temporada (ano). Se omitido, usa o ano atual." },
        active: { type: "boolean" },
      },
      required: ["name", "position"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Cadastrar jogador ${p.name} (${p.position})`,
  },
  {
    name: "update_player",
    displayName: "Atualizar Jogador",
    description: "Atualiza dados de um jogador (nome, foto, número, posição). Aceita ID ou nome.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome do jogador" },
        name: { type: "string" },
        number: { type: "number" },
        position: { type: "string", enum: ["goleiro", "zagueiro", "lateral", "volante", "meia", "atacante"] },
        photoUrl: { type: "string", description: "Nova URL da foto (use imagem anexada se houver)" },
        active: { type: "boolean" },
      },
      required: ["id"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Atualizar jogador "${p.id}"`,
  },

  {
    name: "delete_player",
    displayName: "Excluir Jogador",
    description: "Remove um jogador do elenco. Aceita ID ou nome.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome do jogador" },
      },
      required: ["id"],
    },
    confirmationLevel: "danger",
    formatConfirmation: (p) => `Excluir jogador "${p.id}" do elenco`,
  },

  // ─── PATROCINADORES ──────────────────────────────────────────────────────────
  {
    name: "list_sponsors",
    displayName: "Listar Patrocinadores",
    description: "Lista todos os patrocinadores cadastrados.",
    parameters: { type: "object", properties: {} },
    confirmationLevel: "auto",
    formatConfirmation: () => "Listar patrocinadores",
  },
  {
    name: "create_sponsor",
    displayName: "Cadastrar Patrocinador",
    description: "Cadastra um novo patrocinador. tier: 'diamante','ouro','prata','bronze'. logoTone: 'light' ou 'dark'. logoUrl: OBRIGATÓRIO — use a imagem anexada pelo usuário.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome do patrocinador" },
        logoUrl: { type: "string", description: "URL do logo (use imagem anexada — obrigatório)" },
        logoTone: { type: "string", enum: ["light", "dark"], description: "Tonalidade do logo: 'light' para logos claros, 'dark' para logos escuros" },
        tier: { type: "string", enum: ["diamante", "ouro", "prata", "bronze"] },
        instagramUrl: { type: "string", description: "URL do Instagram (opcional)" },
        active: { type: "boolean" },
      },
      required: ["name", "logoUrl", "tier"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Cadastrar patrocinador "${p.name}" (${p.tier})`,
  },
  {
    name: "update_sponsor",
    displayName: "Atualizar Patrocinador",
    description: "Atualiza dados de um patrocinador (nome, logo, tier). Aceita ID ou nome.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome do patrocinador" },
        name: { type: "string" },
        logoUrl: { type: "string", description: "Nova URL do logo (use imagem anexada se houver)" },
        logoTone: { type: "string", enum: ["light", "dark"] },
        tier: { type: "string", enum: ["diamante", "ouro", "prata", "bronze"] },
        instagramUrl: { type: "string" },
        active: { type: "boolean" },
      },
      required: ["id"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Atualizar patrocinador "${p.id}"`,
  },

  {
    name: "delete_sponsor",
    displayName: "Excluir Patrocinador",
    description: "Remove um patrocinador. Aceita ID ou nome.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome do patrocinador" },
      },
      required: ["id"],
    },
    confirmationLevel: "danger",
    formatConfirmation: (p) => `Excluir patrocinador "${p.id}"`,
  },

  // ─── DIRETORIA ────────────────────────────────────────────────────────────────
  {
    name: "list_board_members",
    displayName: "Listar Diretoria",
    description: "Lista os membros da diretoria do clube.",
    parameters: { type: "object", properties: {} },
    confirmationLevel: "auto",
    formatConfirmation: () => "Listar diretoria",
  },
  {
    name: "create_board_member",
    displayName: "Cadastrar Membro da Diretoria",
    description: "Cadastra um membro da diretoria. group: 'executive' ou 'fiscal'. fiscalType (apenas para fiscal): 'titular' ou 'suplente'. photoUrl: use a imagem anexada se houver.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome completo" },
        role: { type: "string", description: "Cargo (ex: Presidente, Vice-Presidente)" },
        profession: { type: "string", description: "Profissão (opcional)" },
        photoUrl: { type: "string", description: "URL da foto (use imagem anexada se houver)" },
        group: { type: "string", enum: ["executive", "fiscal"] },
        fiscalType: { type: "string", enum: ["titular", "suplente"], description: "Obrigatório quando group='fiscal'" },
        active: { type: "boolean" },
      },
      required: ["name", "role", "group"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Cadastrar ${p.name} como ${p.role} na diretoria`,
  },
  {
    name: "update_board_member",
    displayName: "Atualizar Membro da Diretoria",
    description: "Atualiza dados de um membro da diretoria. Aceita ID ou nome.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome do membro" },
        name: { type: "string" },
        role: { type: "string" },
        profession: { type: "string" },
        photoUrl: { type: "string", description: "Nova URL da foto (use imagem anexada se houver)" },
        active: { type: "boolean" },
      },
      required: ["id"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Atualizar membro da diretoria "${p.id}"`,
  },

  {
    name: "delete_board_member",
    displayName: "Excluir Membro da Diretoria",
    description: "Remove um membro da diretoria. Aceita ID ou nome.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome do membro" },
      },
      required: ["id"],
    },
    confirmationLevel: "danger",
    formatConfirmation: (p) => `Excluir membro da diretoria "${p.id}"`,
  },

  // ─── LENDAS ───────────────────────────────────────────────────────────────────
  {
    name: "list_legends",
    displayName: "Listar Lendas",
    description: "Lista as lendas do clube.",
    parameters: { type: "object", properties: {} },
    confirmationLevel: "auto",
    formatConfirmation: () => "Listar lendas do clube",
  },
  {
    name: "create_legend",
    displayName: "Cadastrar Lenda",
    description: "Cadastra uma lenda do clube. photoUrl: use a imagem anexada se houver.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome do jogador/personalidade" },
        position: { type: "string", description: "Posição ou função (ex: Atacante, Técnico)" },
        photoUrl: { type: "string", description: "URL da foto (use imagem anexada se houver)" },
        active: { type: "boolean" },
      },
      required: ["name"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Cadastrar lenda "${p.name}"`,
  },
  {
    name: "update_legend",
    displayName: "Atualizar Lenda",
    description: "Atualiza dados de uma lenda do clube. Aceita ID ou nome.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome da lenda" },
        name: { type: "string" },
        position: { type: "string" },
        photoUrl: { type: "string", description: "Nova URL da foto (use imagem anexada se houver)" },
        active: { type: "boolean" },
      },
      required: ["id"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Atualizar lenda "${p.id}"`,
  },

  {
    name: "delete_legend",
    displayName: "Excluir Lenda",
    description: "Remove uma lenda do clube. Aceita ID ou nome.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome da lenda" },
      },
      required: ["id"],
    },
    confirmationLevel: "danger",
    formatConfirmation: (p) => `Excluir lenda "${p.id}"`,
  },

  // ─── PROMOÇÕES ───────────────────────────────────────────────────────────────
  {
    name: "list_promotions",
    displayName: "Listar Promoções",
    description: "Lista todas as promoções de desconto automático cadastradas (aplicadas sem código no checkout).",
    parameters: { type: "object", properties: {} },
    confirmationLevel: "auto",
    formatConfirmation: () => "Listar promoções",
  },
  {
    name: "create_promotion",
    displayName: "Criar Promoção",
    description:
      "Cria uma promoção de desconto automático aplicada no checkout sem necessidade de código. " +
      "discountType: 'pct' (percentual) ou 'fixed' (valor fixo em reais). " +
      "appliesTo: 'all' (tudo), 'tickets' (ingressos), 'products' (produtos). " +
      "flashSale: true torna a promoção uma oferta relâmpago com countdown no site.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome da promoção" },
        description: { type: "string", description: "Descrição interna (opcional)" },
        discountType: { type: "string", enum: ["pct", "fixed"], description: "'pct' percentual, 'fixed' valor fixo em reais" },
        discountValue: { type: "number", description: "Valor: percentual (ex: 20 para 20%) ou reais (ex: 10 para R$10,00)" },
        appliesTo: { type: "string", enum: ["all", "tickets", "products"], description: "A que se aplica" },
        minOrderValueBRL: { type: "number", description: "Valor mínimo do pedido em reais para ativar (opcional)" },
        startsAt: { type: "string", description: "Início da promoção ISO 8601 (ex: 2025-08-01T00:00:00)" },
        endsAt: { type: "string", description: "Fim da promoção ISO 8601 (ex: 2025-08-31T23:59:59)" },
        flashSale: { type: "boolean", description: "Se true, exibe countdown regressivo no site" },
        active: { type: "boolean", description: "Ativar imediatamente (padrão: true)" },
      },
      required: ["name", "discountType", "discountValue", "appliesTo", "startsAt", "endsAt"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => {
      const discount = p.discountType === "pct" ? `${p.discountValue}% OFF` : `${brl(p.discountValue)} OFF`;
      return `Criar promoção "${p.name}" — ${discount} em ${p.appliesTo}${p.flashSale ? " ⚡ Flash Sale" : ""}`;
    },
  },
  {
    name: "update_promotion",
    displayName: "Editar Promoção",
    description: "Atualiza dados de uma promoção. Aceita ID ou nome da promoção.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome da promoção" },
        name: { type: "string" },
        description: { type: "string" },
        discountType: { type: "string", enum: ["pct", "fixed"] },
        discountValue: { type: "number" },
        appliesTo: { type: "string", enum: ["all", "tickets", "products"] },
        minOrderValueBRL: { type: "number" },
        startsAt: { type: "string" },
        endsAt: { type: "string" },
        flashSale: { type: "boolean" },
        active: { type: "boolean" },
      },
      required: ["id"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Editar promoção "${p.id}"`,
  },
  {
    name: "toggle_promotion_active",
    displayName: "Ativar/Pausar Promoção",
    description: "Ativa ou pausa uma promoção. Aceita ID ou nome.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome da promoção" },
        active: { type: "boolean", description: "true = ativar, false = pausar" },
      },
      required: ["id", "active"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `${p.active ? "Ativar" : "Pausar"} promoção "${p.id}"`,
  },
  {
    name: "delete_promotion",
    displayName: "Excluir Promoção",
    description: "Exclui permanentemente uma promoção. Aceita ID ou nome.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome da promoção" },
      },
      required: ["id"],
    },
    confirmationLevel: "danger",
    formatConfirmation: (p) => `Excluir promoção "${p.id}" permanentemente`,
  },

  {
    name: "delete_personality",
    displayName: "Excluir Personalidade",
    description: "Remove uma personalidade do clube. Aceita ID ou nome.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome da personalidade" },
      },
      required: ["id"],
    },
    confirmationLevel: "danger",
    formatConfirmation: (p) => `Excluir personalidade "${p.id}"`,
  },

  // ─── HISTÓRIA ────────────────────────────────────────────────────────────────
  {
    name: "list_history_events",
    displayName: "Listar Linha do Tempo",
    description: "Lista todos os eventos da linha do tempo da história do clube, em ordem.",
    parameters: { type: "object", properties: {} },
    confirmationLevel: "auto",
    formatConfirmation: () => "Listar eventos da linha do tempo",
  },
  {
    name: "create_history_event",
    displayName: "Criar Evento Histórico",
    description: "Cria um evento na linha do tempo da história do clube. Gere título e descrição automaticamente se não fornecidos.",
    parameters: {
      type: "object",
      properties: {
        year: { type: "number", description: "Ano do evento (ex: 1993)" },
        title: { type: "string", description: "Título do evento (gere automaticamente se não fornecido)" },
        description: { type: "string", description: "Descrição do evento (gere automaticamente se não fornecido)" },
        order: { type: "number", description: "Posição na linha do tempo (opcional — será colocado ao final por padrão)" },
      },
      required: ["year", "title"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Criar evento histórico ${p.year}: "${p.title}"`,
  },
  {
    name: "update_history_event",
    displayName: "Atualizar Evento Histórico",
    description: "Atualiza um evento da linha do tempo. Aceita ID ou trecho do título.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou trecho do título do evento" },
        year: { type: "number" },
        title: { type: "string" },
        description: { type: "string" },
      },
      required: ["id"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Atualizar evento histórico "${p.id}"`,
  },
  {
    name: "delete_history_event",
    displayName: "Excluir Evento Histórico",
    description: "Exclui permanentemente um evento da linha do tempo. Aceita ID ou trecho do título.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou trecho do título do evento" },
      },
      required: ["id"],
    },
    confirmationLevel: "danger",
    formatConfirmation: (p) => `Excluir evento histórico "${p.id}" permanentemente`,
  },

  // ─── AFILIADOS ────────────────────────────────────────────────────────────────
  {
    name: "list_affiliates",
    displayName: "Listar Afiliados",
    description: "Lista todos os afiliados cadastrados com stats de indicações e comissões.",
    parameters: { type: "object", properties: {} },
    confirmationLevel: "auto",
    formatConfirmation: () => "Listar afiliados",
  },
  {
    name: "create_affiliate",
    displayName: "Criar Afiliado",
    description:
      "Cadastra um novo afiliado que recebe comissão por indicar clientes via link (?ref=CODE). " +
      "commissionType: 'pct' (percentual sobre o pedido) ou 'fixed' (valor fixo em reais por venda). " +
      "O código é gerado automaticamente se não informado.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome do afiliado" },
        email: { type: "string", description: "E-mail do afiliado" },
        whatsapp: { type: "string", description: "WhatsApp do afiliado (opcional)" },
        code: { type: "string", description: "Código de indicação único (4-20 alfanumérico). Gerado automaticamente se omitido." },
        commissionType: { type: "string", enum: ["pct", "fixed"], description: "'pct' percentual sobre o pedido, 'fixed' valor fixo em reais" },
        commissionValue: { type: "number", description: "Valor: percentual (ex: 10 para 10%) ou reais (ex: 5.00 para R$5,00)" },
        active: { type: "boolean", description: "Ativar imediatamente (padrão: true)" },
      },
      required: ["name", "email", "commissionType", "commissionValue"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => {
      const commission = p.commissionType === "pct" ? `${p.commissionValue}%` : brl(p.commissionValue);
      return `Criar afiliado "${p.name}" — comissão ${commission} por venda`;
    },
  },
  {
    name: "update_affiliate",
    displayName: "Editar Afiliado",
    description: "Atualiza dados de um afiliado. Aceita ID, e-mail ou nome.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID, e-mail ou nome do afiliado" },
        name: { type: "string" },
        email: { type: "string" },
        whatsapp: { type: "string" },
        code: { type: "string" },
        commissionType: { type: "string", enum: ["pct", "fixed"] },
        commissionValue: { type: "number" },
        active: { type: "boolean" },
      },
      required: ["id"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Editar afiliado "${p.id}"`,
  },
  {
    name: "delete_affiliate",
    displayName: "Excluir Afiliado",
    description: "Exclui permanentemente um afiliado e suas indicações.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID, e-mail ou nome do afiliado" },
      },
      required: ["id"],
    },
    confirmationLevel: "danger",
    formatConfirmation: (p) => `Excluir afiliado "${p.id}" permanentemente`,
  },
  {
    name: "list_affiliate_referrals",
    displayName: "Listar Indicações de Afiliado",
    description: "Lista as indicações (referrals) de um afiliado específico ou de todos, com comissões e status.",
    parameters: {
      type: "object",
      properties: {
        affiliateId: { type: "string", description: "ID, nome ou e-mail do afiliado (omitir = todos)" },
      },
    },
    confirmationLevel: "auto",
    formatConfirmation: (p) => `Listar indicações${p.affiliateId ? ` de "${p.affiliateId}"` : ""}`,
  },
  {
    name: "mark_referrals_paid",
    displayName: "Marcar Comissões como Pagas",
    description: "Marca comissões pendentes de um afiliado como pagas. Informe o nome/e-mail do afiliado.",
    parameters: {
      type: "object",
      properties: {
        affiliateId: { type: "string", description: "ID, nome ou e-mail do afiliado" },
      },
      required: ["affiliateId"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Marcar comissões pendentes de "${p.affiliateId}" como pagas`,
  },

  // ─── SÓCIO-TORCEDOR ──────────────────────────────────────────────────────────
  {
    name: "list_membership_plans",
    displayName: "Listar Planos Sócio-Torcedor",
    description: "Lista os planos de sócio-torcedor cadastrados com preços e descontos.",
    parameters: { type: "object", properties: {} },
    confirmationLevel: "auto",
    formatConfirmation: () => "Listar planos sócio-torcedor",
  },
  {
    name: "create_membership_plan",
    displayName: "Criar Plano Sócio-Torcedor",
    description:
      "Cria um novo plano de sócio-torcedor. icon: emoji representativo (ex: '⭐', '🏆', '💎'). " +
      "ticketDiscountPct: desconto em % nos ingressos. productDiscountPct: desconto em % na loja.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome do plano (ex: Plano Prata)" },
        icon: { type: "string", description: "Emoji ícone do plano (ex: ⭐)" },
        description: { type: "string", description: "Descrição do plano" },
        priceBRL: { type: "number", description: "Mensalidade em reais" },
        ticketDiscountPct: { type: "number", description: "Desconto em % nos ingressos (ex: 10 para 10%)" },
        productDiscountPct: { type: "number", description: "Desconto em % na loja (ex: 5 para 5%)" },
        highlight: { type: "boolean", description: "Destacar este plano como o mais popular?" },
        active: { type: "boolean", description: "Publicar imediatamente (padrão: true)" },
      },
      required: ["name", "icon", "priceBRL", "ticketDiscountPct", "productDiscountPct"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Criar plano "${p.name}" — ${brl(p.priceBRL)}/mês`,
  },
  {
    name: "update_membership_plan",
    displayName: "Editar Plano Sócio-Torcedor",
    description: "Atualiza dados de um plano de sócio. Aceita ID ou nome do plano.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome do plano" },
        name: { type: "string" },
        icon: { type: "string" },
        description: { type: "string" },
        priceBRL: { type: "number" },
        ticketDiscountPct: { type: "number" },
        productDiscountPct: { type: "number" },
        highlight: { type: "boolean" },
        active: { type: "boolean" },
      },
      required: ["id"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Editar plano "${p.id}"`,
  },
  {
    name: "toggle_membership_plan_active",
    displayName: "Ativar/Desativar Plano Sócio",
    description: "Ativa ou desativa um plano de sócio-torcedor. Aceita ID ou nome.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome do plano" },
        active: { type: "boolean" },
      },
      required: ["id", "active"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `${p.active ? "Ativar" : "Desativar"} plano "${p.id}"`,
  },
  {
    name: "delete_membership_plan",
    displayName: "Excluir Plano Sócio",
    description: "Exclui permanentemente um plano de sócio-torcedor.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome do plano" },
      },
      required: ["id"],
    },
    confirmationLevel: "danger",
    formatConfirmation: (p) => `Excluir plano "${p.id}" permanentemente`,
  },
  {
    name: "list_members",
    displayName: "Listar Sócios",
    description: "Lista os sócios-torcedores cadastrados com filtros por status e plano.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "active", "cancelled"], description: "Filtrar por status" },
        search: { type: "string", description: "Buscar por nome ou e-mail" },
        limit: { type: "number", description: "Número de resultados (padrão: 20)" },
      },
    },
    confirmationLevel: "auto",
    formatConfirmation: (p) => `Listar sócios${p.status ? ` (${p.status})` : ""}`,
  },
  {
    name: "activate_member",
    displayName: "Ativar Sócio",
    description: "Ativa manualmente um sócio-torcedor pelo ID ou nome.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome do sócio" },
      },
      required: ["id"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Ativar sócio "${p.id}"`,
  },
  {
    name: "cancel_member",
    displayName: "Cancelar Sócio",
    description: "Cancela a associação de um sócio-torcedor.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome do sócio" },
      },
      required: ["id"],
    },
    confirmationLevel: "danger",
    formatConfirmation: (p) => `Cancelar associação do sócio "${p.id}"`,
  },

  // ─── PERSONALIDADES ───────────────────────────────────────────────────────────
  {
    name: "list_personalities",
    displayName: "Listar Personalidades",
    description: "Lista as personalidades do clube (médicos, dirigentes, técnicos, voluntários).",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["medicos", "dirigentes", "tecnicos", "voluntarios"] },
      },
    },
    confirmationLevel: "auto",
    formatConfirmation: () => "Listar personalidades",
  },
  {
    name: "create_personality",
    displayName: "Cadastrar Personalidade",
    description: "Cadastra uma personalidade do clube. category: 'medicos','dirigentes','tecnicos','voluntarios'. photoUrl: use a imagem anexada se houver.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome da personalidade" },
        role: { type: "string", description: "Função ou título" },
        category: { type: "string", enum: ["medicos", "dirigentes", "tecnicos", "voluntarios"] },
        photoUrl: { type: "string", description: "URL da foto (use imagem anexada se houver)" },
        active: { type: "boolean" },
      },
      required: ["name", "category"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Cadastrar personalidade "${p.name}" (${p.category})`,
  },
  {
    name: "update_personality",
    displayName: "Atualizar Personalidade",
    description: "Atualiza dados de uma personalidade. Aceita ID ou nome.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ou nome da personalidade" },
        name: { type: "string" },
        role: { type: "string" },
        category: { type: "string", enum: ["medicos", "dirigentes", "tecnicos", "voluntarios"] },
        photoUrl: { type: "string", description: "Nova URL da foto (use imagem anexada se houver)" },
        active: { type: "boolean" },
      },
      required: ["id"],
    },
    confirmationLevel: "preview",
    formatConfirmation: (p) => `Atualizar personalidade "${p.id}"`,
  },
];

export function getToolsForAI(): AgentTool[] {
  return tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
}

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return tools.find((t) => t.name === name);
}
