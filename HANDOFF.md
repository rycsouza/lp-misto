# Handoff — Misto Esporte Clube — Plataforma SaaS

## Visão Geral

Landing page + painel admin completo do Misto EC (Next.js 16.2.9 App Router) com CMS via DB (Neon/Drizzle). Todo conteúdo vem do DB e reflete imediatamente sem deploy. Seções podem ser ativadas/desativadas e reordenadas via `site_config`.

**Objetivo final**: transformar o sistema em uma plataforma SaaS multi-tenant comercializável para clubes de futebol e organizações esportivas brasileiras.

---

## Stack

| Peça | Detalhe |
|---|---|
| Framework | Next.js 16.2.9 (App Router, `force-dynamic`) |
| DB | Neon Postgres via Drizzle ORM |
| Seed | `npx tsx src/lib/db/seed.ts` — **NÃO RODAR** (usuário edita DB diretamente) |
| CSS | Tailwind v4 + CSS custom properties |
| Fonts | Bebas Neue (títulos) + Geist (corpo) |
| Package manager | **npm** (não bun) |
| Dev | `npm run dev` |
| AI Assistant | Claude claude-sonnet-4-6 via @anthropic-ai/sdk, tool-use pattern |
| Pagamentos | Asaas (PIX), Mercado Pago (PIX + cartão), Mock (dev) |
| Upload | Cloudinary via `/api/upload` |
| Testes | Vitest 4.1.8 — `npx vitest run` — **61 testes passando** |
| Middleware | `src/proxy.ts` (não `middleware.ts` — este Next.js usa `proxy`) |

---

## ✅ Migrations — todas aplicadas (2026-06-21)

- `0010` — `coming_soon boolean` em `products`, tabela `product_waitlist`
- `0011` — `order integer DEFAULT 0` em `products`
- `0012` — `ticket_price_inteira_cents`, `ticket_price_meia_cents`, `meia_eligibility_label` em `games`
- `0013` — tabelas `ticket_types` e `tickets`
- `0014` — `combo_tiers jsonb` em `ticket_types`
- SQL avulso: `ALTER TABLE products ADD COLUMN limited_stock boolean NOT NULL DEFAULT false`
- SQL avulso: `ALTER TABLE customers ADD COLUMN addresses jsonb DEFAULT '[]'`
- SQL avulso: `ALTER TABLE products ADD COLUMN requires_shipping boolean NOT NULL DEFAULT true`
- SQL avulso (dimensões frete): `ALTER TABLE products ADD COLUMN weight_grams integer, ADD COLUMN width_cm integer, ADD COLUMN height_cm integer, ADD COLUMN length_cm integer`
- SQL avulso (pedido c/ frete): `ALTER TABLE orders ADD COLUMN shipping_address jsonb, ADD COLUMN shipping_cost_cents integer, ADD COLUMN shipping_service_name text`

> ⚠️ Nunca rodar `npm run db:migrate` via ferramenta — trava por timeout WebSocket Neon. Sempre via terminal local ou console Neon.

---

## O que NÃO funcionou (não repetir)

