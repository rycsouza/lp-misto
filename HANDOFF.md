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

## Features entregues nesta sessão (2026-06-21 — Ingressos: tipos, QR, combos, fluxo)

> Trabalho na branch **`preview`**; usuário gerencia migrations e merges manualmente.
> **Git em 2026-06-21: tudo sincronizado** — `main` e `origin/main` em `5e06b72`; `preview` e `origin/preview` em `846fe4e`. Nada pendente de push.
> ⚠️ Durante sessões anteriores o branch **virou `main` sozinho várias vezes** entre comandos — SEMPRE checar `git branch --show-current` antes de commitar; commitar só na `preview`.

### N tipos de ingresso (Inteira/Meia/VIP…), por jogo e/ou global
- Tabelas em `src/lib/db/schema/tickets.ts`: `ticket_types` (catálogo: code/name/description/priceCents/`combo_tiers` jsonb/sortOrder/active; `gameId null` = global) e `tickets` (1 por unidade; `id` = payload do QR; status `valid|validated|cancelled`).
- Resolução por escopo: `getTicketTypesForGames` (jogo → global → fallback legado) em `src/lib/tickets/resolve.ts`. Admin: `TicketTypesEditor`; `saveTicketTypes` faz replace-all por escopo (**delete + insert**, sem transação). Removida a seção legada de preços do `GameForm`.

### 1 QR por ingresso + validação individual
- `ensureTicketsForOrder` gera 1 ticket/unidade (idempotente, só pago) — `src/lib/tickets/generate.ts`. `/pedidos` mostra 1 QR por ingresso, status "QR já validado", e identificação do jogo (header + `GameBadge` com escudo via `order.clubLogoUrl`).
- `validateTicket` valida por `ticket.id` (fallback legado por pedido) — `src/app/actions/validations.ts`. Câmera: `BarcodeDetector` + fallback `jsqr`; `Permissions-Policy: camera=(self)`.

### Combo por tipo de ingresso (não global)
- Faixas configuráveis por tipo (`combo_tiers` = `[{games, pct}]`, nº de jogos editável). `src/lib/promotions/bundle.ts`: `parseBundleTiers`, `computeBundleDiscount`, `computeCartCombo` (agrupa por code, conta jogos distintos, aplica faixas). Removida a seção global "Combo de Jogos".

### Fluxo de compra unificado + UX (`CheckoutWizard.tsx` / `steps/TicketType.tsx`)
- **Tudo numa tela**: wizard 5→4 passos (`Ingressos · Dados · Pagamento · Conclusão`); jogo + ingressos no passo 0; deep-link `?jogo=id` destaca o jogo.
- **Acordeão de jogos**: só um aberto por vez; abre o destacado (senão o 1º com ingressos, senão o 1º); clicar em outro fecha os demais; cabeçalho mostra qtd/total ou "a partir de R$X" + chevron.
- **Combo em escada**: pílulas de todas as faixas (`2 jogos 10% OFF`…) com a atingida em destaque; total mostra `−R$X (Y% OFF)`. Sem emojis.
- **Barra flutuante mobile** (`sm:hidden fixed bottom-0`): total + desconto + "Continuar", respeita `safe-area`; desktop mantém inline.
- `GameSelect` ficou **órfão** após a unificação — limpeza opcional.

### Scroll horizontal leve no mobile (fix)
- Diagnóstico **rodando o app** a 375px e medindo `scrollWidth` vs `clientWidth` por rota (preview MCP): todas davam `docOverflow 0`; vazamentos só de elementos `fixed` fora da viewport (ex: `CartDrawer` com `translate-x-full`) — clássico do iOS Safari.
- Fix: `overflow-x-hidden` no `<body>` (`src/app/layout.tsx`) — cobre site e admin; seguro pois não há `position:sticky`; scrollers internos têm overflow próprio.

### Outros desta leva
- Preço de ingresso por jogo (fallback global) + label de "meia" configurável. ASAAS **não** envia e-mails (`notificationDisabled: true`). Relatório interativo em `/admin/relatorios`. Cupom persiste via cookie `mec_coupon` (30d) no `src/proxy.ts`. Upload do escudo do clube (`clubLogoUrl`) usado em todo o site.

### Migrations desta leva — **já aplicadas manualmente pelo usuário**
- `0013` (ticket_types + tickets) e `0014` (`ALTER TABLE "ticket_types" ADD COLUMN "combo_tiers" jsonb;`).

---

## Features entregues nesta sessão (2026-06-17 — continuação)

### E-mails — WhatsApp e e-mail de contato dinâmicos

