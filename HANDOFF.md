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
| Testes | Vitest 4.1.8 — `npx vitest run` — 45 testes passando |

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
| `sponsors` | `SponsorsSection` → `SponsorsMarquee` | Marquee infinito 2 linhas |
| `shop` | `ShopSection` | Produtos com badge promoção + flash sale banner |

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

**Tools implementadas**: cupons, upsells, pedidos, jogos, configurações, clientes, leads, notícias, produtos, jogadores, patrocinadores, diretoria, lendas, personalidades, dashboard.

**Quirks do executor (`executor.ts`)**:
- `getAdminNews` não aceita `limit` — só `{ page, category?, search? }`
- `getAdminPersonalities` aceita string direta `(category?: string)`, não objeto
- `createLegend` e `createPersonality` não retornam `id` → `adminPath` aponta para lista
- Resolução nome→ID: `.find((r) => r.name.toLowerCase().includes(...))`
- `create_upsell_offer`: auto-busca `originalPriceCents` do `getSiteConfig()` ou `getAdminProducts()`

**Regras críticas do system prompt**:
- Escopo estrito: recusa qualquer pergunta fora do painel
- Anti-injection: ignora "ignore as regras anteriores"
- Summary de notícias: máximo 2-3 frases / 60 palavras
- Backticks dentro do template literal causam erro Turbopack — usar aspas simples no texto das regras

---

## O que está concluído e commitado

- Landing page completa (todas as seções com dados do DB)
- CMS: `force-dynamic`, sem cache, seções ativáveis/reordenáveis pelo DB
- Marquees CSS puro (lendas + patrocinadores) com loop seamless
- Checkout de ingressos e produtos (Asaas + Mercado Pago)
- Sistema de cupons (pct/fixed, por-cliente, validade, escopo)
- Upsells no checkout (trigger-based, timer, desconto %)
- Leads multi-source com honeypot
- Admin panel completo: pedidos, cupons, loja, jogos, notícias, elenco, diretoria, lendas, personalidades, patrocinadores, clientes, usuários, auditoria, upsell, configurações
- AI Admin Assistant com todas as tools implementadas
- Upload de imagem no chat (Cloudinary) para criar itens com foto via IA
- **① Sócio-Torcedor** ✅ (commit `e9aaa44` + `5b3094b`)
- **② Descontos & Promoções** ✅ (commit `eb49596`)

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
| `drizzle-kit migrate` em CLI | Timeout/hang pelo WebSocket do Neon — usar script HTTP direto |
| `import { requireAdminSession } from "@/lib/admin-auth"` | Módulo não existe — auth é no layout, não nas actions |

---

## ✅ Sócio-Torcedor (feature ① — ENTREGUE — commits e9aaa44 + 5b3094b)

### O que foi implementado

**Testes** (`src/lib/membership/utils.test.ts` + `src/lib/payment/subscription.test.ts` — 26 testes):
- CPF: `validateCPF`, `normalizeCPF`, `formatCPF`
- Desconto: `computeMemberDiscount` (pct, cap 100%, base 0)
- Token: `generateMemberCardToken` (UUID único)
- Telefone: `normalizePhone`
- MockSubscriptionClient: imediato, uniqueness, cancelar

**Schema** (`src/lib/db/schema/membership.ts`) — colunas adicionadas:
- `membershipPlans`: `+description`, `+ticketDiscountPct`, `+productDiscountPct`
- `members`: `+cpf`, `+gatewaySlug`, `+gatewayCustomerId`, `+asaasCustomerId` (backward compat), `+subscriptionId`, `+nextBillingDate`, `+cancelledAt`, `+memberCardToken`
- Migração aplicada via `scripts/apply-membership-migration.ts` + `scripts/apply-membership-migration-v2.ts` (Neon HTTP)

