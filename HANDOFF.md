# Handoff — Landing Page Misto Esporte Clube

## Goal

Landing page completa do Misto EC (Next.js 16.2.9 App Router) com CMS via banco de dados (Neon/Drizzle). Todo conteúdo — notícias, elenco, patrocinadores, produtos, lendas, etc. — vem do DB e reflete imediatamente sem deploy. Seções podem ser ativadas/desativadas e reordenadas via `site_config` na tabela do DB.

---

## Stack

| Peça | Detalhe |
|---|---|
| Framework | Next.js 16.2.9 (App Router, `force-dynamic`) |
| DB | Neon Postgres via Drizzle ORM |
| Seed | `npx tsx src/lib/db/seed.ts` |
| CSS | Tailwind v4 + CSS custom properties |
| Fonts | Bebas Neue (títulos) + Geist (corpo) |
| Package manager | **npm** (não bun) |
| Dev | `npm run dev` |

---

## Arquitetura de Seções

`src/app/page.tsx` é `force-dynamic`. Ele chama `getAllSectionMeta()` → lê `section.<key>.enabled` e `section.<key>.order` da tabela `site_config` → renderiza seções ordenadas dinamicamente.

```
page.tsx
 └─ getAllSectionMeta([...SECTION_KEYS])   ← single DB call via getAllSiteConfig()
     └─ sorted by order → map to components
         └─ cada componente tem <SectionWrapper sectionKey="...">
             └─ SectionWrapper lê enabled → retorna null se desativado
```

**Seções disponíveis** (todas em `src/components/sections/`):

| Chave DB | Componente | Observações |
|---|---|---|
| — | `HeroSection` | Sempre primeiro, sem order config |
| `ticket_highlight` | `TicketHighlight` | Próximo jogo em casa, link para /ingresso |
| `news` | `NewsSection` → `NewsTabs` | Featured card + grid, 3 por vez |
| `squad` | `SquadSection` | Jogadores por temporada |
| `board` | `BoardSection` | Diretoria com foto/cargo |
| `history` | `HistorySection` | Timeline + LegendsMarquee + Personalidades |
| `membership` | `MembershipSection` | Planos sócio com modal |
| `sponsors` | `SponsorsSection` → `SponsorsMarquee` | Marquee infinito 2 linhas |
| `shop` | `ShopSection` | Produtos com link externo |

---

## O que já está feito (concluído e commitado)

### CMS / DB
- `force-dynamic` na `page.tsx` → cada request busca DB atualizado
- Todos os `unstable_cache` removidos de `queries.ts` → mudanças refletem imediatamente
- `section.<key>.enabled` + `section.<key>.order` controlam cada seção pelo DB
- `getAllSectionMeta()` em `src/lib/config.ts` faz uma única query e retorna `{ enabled, order }` para todas as seções
- Header e Footer filtram nav links dinamicamente pelas seções habilitadas
- Imagens de qualquer URL HTTPS funciona sem deploy: `remotePatterns: [{ protocol: "https", hostname: "**" }]` + CSP `img-src 'self' data: blob: https:`

### Marquees (Lendas + Patrocinadores)
- CSS puro — `@keyframes marquee-fwd / marquee-rev` em `globals.css` (sem Framer Motion)
- **Fórmula correta**: número par de cópias + animar para `-50%` = loop seamless (segunda metade = primeira metade)
- Cópias calculadas dinamicamente: `copies = arredonda_para_par(ceil(MIN_ITEMS / items.length))` → garante que a linha sempre preencha o viewport sem espaços em branco
- Duração proporcional: `(copies/2) * items.length * 5` segundos → velocidade visual constante

### Notícias (`NewsTabs.tsx`)
- Card destaque (featured): clicável por inteiro, imagem com `object-contain` + backdrop desfocado (`object-cover blur-md brightness-50`) para imagens portrait não deixarem barras vazias
- Cards do grid: wrapper `<a>` ou `<div>` conforme `sourceUrl` existe, sem nested `<a>`
- Paginação: 3 cards por vez, botão "Ver mais"
- Filtro por categoria via tabs

### Assets
- Logos estáticas em `public/sponsors/` (concreluz, daikin, nova-estrela, sicredi, unopar)
- Demais assets em `public/` copiados do projeto de referência

---

## O que NÃO funcionou (não repetir)

| Abordagem | Problema |
|---|---|
| Framer Motion marquee | JS-driven → snap/reset visível ao loopar |
| 3× cópias + `-50%` keyframe | -50% de 3W = -1.5W shift → conteúdo no reset ponto é diferente → salto visível |
| `unstable_cache` em `getAllSiteConfig` | TTL 5min → ativar/desativar seção no DB não refletia |
| ISR / sem `force-dynamic` | Página pré-renderizada no build → elenco e outras seções não apareciam |
| `next/image` com `remotePatterns` específicos (cbf, wikimedia) | URLs de imagens no DB falhavam sem deploy |

---

## Seções ainda não revisadas / possíveis melhorias

Estas seções ainda **não foram auditadas** visualmente pelo usuário nesta sessão:

- **HeroSection** — conteúdo visual, CTA, imagem de fundo
- **SquadSection** — cards de jogadores, filtro por temporada
- **BoardSection** — layout, foto/cargo, links sociais
- **HistorySection** — timeline, galeria de personalidades (fotos vazias?)
- **MembershipSection** — planos, modal de adesão, integração Asaas
- **ShopSection** — cards de produto, links externos
- **Checkout `/ingresso`** — wizard 6 passos (GameSelect → TicketType → BuyerInfo → RaffleStep → PaymentStep → ConfirmationStep), integração Asaas

---

## Arquivos-chave para referência rápida

```
src/
├── app/
│   ├── page.tsx                    # force-dynamic, sort/filter seções
│   ├── ingresso/page.tsx           # checkout wizard
│   └── globals.css                 # keyframes marquee-fwd/rev
├── components/
│   ├── sections/
│   │   ├── NewsTabs.tsx            # featured card + grid com paginação
│   │   ├── SponsorsMarquee.tsx     # marquee dinâmico, par de cópias
│   │   └── LegendsMarquee.tsx      # idem
│   ├── layout/
│   │   ├── Header.tsx              # async, filtra links por seção ativa
│   │   └── Footer.tsx              # idem
│   └── ui/
│       └── section-wrapper.tsx     # async SC — retorna null se disabled
├── lib/
│   ├── config.ts                   # getSectionEnabled, getAllSectionMeta
│   └── db/
│       ├── queries.ts              # todas sem cache — imediato
│       ├── schema/                 # Drizzle schema
│       └── seed.ts                 # npx tsx src/lib/db/seed.ts
next.config.ts                      # remotePatterns **, CSP img-src https:
```

---

## Como ativar/desativar/reordenar seções

No DB, tabela `site_config`:

```sql
-- desativar
UPDATE site_config SET value = 'false' WHERE key = 'section.shop.enabled';

-- reordenar
UPDATE site_config SET value = '2' WHERE key = 'section.news.order';
```

Reflete imediatamente (próximo request). Não precisa de deploy ou restart.

---

## Próxima sessão — sugestão de fluxo

1. Iniciar `npm run dev`
2. Revisar cada seção ainda não auditada (lista acima) — apontar screenshots e pedir ajustes
3. Revisar fluxo `/ingresso` (checkout wizard) — testar UX passo a passo
4. Validar mobile (responsive breakpoints)
5. Quando estiver pronto: `npm run build` para checar erros de TS/lint antes do deploy