| Abordagem | Problema |
|---|---|
| Framer Motion marquee | JS-driven → snap/reset visível ao loopar |
| 3× cópias + `-50%` keyframe | -50% de 3W = -1.5W → salto visível |
| `unstable_cache` em `getAllSiteConfig` | TTL 5min → mudança no DB não refletia |
| ISR / sem `force-dynamic` | Página pré-renderizada → seções não apareciam |
| `next/image` com `remotePatterns` específicos | URLs no DB falhavam sem deploy |
| Backticks no template literal do system prompt | Turbopack: `Expected ']', got 'ident'` |
| Passar `limit` para `getAdminNews` | Parâmetro não existe — erro TypeScript |
| `getAdminPersonalities({ category })` | Assinatura é `(category?: string)` — não objeto |
| `drizzle-kit migrate` via ferramenta | Timeout/hang pelo WebSocket do Neon — **sempre rodar no terminal local** |
| `import { requireAdminSession } from "@/lib/admin-auth"` | Módulo não existe — auth é no layout, não nas actions |
| `src/middleware.ts` | Este Next.js usa `src/proxy.ts` — ter ambos gera build error |
| `revalidateTag("tag")` com 1 argumento | Next.js 16 exige 2 args: `revalidateTag("tag", { expire: 0 })` |
| Asaas sandbox check com `if (credentials.sandbox)` | String `"false"` é truthy → sempre ia pro sandbox. Verificar com `=== true \|\| === "true"` |
| `refundOrder` usando `getPaymentGateway()` | Usava o gateway ativo, não o que processou a compra — usar `getPaymentGatewayBySlug(paymentRow.gatewaySlug)` |
| `flex` com text nodes soltos dentro de `<p>` | Desalinha no mobile — usar `<span>` para estilizar partes do texto, sem `flex` no elemento `<p>` pai |
| Passar `buildUrl` como prop de Server → Client Component | Funções não são serializáveis no App Router → crash. Definir `buildUrl` dentro do Client Component e passar apenas props primitivas |
| `db.transaction(...)` no driver neon-http | `No transactions support in neon-http driver` — usar `delete` + `insert` sequenciais (ex: `saveTicketTypes`) |
| Classes Tailwind interpoladas (`max-w-${var}`) | Não são geradas no build (purge estático) → classe inexistente em prod. Usar condicional com classes completas |
| `Permissions-Policy: camera=()` global | Bloqueia a câmera no site todo (validação não abria). Usar `camera=(self)` em `next.config.ts` |
| Setar `srcObject` do `<video>` antes de montar | Câmera "às vezes não abria" (Chrome) — anexar stream + loop de detecção num `useEffect([cameraActive])`, após o vídeo montar |
| `overflow-x:hidden` no body com `position:sticky` no conteúdo | Quebraria o sticky. OK neste projeto pois **não há sticky** (header/barra/drawer são `fixed`) |
| `export type` em arquivos server/client mistos (Turbopack) | Causa `ReferenceError` em tempo de execução com Turbopack — remover `export type` e usar `import type` só nos consumidores |
| `updateConfigValues` sem `CONFIG_KEY_TYPES` | Upsertava todas as chaves com `type = "string"` por padrão → `shippingEnabled = "false"` como string é truthy → toggle nunca desativava. Sempre setar `type` correto via mapa de tipos |
| Commitar só arquivos de UI e esquecer schema/actions | Build na Vercel falhou com 6 erros Turbopack — os 4 arquivos backend (`shipping.ts`, `config.ts`, `commerce.ts`, `customers.ts`) tinham sido modificados mas nunca foram `git add`/`git commit`. Sempre `git status` antes de commitar |

---

## Arquitetura de Seções (Landing Page)

`src/app/page.tsx` é `force-dynamic`. Ele chama `getAllSectionMeta()` → lê `section.<key>.enabled` e `section.<key>.order` da tabela `site_config` → renderiza seções ordenadas dinamicamente.

**Seções disponíveis** (todas em `src/components/sections/`):

| Chave DB | Componente | Observações |
|---|---|---|
| — | `HeroSection` | Sempre primeiro, sem order config |
| `ticket_highlight` | `TicketHighlight` | Próximo jogo em casa, link para /ingresso |
| `news` | `NewsSection` → `NewsTabs` | Featured card + grid, 3 por vez |
| `squad` | `SquadSection` | Jogadores por temporada |
| `board` | `BoardSection` | Diretoria com foto/cargo |
| `history` | `HistorySection` | Timeline + LegendsMarquee + Personalidades |
| `membership` | `MembershipSection` | Planos sócio — busca do DB, link para /socios/adesao |
| `sponsors` | `SponsorsSection` → `SponsorsMarqueeClient` | Tier `diamante` em grid destacado + outros em marquee |
| `shop` | `ShopSection` | Produtos com badge promoção + flash sale banner + badge "Em Breve" |