**Abstração de gateway para subscriptions** (`src/lib/payment/subscription-types.ts`):
- Interface `SubscriptionGateway` com `createSubscription`, `cancelSubscription`, `getSubscriptionStatus`
- `SubscriptionCreateResult.paymentMethod`: `"pix"` | `"redirect"` | `"immediate"`
- `AsaasSubscriptionClient` → PIX QR (`pixQrCode`, `pixQrCodeUrl`)
- `MercadoPagoSubscriptionClient` → Preapproval API, retorna `initPoint` (redirect URL)
- `MockSubscriptionClient` → ativa imediatamente (sem etapa de pagamento)
- `getSubscriptionGateway()` — factory que detecta gateway ativo do DB

**Server actions** (`src/app/actions/membership.ts`):
- `getPublicMembershipPlans()` — planos ativos com benefícios
- `signupMember(input)` — valida CPF, cria membro, detecta gateway, retorna `paymentMethod` + dados da etapa de pagamento
- `getMemberDiscountForEmail(email)` — retorna desconto do plano para membros ativos
- `getMemberByCardToken(token)` — lookup de carteirinha por token
- `activateMemberBySubscription(subscriptionId)` / `cancelMemberBySubscription(subscriptionId)` — webhook handlers
- `activateMemberById(memberId)` — ativação manual admin

**Webhooks**:
- `src/app/api/webhooks/asaas/route.ts` — `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` → ativa; `SUBSCRIPTION_CANCELLED` → cancela
- `src/app/api/webhooks/mercadopago/route.ts` — `subscription_preapproval` com status `authorized` → ativa; `cancelled`/`paused` → cancela

**Auto-desconto no checkout** (`src/app/actions/checkout.ts`):
- Ticket checkout: aplica `ticketDiscountPct` do plano sobre `ticketsCents`
- Product checkout: aplica `productDiscountPct` do plano sobre `itemsCents`
- Item negativo: `{ isMemberDiscount: true, planName }`

**Páginas públicas**:
- `MembershipSection.tsx` — async, busca planos do DB
- `/socios/adesao` — wizard 4 passos; etapa pagamento detecta pix/redirect/immediate
- `/socios/carteirinha?token=UUID` — carteirinha digital com QR Code
- `/socios/carteirinha?id=memberId` — acesso por memberId após cadastro

**Admin** (`/admin/socios`): form com `description`, `ticketDiscountPct`, `productDiscountPct`

---

## ✅ Descontos & Promoções (feature ② — ENTREGUE — commit eb49596)

### O que foi implementado

**Testes** (`src/lib/promotions/utils.test.ts` — 19 testes):
- `isPromotionActive` (datas, flag active, fronteiras exatas)
- `computePromotionDiscount` pct e fixed (cap 100%, minOrderCents, stacking)
- `isFlashSale`, `flashSaleRemainingMs`

**Schema** — novos campos/tabela:
- `products`: `+salePriceCents` (integer, nullable), `+saleEndsAt` (timestamptz, nullable)
- Tabela `promotions`: `id`, `name`, `description`, `discountType` (pct|fixed), `discountValue`, `appliesTo` (all|tickets|products), `minOrderCents`, `startsAt`, `endsAt`, `active`, `flashSale`
- Migração aplicada via `scripts/apply-promotions-migration.ts` (Neon HTTP)

**Lógica pura** (`src/lib/promotions/utils.ts`):
- `isPromotionActive(promo, now?)` — verifica `active`, `startsAt ≤ now ≤ endsAt`
- `computePromotionDiscount(subtotalCents, promo)` — pct (cap 100%) ou fixed (min subtotal), respeita `minOrderCents`
- `isFlashSale(promo, now?)`, `flashSaleRemainingMs(endsAt, now?)`

**Server actions públicas** (`src/app/actions/promotions.ts`):
- `getActivePromotion(appliesTo, subtotalCents)` — melhor promoção ativa para o tipo + valor (ORDER BY discountValue DESC)
- `getActiveFlashSale(appliesTo)` — flash sale ativa para o banner da loja

**Admin CRUD** (`src/app/actions/admin-promotions.ts`):
- `getAdminPromotions`, `getAdminPromotion`, `createPromotion`, `updatePromotion`, `deletePromotion`, `togglePromotionActive`

