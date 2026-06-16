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

## ⚠️ AÇÃO PENDENTE — Migrations não aplicadas

**As migrations `0010` e `0011` foram geradas mas NÃO foram aplicadas ao DB.** O comando `npm run db:migrate` trava no ambiente da ferramenta (timeout WebSocket Neon). O usuário precisa rodar no terminal local:

```bash
npm run db:migrate
```

Isso aplicará em sequência:
- `0010_long_thing.sql` — adiciona `coming_soon boolean` em `products`, cria tabela `product_waitlist`
- `0011_shiny_unus.sql` — adiciona `order integer DEFAULT 0` em `products`

Sem essas migrations aplicadas, as features de "Em Breve" e ordenação de produtos quebrarão em produção.

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

## Features entregues nesta sessão

### Gateway Asaas — correções

- **Sandbox routing**: `credentials.sandbox === true || credentials.sandbox === "true"` — `String(false) = "false"` é truthy
- **Cache invalidação**: `revalidateTag("payment_gateway", { expire: 0 })` em `createGateway`/`updateGateway` em `admin.ts`
- **Cartão de crédito server-side**: `POST /creditCard/tokenize` → `POST /payments` com `creditCardToken` (sem SDK browser)
- **PIX**: requer `cpfCnpj` no customer; campo CPF adicionado no step de pagamento quando gateway é Asaas
- **Reembolso**: `refundOrder` usa `getPaymentGatewayBySlug(paymentRow.gatewaySlug)` em vez do gateway ativo
- **Erros amigáveis**: mensagens pt-BR em `refundOrder` (404 → "Pagamento não encontrado", 403 → "Sem permissão", etc.)

**Arquivos-chave**: `src/lib/payment/asaas.ts`, `src/lib/payment/index.ts`, `src/app/actions/admin.ts`, `src/components/checkout/steps/PaymentMethodStep.tsx`

---

### Formulário de Elenco

- **RG / CIN**: `fmtRG()` com máscara progressiva `XX.XXX.XXX-D`, aceita dígitos + X (padrão CIN)
- **Salário**: `fmtSalary()` com máscara BRL centavos → `R$ 1.234,56`
- **Tela de sucesso persistente**: estado `submitted` no componente raiz + `localStorage("athlete_form_submitted", "1")` → após reload mantém na tela de sucesso sem pedir código de acesso novamente
- **Fade-in**: `SuccessScreen` começa em `opacity-0`, transita para `opacity-100` em 700ms

**Arquivo**: `src/components/elenco/AthleteApplicationForm.tsx`

---

### Meus Pedidos — Abas por status

4 abas com contador de pedidos: **Todos · Aguardando · Pagos · Histórico**
- "Aguardando" = `pending` com PIX ainda ativo
- "Histórico" = `pending` expirado + `refunded`
- Ordenação mantida: pagos primeiro, aguardando, reembolsados, expirados

**Arquivo**: `src/app/(site)/pedidos/page.tsx`

---

### Ingressos por jogo

Quando há **múltiplos jogos** futuros cadastrados e nenhum é pré-selecionado, `/ingresso` exibe listagem de cards (um por jogo) com data, local, preços e botão "Comprar Ingresso" → `?jogo=id`. Ao clicar, o `CheckoutWizard` recebe `initialGameId` e pula a seleção de jogo.

Com 1 jogo ou `?jogo=id` na URL: comportamento antigo (wizard direto).

**Arquivo**: `src/app/(site)/ingresso/page.tsx`

---

### Loja — "Em Breve" + Lista de espera

**Schema** (⚠️ migration 0010 pendente):
- `products.coming_soon boolean DEFAULT false`
- tabela `product_waitlist(id, product_id FK, name, email, whatsapp, created_at)`

**Admin**: checkbox "Em Breve" no `ProductForm` → `createProduct`/`updateProduct` persistem o campo

**Loja pública** (`ShopProductCard`):
- Badge "Em Breve" centralizado sobre imagem desfocada
- Botão "Avise-me" abre form inline (nome, e-mail, WhatsApp)
- Submit chama `joinWaitlist` (server action com deduplicação por email+produto)
- Estado de sucesso após cadastro na lista

**Actions**: `src/app/actions/waitlist.ts` — `joinWaitlist()`

---

### Loja — Ordenação drag-and-drop no admin

**Schema** (⚠️ migration 0011 pendente): `products.order integer DEFAULT 0`

**Admin** (`BulkProductsGrid.tsx` — agora `"use client"`):
- Barra de arraste no topo de cada card com ícone grip e número de posição
- Native HTML5 DnD — arrastar para reordenar, salva ao soltar
- Feedback "Salvando..." / "Ordem salva" com ícone
- `reorderProducts()` server action atualiza `order` de cada produto

**Query**: `getActiveProducts()` ordena por `order ASC, createdAt ASC`

---

### Loja — Cards de produto

- **Imagem completa**: `object-contain` + `p-2` + `h-52` — sem corte, produto aparece inteiro
- **Botão alinhado**: `article` é `flex flex-col`, body é `flex-col flex-1`, botão sempre no rodapé independente de ter variação de cor ou não

---

### Upload de imagem — validação de proporção

`ImageUpload` aceita prop `aspectRatio?: string` (ex: `"1:1"`).

Ao selecionar arquivo, lê dimensões via `new Image()` antes de fazer upload. Se a proporção não bater (tolerância 5%), rejeita com mensagem mostrando as dimensões reais (ex: *"Proporção incorreta: sua imagem é 1200×800 px."*).

Ativado com `aspectRatio="1:1"` em:
- Imagem principal do produto (`ProductForm`)
- Imagem de variante de cor (`ProductForm`)

Preview do campo vira quadrado `w-24 h-24` quando `aspectRatio="1:1"`.

**Arquivo**: `src/components/admin/ImageUpload.tsx`

---

## Imagens de produto — especificações

- **Proporção obrigatória**: 1:1 (quadrado)
- **Dimensões recomendadas**: 1000×1000 px
- **Formato**: PNG com fundo transparente (ideal) ou JPG/WebP com fundo escuro (#111)
- **Arquivo**: ≤ 300 KB (JPG/WebP) ou ≤ 500 KB (PNG)
- **Produto deve ocupar**: 80–90% do espaço da imagem, centralizado

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