---

## Arquitetura do AI Admin Assistant

```
src/lib/agent/
├── system-prompt.ts     # buildSystemPrompt(currentPage?) — regras, escopo, formatação
├── tools.ts             # definições das tools para o Claude (parâmetros, descrições)
└── executor.ts          # implementações das tools (chama server actions do DB)

src/app/api/agent/
├── chat/route.ts        # POST — loop tool-use auto (leitura e preview)
└── execute/route.ts     # POST — executa ações confirmadas pelo usuário

src/components/admin/
└── AgentSlideOver.tsx   # UI do chat — slide-over lateral com upload de imagem
```

**Fluxo**: `auto` (leitura) roda direto no loop → `preview` (mutações) pede confirmação do usuário → `execute/route.ts` executa → `danger` idem com aviso vermelho.

---

## Features entregues nesta sessão (2026-06-21 — Frete, Patrocinadores Diamante, Order Summary)

> Trabalho na branch **`preview`**; usuário gerencia migrations e merges manualmente.
> **Git em 2026-06-21: tudo sincronizado** — commits `fa7b73c` (arquivos backend frete) + `080d0e5` (step visibility) em `origin/preview`. Nada pendente de push.

### Frete via Melhor Envio (API v2)

Fluxo completo de cálculo de frete integrado ao checkout de produtos.

**Infraestrutura**:
- `src/lib/shipping/types.ts` — `ShippingAddress`, `ShippingOption`, `CartItemForShipping`
- `src/app/actions/shipping.ts` — 5 server actions:
  - `lookupAddress(cep)` — busca dados do CEP via ViaCEP
  - `getCustomerAddresses(whatsapp)` — lê `customers.addresses` jsonb
  - `saveCustomerAddress(whatsapp, address)` — deduplicação por CEP+numero, máx 5, mais recente primeiro
  - `cartRequiresShipping(productIds)` — true se qualquer produto tem `requiresShipping !== false`
  - `getShippingOptions(toCep, cartItems, subtotalCents)` — chama Melhor Envio; prepend "Frete Grátis" quando `subtotalCents >= shippingFreeAboveCents`

**Configuração admin** (`src/components/admin/ConfigForm.tsx` — `ConfigFormShipping`):
- Toggle on/off frete globalmente (`shippingEnabled`)
- Campo CEP de origem (`shippingOriginCep`)
- Campo threshold frete grátis (`shippingFreeAboveCents`, em R$)

**Produto** (`src/components/admin/ProductForm.tsx`):
- Checkbox "Requer envio físico" (`requiresShipping`) — `defaultChecked={true}`
- Campos de dimensões: peso (g), largura, altura, comprimento (cm)

**Checkout** (`src/components/checkout/steps/ShippingStep.tsx`):
- Endereços salvos como cards selecionáveis antes do form de CEP
- Após calcular opções: checkbox "Salvar endereço para próximas compras"
- Opções de frete como radio buttons com preço e prazo

**Visibilidade do step** (`src/components/checkout/ProductCheckoutWizard.tsx`):
- `ALL_STEPS` / `STEPS_NO_SHIPPING` (objetos `{label, step}`)
- `visibleSteps = shippingEnabled ? ALL_STEPS : STEPS_NO_SHIPPING`
- `currentVisualIndex = visibleSteps.findIndex(s => s.step === state.step)`
- Quando frete desabilitado: BuyerInfo `onNext` → step 3; PaymentMethodStep `onBack` → step 1
- `cartRequiresShipping(productIds)` chamado dinamicamente para produtos sem frete

**Config type bug (crítico)**:
- `src/app/actions/admin.ts` tem `CONFIG_KEY_TYPES` mapa — `shippingEnabled: "boolean"`, `shippingFreeAboveCents: "number"`, etc.
- `updateConfigValues` seta `type` correto em ambos insert e `onConflictDoUpdate`