Links de contato nos e-mails (`sendOrderConfirmation`, `sendMemberWelcomeEmail`) agora leem `getSiteConfig()` em vez de usar valores hardcoded. O link do WhatsApp (`wa.me/...`) só aparece se o número estiver configurado no painel admin. Mesmo para o e-mail de contato.

**Arquivos**: `src/lib/email.ts` — import de `getSiteConfig`, variáveis `contactWhatsapp`, `contactEmail`, `waLink`, composição condicional do `footerNote`.

---

### Vercel Speed Insights

Instalado `@vercel/speed-insights` e adicionado `<SpeedInsights />` no layout raiz ao lado do `<Analytics />` já existente.

**Arquivo**: `src/app/layout.tsx`

---

### Admin — Detalhe do pedido com imagem e dados do item

`getAdminOrderDetail` agora busca:
- Imagem da variante (`productVariants.colorImageUrl`) ou fallback da imagem do produto (`products.imageUrl`)
- Dados do jogo para itens de ingresso (`games.opponent`, `games.date`, `games.competition`)

Interface `OrderItemRow` ganhou campos `imageUrl: string | null` e `game: {...} | null`.

A page `/admin/pedidos/[id]/page.tsx` exibe:
- Thumbnail 40×40 (variante ou produto, fallback ícone Package/Ticket)
- Nome + cor + tamanho para produtos
- Adversário + competição + data + tipo (inteira/meia) para ingressos
- Mobile e desktop atualizados

**Arquivos**: `src/app/actions/admin.ts`, `src/app/admin/(panel)/pedidos/[id]/page.tsx`

---

### Dashboard — Fonte menor para valores monetários no mobile

Cards com valores monetários (`Receita Hoje`, `MRR Sócios`, `Comissões Pendentes`) usavam `text-2xl` que não cabia na grade 2-colunas do mobile. Corrigido para `text-lg sm:text-2xl`.

**Arquivo**: `src/app/admin/(panel)/dashboard/page.tsx`

---

### Crédito "Desenvolvido por Sport55"

Adicionado em dois lugares com o verde lima `#C6FF00` da identidade visual da Sport55 (CNPJ 49.791.388/0001-85):

- **Landing page footer** (`src/components/layout/Footer.tsx`): linha abaixo do copyright, texto simples com `<span>` para cor — sem `flex` no `<p>` para não quebrar no mobile
- **Painel admin** (`src/app/admin/(panel)/layout.tsx`): `<footer hidden md:flex>` no canto inferior direito, visível só no desktop (mobile tem nav bar)

**Importante**: não usar `flex` com text nodes soltos dentro de `<p>` — quebra alinhamento no mobile. Usar `<span>` apenas para estilizar partes do texto.

---

## Features entregues em sessões anteriores

### Informações de contato dinâmicas

WhatsApp, e-mail e Instagram gerenciados via painel admin (Configurações → Clube) e exibidos no footer e no checkout.

- `getSiteConfig()` centraliza leitura de `site_config`
- Footer (`src/components/layout/Footer.tsx`): renderiza contatos condicionalmente — se campo vazio no DB, item some
- Checkout (`src/app/(site)/checkout/produtos/page.tsx`): passa `whatsapp` de `getSiteConfig()` para `ProductCheckoutWizard`
- Newsletter removida do footer

**Ícone de e-mail**: lucide-react `<Mail size={16} className="shrink-0" />` funciona em server components — a classe `shrink-0` é obrigatória para o ícone não colapsar em containers flex com texto longo. SVG inline quebrava por problemas geométricos (sobreposição de strokes). Não substituir por SVG inline.

---

### "Estoque Limitado" — badge por produto

Flag booleana por produto, no padrão do `comingSoon`. Badge vermelho "ESTOQUE LIMITADO" exibido no card da loja.

**⚠️ SQL pendente** — o usuário precisa rodar manualmente:
```sql
ALTER TABLE products ADD COLUMN limited_stock boolean NOT NULL DEFAULT false;
```

**Arquivos alterados**:
- `src/lib/db/schema/commerce.ts` — campo `limitedStock: boolean("limited_stock").notNull().default(false)`
- `src/app/actions/admin-shop.ts` — interface `ProductRow`/`ProductInput`, select, create e update
- `src/components/admin/ProductForm.tsx` — checkbox "Estoque Limitado" abaixo do "Em Breve"
- `src/components/ui/ShopProductCard.tsx` — prop `lowStock`, badge absoluto (deslocado se `onSale`)
- `src/components/sections/ShopSection.tsx` — passa `lowStock={product.limitedStock}` ao card

---

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