**Admin pages** (`/admin/promocoes`):
- Listagem com status (Ativa / Agendada / Inativa / Expirada), botão ativar/pausar
- `/admin/promocoes/novo` e `/admin/promocoes/[id]` — `PromotionForm.tsx`
- Item "Promoções" adicionado ao sidebar (`AdminSidebar.tsx`)

**Checkout** (`src/app/actions/checkout.ts`):
- `createOrder` (ingressos): após cupom + sócio-desconto, busca promoção de `tickets` → item negativo `{ isPromotion: true, promotionId, promotionName }`
- `createProductOrder` (loja): idem com `products`
- Ordem: subtotal → (-coupon) → (-memberDiscount) → (-promotion) = total (mínimo 0)

**UI pública**:
- `ShopProductCard.tsx`: badge vermelho "Promoção" + preço riscado quando `onSale=true`
- `FlashSaleBanner.tsx`: componente client com countdown regressivo em `hh:mm:ss`
- `ShopSection.tsx`: busca flash sale ativa, exibe banner acima dos produtos
- `src/app/(site)/loja/[slug]/page.tsx`: preço promocional com badge na página de produto

**Admin Loja** (`ProductForm.tsx`): campos `salePriceCents` e `saleEndsAt` adicionados ao form de produto.

---

## Roadmap de Features Pendentes

### ① Sócio-Torcedor ✅ ENTREGUE

### ② Descontos & Promoções ✅ ENTREGUE

### ③ Afiliados (PRÓXIMO — construir do zero)

**Schema a criar**:
```sql
affiliates: id, name, email, whatsapp, code (único slug), commissionType (pct|fixed), commissionValue, active, createdAt
affiliateReferrals: id, affiliateId, orderId, commissionCents, status (pending|paid|cancelled), createdAt
```

**O que construir**:
- Migração via Neon HTTP (mesmo padrão de `scripts/apply-*.ts`)
- Rastreamento: `?ref=CODE` → cookie 30 dias → lido no checkout → `affiliateCode` salvo no pedido
- `orders` precisa de coluna `affiliateCode text` (nova migração)
- Comissão calculada quando `order.status` muda para `paid` (no webhook ou `checkPaymentStatus`)
- Admin `/admin/afiliados`:
  - CRUD de afiliados (name, email, whatsapp, code, commissionType, commissionValue, active)
  - Dashboard: comissões pendentes/pagas por afiliado, receita gerada
  - Marcar comissões como pagas (em lote)
- Portal do afiliado (`/afiliados/[code]`): página pública com link de referral, métricas básicas (cliques, conversões, comissões)
- Lógica pura + testes: geração de código, cálculo de comissão
- Híbrido opcional: código do afiliado pode funcionar como cupom (comprador ganha desconto + afiliado ganha comissão)

**Convenções importantes**:
- Padrão de ação do admin: inline server components (sem `requireAdminSession` — auth é no layout)
- Padrão de migração: `neon()` HTTP com `IF NOT EXISTS` em `scripts/apply-*.ts`
- Testes em `src/lib/<domínio>/utils.test.ts` com Vitest + node env
- Build sempre antes de commit: `npx next build`

---

### ④ Multi-tenancy (fazer por último — maior risco)

**Cross-cutting** — afeta cada tabela e cada query do sistema.

> **Recomendação**: implementar quando houver pelo menos 2 clientes confirmados. Antes disso, usar deployments separados (uma instância por clube) para validar o produto sem o custo de migração.

**Fase 1 — Fundação**:
- Tabela `organizations`: id, name, slug, domain, logoUrl, primaryColor, active
- Adicionar `organizationId` FK em **todas** as tabelas de dados
- Middleware Next.js: resolve tenant por subdomínio ou domínio customizado
- Todas as queries recebem `organizationId` como filtro obrigatório
- Auth admin escopado: usuário pertence a uma organização

**Fase 2 — Operações**:
- Super-admin separado: gerenciar tenants, métricas, billing
- Onboarding self-service de novo clube
- Branding por tenant via `siteConfig` escopado

**Fase 3 — Escala**:
- Domínios customizados com SSL automático (Vercel Domains API)
- White-label completo
- API pública com chaves por tenant