### Patrocinadores — Tier Diamante

`src/components/sections/SponsorsSection.tsx` reescrito:
- Sponsors com `tier === "diamante"` → grid estático destacado acima do marquee
- `DiamondSponsorCard`: `w-40 h-20 sm:w-44 sm:h-24`, `ring-1 ring-amber-400/50`, glow dourado, hover intensifica
- Label "✦ Diamante" com linhas gradiente amber
- Demais tiers no marquee abaixo com separador "Outros Parceiros"

### Order Summary no step de Pagamento

`src/components/checkout/steps/PaymentMethodStep.tsx`:
- Interfaces exportadas: `OrderSummaryItem`, `OrderSummary`
- `OrderSummaryCard` (componente inline): itens, subtotal, desconto combo, cupom, upsell, frete (Gift verde se grátis, Truck + preço se pago), total
- Prop `orderSummary?: OrderSummary` em `PaymentMethodStep`
- `ProductCheckoutWizard` e `CheckoutWizard` passam `orderSummary` via IIFE

---

## Features entregues em sessão anterior (2026-06-21 — Ingressos: tipos, QR, combos, fluxo)

> ⚠️ O branch **virou `main` sozinho várias vezes** entre comandos — SEMPRE checar `git branch --show-current` antes de commitar; commitar só na `preview`.

### N tipos de ingresso (Inteira/Meia/VIP…), por jogo e/ou global
- Tabelas em `src/lib/db/schema/tickets.ts`: `ticket_types` (code/name/description/priceCents/`combo_tiers` jsonb/sortOrder/active; `gameId null` = global) e `tickets` (1 por unidade; `id` = payload do QR; status `valid|validated|cancelled`).
- Resolução: `getTicketTypesForGames` (jogo → global → fallback legado) em `src/lib/tickets/resolve.ts`. Admin: `TicketTypesEditor`; `saveTicketTypes` faz replace-all (**delete + insert**, sem transação).

### 1 QR por ingresso + validação individual
- `ensureTicketsForOrder` gera 1 ticket/unidade (idempotente, só pago) — `src/lib/tickets/generate.ts`.
- `validateTicket` valida por `ticket.id` (fallback legado) — `src/app/actions/validations.ts`. Câmera: `BarcodeDetector` + fallback `jsqr`.

### Combo por tipo de ingresso
- `combo_tiers` = `[{games, pct}]` por tipo. `src/lib/promotions/bundle.ts`: `parseBundleTiers`, `computeBundleDiscount`, `computeCartCombo`.

### Fluxo de compra unificado
- Wizard 4 passos (`Ingressos · Dados · Pagamento · Conclusão`); jogo + ingressos no passo 0.
- Acordeão de jogos; combo em escada; barra flutuante mobile.

### Scroll horizontal mobile (fix)
- `overflow-x-hidden` no `<body>` (`src/app/layout.tsx`) — seguro pois não há `position:sticky`.

### Migrations aplicadas
- `0013` (ticket_types + tickets) e `0014` (`combo_tiers jsonb`).

---

## Features entregues em sessões anteriores (2026-06-17)

### E-mails — contatos dinâmicos
`src/lib/email.ts` lê `getSiteConfig()` para WhatsApp e e-mail nos rodapés dos e-mails transacionais.

### Vercel Speed Insights
`@vercel/speed-insights` instalado; `<SpeedInsights />` em `src/app/layout.tsx`.

### Admin — Detalhe do pedido com imagem e dados do item
`getAdminOrderDetail` busca imagem da variante/produto e dados do jogo. Interface `OrderItemRow` com `imageUrl` e `game`.
**Arquivos**: `src/app/actions/admin.ts`, `src/app/admin/(panel)/pedidos/[id]/page.tsx`

### Dashboard — Fonte menor no mobile
Cards de valor monetário: `text-lg sm:text-2xl`.
**Arquivo**: `src/app/admin/(panel)/dashboard/page.tsx`

### Crédito "Desenvolvido por Sport55"
Footer (`src/components/layout/Footer.tsx`) e painel admin (`src/app/admin/(panel)/layout.tsx`).

---

## Features entregues em sessões anteriores (anteriores a 2026-06-17)

### Informações de contato dinâmicas
`getSiteConfig()` centraliza WhatsApp/e-mail/Instagram; footer renderiza condicionalmente.

### "Estoque Limitado" — badge por produto
`limitedStock boolean` em `products`; badge vermelho no `ShopProductCard`.

### Gateway Asaas — correções
Sandbox routing, cartão server-side, PIX + CPF, reembolso por gateway original, erros pt-BR.
**Arquivos-chave**: `src/lib/payment/asaas.ts`, `src/lib/payment/index.ts`

### Formulário de Elenco
Máscara RG/CIN, máscara salário BRL, tela de sucesso persistente (localStorage).
**Arquivo**: `src/components/elenco/AthleteApplicationForm.tsx`

### Meus Pedidos — Abas por status
4 abas: Todos · Aguardando · Pagos · Histórico.
**Arquivo**: `src/app/(site)/pedidos/page.tsx`

### Ingressos por jogo
`/ingresso` com listagem de cards quando há múltiplos jogos.
**Arquivo**: `src/app/(site)/ingresso/page.tsx`

### Loja — "Em Breve" + Lista de espera
`coming_soon boolean`, tabela `product_waitlist`, `joinWaitlist` action.

### Loja — Ordenação drag-and-drop
`products.order integer`, HTML5 DnD em `BulkProductsGrid.tsx`, `reorderProducts()`.

### Loja — Cards de produto
`object-contain` + `p-2` + `h-52`; botão sempre no rodapé via flex-col.

### Upload — validação de proporção
`ImageUpload` com `aspectRatio?: string`; rejeita antes do upload se não bater.
**Arquivo**: `src/components/admin/ImageUpload.tsx`

---

## Imagens de produto — especificações

- **Proporção**: 1:1 (quadrado) — validada no upload
- **Dimensões**: 1000×1000 px recomendado
- **Formato**: PNG fundo transparente ou JPG/WebP fundo escuro (#111)
- **Arquivo**: ≤ 300 KB (JPG/WebP) ou ≤ 500 KB (PNG)

---

## ✅ Features anteriores entregues

### ① Sócio-Torcedor (commits e9aaa44 + 5b3094b)
Wizard de adesão, PIX/redirect/immediate por gateway, carteirinha digital com QR Code, desconto automático no checkout, webhooks Asaas + MP, e-mail de boas-vindas.

### ② Descontos & Promoções (commit eb49596)
Tabela `promotions`, flash sale com countdown, badge "Promoção" nos cards, preço riscado, integração checkout com item negativo.

### ③ Afiliados (commit 4602791)
Cookie `mec_ref` 30 dias no proxy, comissões por pedido pago, portal público `/afiliados/[code]`, admin com stats agregados.

### ⑤ Melhorias pré-multi-tenancy (commit 4d9a9fc)
Dashboard expandido (MRR, sócios, comissões pendentes), export CSV de sócios.

---

## Roadmap Pendente

### ④ Multi-tenancy (fazer por último — maior risco)

**Cross-cutting** — afeta cada tabela e cada query.

> **Recomendação**: implementar quando houver pelo menos 2 clientes confirmados. Antes disso, usar deployments separados.

**Fase 1** — `organizations` table, `organizationId` FK em todas as tabelas, middleware resolve tenant por subdomínio.

**Fase 2** — Super-admin separado, onboarding self-service, branding por tenant.

**Fase 3** — Domínios customizados SSL, white-label, API pública com chaves por tenant.
