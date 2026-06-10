# Misto Esporte Clube Digital — Contexto do Produto

## 1. Visão Geral

Site institucional e de conversão do **Misto Esporte Clube** (também chamado de "Carcará da Fronteira"), clube de futebol fundado em **14 de abril de 1993**, sediado em **Três Lagoas, Mato Grosso do Sul**. O clube disputa o **Campeonato Sul-Mato-Grossense Série B 2026** com objetivo de conquistar acesso à Série A.

O site serve como canal principal de:
- Comunicação institucional (história, diretoria, elenco)
- Venda de ingressos (fluxo multi-step com pagamento via gateway real)
- Captação de leads em múltiplos pontos da jornada
- Captação de patrocinadores
- Loja de produtos oficiais (camisas)
- Feed de notícias do clube

> **Escopo v1:** sócio torcedor aparece na LP apenas como captura de interesse (lead). Gestão de assinaturas e autenticação de sócios são v2.

---

## 2. Identidade de Marca

| Atributo | Valor |
|---|---|
| Nome oficial | Misto Esporte Clube |
| Apelido | Carcará da Fronteira |
| Fundação | 14 de abril de 1993 |
| Cidade | Três Lagoas, MS |
| Cores oficiais | Preto e Branco (uniforme) |
| Cor de destaque digital | Dourado/Ouro — `hsl(37 46% 60%)` |
| Tema do site | Dark (fundo quase preto `hsl(0 0% 7%)`) |
| Fonte display | Bebas Neue (headers, números grandes) |
| Fonte corpo | Inter |
| Instagram | `@misto.esporteclube` |
| WhatsApp (clube) | `+55 (67) 99136-0075` |
| E-mail | `contato@mistoec.com.br` (placeholder) |
| PIX | `mistoesporteclubetreslagoas@gmail.com` |
| CNPJ | Placeholder (`00.000.000/0001-00`) |

---

## 3. Stack Técnica

### 3.1 Stack Alvo (reconstrução)

| Item | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.9 (travada) |
| Linguagem | TypeScript | travada |
| Estilização | Tailwind CSS | travada |
| Componentes UI | shadcn/ui (Radix UI) | travado |
| Animações | Framer Motion | travado |
| Banco de dados | NeonDB (Postgres Serverless) | — |
| ORM | Drizzle ORM | travado |
| Validação | Zod | travado |
| Fonte | `next/font` (self-hosted — Bebas Neue + Inter) | — |
| Package manager | bun | — |
| Deploy | Vercel | — |
| Testes | Vitest | travado |
| Linting | ESLint + Prettier | travado |

**Política de versões:** todos os pacotes com versão exata no `package.json` (sem `^` ou `~`). O `bun.lock` deve ser commitado. Atualizações de dependências são explícitas e revisadas.

### 3.2 Stack Original (Lovable — referência, não reutilizar)

| Item | Tecnologia |
|---|---|
| Framework | React 18 + Vite |
| Roteamento | React Router DOM |
| QR Code | `qrcode` (client-side) |
| Fonte | Google Fonts via `@import` CSS |

---

## 4. Estrutura de Páginas

### 4.1 Página Principal (`/`)

> Paths abaixo são da reconstrução em Next.js App Router. Referências ao projeto Lovable estão na Seção 5.

Ordem das seções (visibilidade controlada por `site_config` no banco):

1. **Header** — fixo no topo, com logo, nav desktop/mobile, link Instagram
2. **HeroSection** (`#inicio`) — foto do jogador, headline, countdown para próximo jogo, CTAs, bloco de expectativa
3. **TicketHighlight** — card do próximo jogo em casa com link para checkout de ingresso
4. **ShopSection** (`#loja`) — grade de produtos (camisas); ingressos no checkout dedicado
5. **NewsSection** (`#noticias`) — notícia destaque + grade filtrada por categoria
6. **SquadSection** (`#elenco`) — elenco vindo do banco; exibe placeholder quando não há jogadores cadastrados
7. **BoardSection** (`#diretoria`) — diretoria executiva + conselho fiscal
8. **HistorySection** (`#historia`) — timeline + carrossel de lendas + personalidades
9. **MembershipSection** (`#socio`) — tabela comparativa de planos + **formulário de interesse (lead capture)**; sem checkout de assinatura no v1
10. **SponsorsSection** (`#patrocinadores`) — marquee animado de logos + formulário de interesse para patrocinadores (lead capture)
11. **Footer** — logo, links institucionais, contato, redes sociais + campo de newsletter (lead capture)

### 4.2 Checkout de Ingresso (`/ingresso`)

Fluxo wizard com 6 etapas:
1. **Escolha do jogo** — lista os jogos em casa vindos do banco
2. **Tipo de ingresso** — Inteira ou Meia + quantidade (1–10); preços via `site_config`
3. **Sorteio** — números da sorte para concorrer a camisas; preços via `site_config`
4. **Dados do comprador** — nome, e-mail, WhatsApp (validados com Zod); captura automática em `leads`
5. **Pagamento** — QR Code PIX + chave copiável gerados pelo gateway ativo; confirmação automática via webhook
6. **Confirmação** — status do pagamento confirmado; sem necessidade de envio manual de comprovante

---

## 5. Dados e Conteúdo

> As subseções abaixo documentam o conteúdo do projeto Lovable como referência para seed do banco. Na reconstrução, esses dados saem do NeonDB.

### 5.1 Próximos Jogos em Casa (referência Lovable)

| Rodada | Data | Adversário | Local |
|---|---|---|---|
| 2ª rodada | 27/06/2026 (Sáb) 15h | Aquidauanense FC | Estádio Madrugadão |
| 4ª rodada | 11/07/2026 (Sáb) 15h | São Gabriel EC | Estádio Madrugadão |
| 6ª rodada | 25/07/2026 (Sáb) 15h | EC Campo Grande | Estádio Madrugadão |

Primeiro jogo fora de casa (referência no hero): **22/06/2026** — Misto x EC Taveirópolis — Campo Grande/MS.

### 5.2 Planos Sócio Torcedor _(referência Lovable — seed para v2)_

| Plano | Ícone | Preço | Destaque |
|---|---|---|---|
| Raiz | Leaf | R$ 9,90/mês | — |
| Torcedor | Shield | R$ 19,90/mês | — |
| Carcará | Bird | R$ 39,90/mês | MAIS POPULAR |
| Elite | Crown | R$ 79,90/mês | — |
| Empresarial | Building2 | R$ 199,00/mês | — |

No v1, a seção exibe os planos e captura o interesse via lead (nome, e-mail, WhatsApp, plano escolhido). Sem checkout de assinatura.

### 5.3 Patrocinadores (referência Lovable)

| Nome | Tier | Instagram |
|---|---|---|
| Sicredi | Diamante | `instagram.com/p/DYr0PF4BQ2y/` |
| Supermercado Nova Estrela | Ouro | `instagram.com/p/DYryq1dOOsU/` |
| Concreluz | Ouro | `instagram.com/p/DYr1SHCOm5q/` |
| Unopar | Prata | `instagram.com/p/DYr1bl3Pitc/` |
| Daikin | Prata | `instagram.com/p/DYr1n84P71v/` |

Logos de Tiete Materiais e Prefeitura de Três Lagoas existem nos assets mas não estão na seção de patrocinadores.

### 5.4 Produtos na Loja (referência Lovable)

| Produto | Preço | Imagem |
|---|---|---|
| Camisa Oficial Preta | R$ 199,00 | sem imagem |
| Camisa Oficial Branca | R$ 199,00 | sem imagem |
| Camisa de Torcedor Preta | R$ 109,00 | sim |
| Camisa de Torcedor Branca | R$ 109,00 | sim |
| Camisa de Torcedor Rosa | R$ 109,00 | sim |
| Ingresso para um jogo | R$ 30,00 | sem imagem |
| Ingresso para os três jogos | R$ 90,00 | sem imagem |
| Ingresso (meia entrada) | R$ 15,00 | sem imagem |

### 5.5 Notícias (referência Lovable)

10 notícias com categorias: Futebol Profissional, Base, Institucional, Sócio Torcedor, Patrocinadores. Destaque: "Misto contrata técnico José Oliveira para a Série B 2026".

### 5.6 Diretoria (referência Lovable)

**Diretoria Executiva (7 membros):**
- Antônio Carlos Teixeira de Freitas — Presidente (Tietê Mat Construção)
- Joaquim Romero Barbosa — Vice-Presidente (Nova Estrela Supermercados)
- Joaquim Pedro Barbosa Sanches — Tesoureiro (Nova Estrela Supermercados)
- Kuesley Fernandes do Nascimento — Secretário (Play55 Tecnologias)
- Jefferson José Gonçalves — Dir. Categorias de Base (Colégio Unitrês Objetivo)
- Pedro Bonfietti — Diretor Jurídico (Advogado)
- Adilson Popó — Diretor de Esportes

**Conselho Fiscal (7 membros — 3 titulares + 4 suplentes):**
Orlando Vicente, Antonio Carlos Noia, Alessandro Rodrigues (titulares); Adriano Ferreira, Donizetti da Silva, José Roberto Rodrigues, Fábio de Camargo (suplentes).

### 5.7 História e Lendas (referência Lovable)

**Timeline:**
- 1993 — Fundação
- 2000 — Primeira participação estadual
- 2010 — Título histórico (genérico, pode precisar de precisão)
- 2020 — Reestruturação
- 2026 — Objetivo Série A

**Lendas (15):** Mi Santa Luzia, Júlio Primavera, Crystiano, Olair, Maringá, Bruno Diniz, Célio, Arthur Hassam, Digue, Ângelo, Kayo, Hodirley (Tranin), Giordan (Belisca), Jean (Vinícius), Rodrigo Goiano.

**Personalidades:** Médicos (Dr. Joel, Dr. Ari Arão, Dr. Nivaldo), Técnicos (Ramão, Amarildo Carvalho). Categorias "Dirigentes" e "Voluntários" existem mas estão vazias.

---

## 6. Assets Disponíveis

```
src/assets/
├── misto-logotipo.jpeg          # Logo oficial
├── hero-player.jpg              # Foto do jogador (hero)
├── eldorado-brasil.png          # Logo (não usado em nenhum componente)
├── play55-logo.png / .webp      # Logo Play55 (não usado em componente)
├── prefeitura-tres-lagoas.png   # Logo prefeitura (não em SponsorsSection)
├── sicoob.png                   # Logo Sicoob (não em SponsorsSection)
├── suzano.svg                   # Logo Suzano (não em SponsorsSection)
├── tiete-materiais-logo.png     # Logo Tietê (não em SponsorsSection)
├── unitres-objetivo-logo.png    # Logo Unitrês (não em SponsorsSection)
├── nova-estrela-logo.avif       # Logo Nova Estrela alternativo
├── board/                       # 14 fotos da diretoria
├── legends/                     # 14 fotos de lendas
├── news/                        # ~17 imagens de notícias
├── players/                     # 12 fotos de jogadores (goleiro, zagueiro, lateral, meia, atacante, volante)
├── shop/                        # 3 imagens de camisas (JSON asset references)
├── sponsors/                    # 5 logos de patrocinadores (JSON asset references)
└── teams/                       # Escudos: misto.png, aquidauanense.png, campo-grande.png, sao-gabriel.png
```

**Obs.:** Os arquivos em `shop/` e `sponsors/` são `*.asset.json` — referências a URLs externas geradas pelo Lovable, não imagens locais brutas.

---

## 7. Problemas Identificados no Código Atual e Como Serão Resolvidos

### Arquitetura
| Problema | Solução na reconstrução |
|---|---|
| Dados hardcoded nos componentes | Migrar para NeonDB; componentes recebem dados via Server Components / `fetch` |
| Sem separação dados/apresentação | Camada de dados via Drizzle (`/lib/db`), camada de apresentação em Server/Client Components |
| Componentes muito grandes (TicketPurchase: 620 linhas) | Decomposição em sub-componentes por etapa do wizard |
| `WHATSAPP_NUMBER` e config duplicados | Arquivo único `/lib/config.ts` com todas as constantes do clube |

### Qualidade
| Problema | Solução |
|---|---|
| SquadSection sem dados | Tabela `players` no banco; seção populada quando elenco for definido |
| CNPJ e telefone como placeholder | Confirmar dados reais antes do deploy; inserir em `site_config` no banco |
| Timeline 2010 genérica | Corrigir conteúdo com dados históricos reais |
| Fallback de foto inconsistente | Componente `<Avatar>` padronizado com fallback por iniciais |

### Segurança
| Problema | Solução |
|---|---|
| Sem Content Security Policy | `next.config` com headers CSP |
| URLs da CBF sem fallback | `next/image` com `fallback` local para brasões não disponíveis |
| Formulário de ingresso sem proteção | Rate limiting via Vercel Edge + honeypot field |
| QR Code PIX inválido (não é EMV) | Geração server-side do payload BR Code EMV completo via Server Action |

### Performance
| Problema | Solução |
|---|---|
| Google Fonts bloqueante via CSS | `next/font` — self-hosted, zero layout shift |
| Imagens sem otimização | `next/image` com `sizes`, WebP automático, lazy load padrão |
| Framer Motion bundle grande | Importações seletivas (`motion/react`) + `dynamic()` onde possível |

### Acessibilidade
| Problema | Solução |
|---|---|
| `<button>` para links de âncora | `<a href="#section">` semântico |
| Ícones sem `aria-label` | Revisão completa com `aria-hidden` em decorativos e `aria-label` em funcionais |
| Sem skip link | Adicionar `<a href="#main-content">` no topo do layout |

### UX/Conversão
| Problema | Solução |
|---|---|
| Estado do checkout perdido no refresh | `sessionStorage` ou URL params para persistência entre etapas |
| PIX sem payload EMV válido | Geração via gateway real (adaptador); fallback para BR Code EMV via Server Action |
| Loja sem carrinho | Checkout integrado ao gateway; WhatsApp mantido apenas para dúvidas/contato |
| `MobileStickyCTA` não usado | Avaliar inclusão no layout mobile como CTA fixo de "Seja Sócio" |
| Gateway hardcoded/inexistente | Módulo agnóstico com interface `PaymentGateway`; gateway ativo definido no banco |

---

## 8. Integrações e Serviços Externos

| Serviço | Uso | Observação |
|---|---|---|
| WhatsApp Business | Contato, dúvidas e atendimento | Número: +55 67 99136-0075; não é canal de venda/pagamento |
| Instagram | Redes sociais | `@misto.esporteclube` |
| CBF (CDN) | Brasões de times | `conteudo.cbf.com.br/clubes/{id}/escudo.jpg` — com fallback local |
| `next/font` | Bebas Neue + Inter | Self-hosted, substitui Google Fonts externo |
| PIX (chave e-mail) | Pagamento de ingressos | `mistoesporteclubetreslagoas@gmail.com` |
| **NeonDB** | Banco de dados Postgres serverless | Dados de notícias, elenco, diretoria, jogos, sócios, vendas |
| **Vercel** | Hosting + deploy | CI/CD automático, preview por branch, Edge Functions |

---

## 9. Navegação

```
/ (Index)
  #inicio         → HeroSection
  #noticias       → NewsSection
  #elenco         → SquadSection
  #diretoria      → BoardSection
  #historia       → HistorySection
  #socio          → MembershipSection (lead capture no v1)
  #patrocinadores → SponsorsSection   (lead capture)
  #loja           → ShopSection

/ingresso        → Checkout de ingresso (6 etapas; pagamento via gateway)
* (NotFound)     → Página 404
```

---

## 10. Configuração Global

Na reconstrução, configurações do clube e do site são armazenadas em uma tabela `site_config` no banco (modelo chave/valor tipado), eliminando a necessidade de redeploy para alterações operacionais.

### 10.1 Tabela `site_config` (exemplos de chaves)

| Chave | Valor atual | Tipo |
|---|---|---|
| `club.whatsapp` | `5567991360075` | string |
| `club.instagram` | `https://instagram.com/misto.esporteclube` | string |
| `club.email` | `contato@mistoec.com.br` | string |
| `club.pix_key` | `mistoesporteclubetreslagoas@gmail.com` | string |
| `club.pix_recipient` | `Misto Esporte Clube` | string |
| `club.pix_city` | `Três Lagoas` | string |
| `club.cnpj` | — | string |
| `ticket.price_full` | `25` | number |
| `ticket.price_half` | `12.5` | number |
| `raffle.tier_1_price` | `10` | number |
| `raffle.tier_2_price` | `20` | number |
| `raffle.tier_3_price` | `25` | number |

### 10.2 Visibilidade de Seções (`section_config`)

Cada seção da landing page possui uma entrada controlando sua visibilidade. Seções desativadas não são renderizadas no servidor.

| Chave | Padrão |
|---|---|
| `section.hero.enabled` | `true` |
| `section.ticket_highlight.enabled` | `true` |
| `section.shop.enabled` | `true` |
| `section.news.enabled` | `true` |
| `section.squad.enabled` | `true` |
| `section.board.enabled` | `true` |
| `section.history.enabled` | `true` |
| `section.membership.enabled` | `true` |
| `section.sponsors.enabled` | `true` |

### 10.3 Feature flags de pagamento em `site_config`

Apenas a flag operacional fica em `site_config`. A seleção do gateway ativo e suas credenciais ficam exclusivamente na tabela `payment_gateways` (Seção 12.1).

| Chave | Tipo | Descrição |
|---|---|---|
| `payment.enabled` | `boolean` | Liga/desliga o checkout completo sem redeploy |

### 10.4 O que permanece em variáveis de ambiente (`.env` / Vercel)

Apenas segredos de infraestrutura que não mudam em runtime:

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Connection string do NeonDB |
| `ENCRYPTION_KEY` | Chave para criptografar credenciais do gateway no banco |

---

## 11. Decisões de Design Notáveis

- **Dark theme apenas** — não há modo claro implementado
- **Dourado como primária** — cor de destaque em todos os CTAs, badges e ícones
- **Bebas Neue** — fonte display condensada, usada para headlines e números grandes; cria identidade esportiva
- **Cards com borda dourada ao hover** — padrão visual consistente (`hover:border-primary hover:gold-glow-lg`)
- **Marquee de patrocinadores** — dois sentidos (esquerda/direita) com velocidades diferentes para profundidade
- **Countdown regressivo** — aponta sempre para o jogo futuro mais próximo (casa ou fora), calculado dinamicamente a partir da lista de jogos no banco; quando não há jogos futuros cadastrados, o countdown é ocultado
- **Canais de conversão múltiplos** — WhatsApp mantido para contato/dúvidas, mas pagamentos processados via gateway real integrado
- **Módulo de gateway agnóstico** — a aplicação não conhece o gateway diretamente; uma interface única (`PaymentGateway`) é implementada por adaptadores (ASAAS, Mercado Pago, Inter, etc.); o gateway ativo e suas credenciais são definidos no banco de dados, sem necessidade de redeploy para trocar de provedor
- **Configurações globais no banco** — variáveis como WhatsApp, e-mail, PIX, textos de CTA, preços e qualquer configuração simples são armazenadas em uma tabela `site_config` (chave/valor), editáveis sem redeploy
- **Visibilidade de seções controlada por banco** — cada seção da landing page possui uma flag `enabled` em `site_config`; seções desativadas não são renderizadas, sem necessidade de alteração de código ou deploy

---

## 12. Modelagem do Banco de Dados

Banco relacional Postgres (NeonDB). Todas as tabelas têm `created_at` e `updated_at` por padrão. IDs são UUID v4 salvo indicação contrária.

---

### 12.1 Configuração

#### `site_config`
Configurações operacionais do clube e do site. Chave/valor tipado, editável sem redeploy.

| Coluna | Tipo | Notas |
|---|---|---|
| `key` | `text` PK | Ex.: `club.whatsapp`, `section.hero.enabled` |
| `value` | `text` | Sempre string; cast feito na aplicação |
| `type` | `text` | `string` \| `number` \| `boolean` \| `json` |
| `description` | `text` | Documentação interna da chave |
| `updated_at` | `timestamp` | |

---

#### `payment_gateways`
Gateways de pagamento disponíveis. Apenas um `active = true` por vez.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | Ex.: `ASAAS`, `Mercado Pago`, `Inter` |
| `slug` | `text` UNIQUE | Ex.: `asaas`, `mercadopago`, `inter` |
| `credentials` | `text` | JSON criptografado com `ENCRYPTION_KEY` |
| `active` | `boolean` | Somente um gateway ativo por vez |
| `created_at` | `timestamp` | |
| `updated_at` | `timestamp` | |

---

### 12.2 Conteúdo Institucional

#### `games`
Todos os jogos da temporada (casa e fora). Base para countdown e TicketHighlight.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `season` | `integer` | Ex.: `2026` |
| `competition` | `text` | Ex.: `Sul-Mato-Grossense Série B` |
| `round` | `text` | Ex.: `2ª rodada` |
| `date` | `timestamptz` | Data/hora com timezone |
| `is_home` | `boolean` | `true` = jogo em casa (Madrugadão) |
| `opponent` | `text` | Nome do adversário |
| `opponent_crest_url` | `text` | URL do brasão do adversário |
| `venue` | `text` | Ex.: `Estádio Madrugadão — Três Lagoas/MS` |
| `active` | `boolean` | Desativar sem deletar |

---

#### `news`
Notícias e artigos do clube.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `title` | `text` | |
| `summary` | `text` | Texto curto para cards |
| `category` | `text` | `futebol_profissional` \| `base` \| `institucional` \| `socio_torcedor` \| `patrocinadores` |
| `image_url` | `text` | |
| `source` | `text` | Nome do veículo (ex.: `Campo Grande News`) |
| `source_url` | `text` | Link externo da matéria original |
| `featured` | `boolean` | Destaque no topo da seção |
| `published_at` | `date` | Data de publicação original |
| `active` | `boolean` | |

---

#### `players`
Elenco profissional.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | |
| `number` | `integer` | Número da camisa |
| `position` | `text` | `goleiro` \| `zagueiro` \| `lateral` \| `volante` \| `meia` \| `atacante` |
| `photo_url` | `text` | |
| `season` | `integer` | Ex.: `2026` |
| `active` | `boolean` | |

---

#### `board_members`
Diretoria executiva e conselho fiscal.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | |
| `role` | `text` | Ex.: `Presidente`, `Tesoureiro`, `Titular` |
| `profession` | `text` | |
| `photo_url` | `text` | |
| `group` | `text` | `executive` \| `fiscal` |
| `fiscal_type` | `text` | `titular` \| `suplente` — relevante só quando `group = fiscal` |
| `order` | `integer` | Ordem de exibição |
| `active` | `boolean` | |

---

#### `legends`
Galeria de ex-jogadores.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | |
| `photo_url` | `text` | Nullable |
| `position` | `text` | Nullable |
| `active` | `boolean` | |
| `order` | `integer` | Ordem no carrossel |

---

#### `personalities`
Personalidades que contribuíram com o clube (médicos, técnicos, dirigentes, voluntários).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | |
| `photo_url` | `text` | Nullable |
| `role` | `text` | Ex.: `Médico do clube` |
| `category` | `text` | `medicos` \| `dirigentes` \| `tecnicos` \| `voluntarios` |
| `active` | `boolean` | |
| `order` | `integer` | |

---

#### `timeline_events`
Linha do tempo da história do clube.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `year` | `text` | Ex.: `1993` |
| `title` | `text` | |
| `description` | `text` | |
| `order` | `integer` | Ordem de exibição |

---

#### `sponsors`
Patrocinadores do clube.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | |
| `logo_url` | `text` | |
| `logo_tone` | `text` | `light` \| `dark` — define cor do fundo do tile |
| `tier` | `text` | `diamante` \| `ouro` \| `prata` \| `bronze` |
| `instagram_url` | `text` | Link de destino ao clicar no logo |
| `active` | `boolean` | |
| `order` | `integer` | Ordem dentro do tier |

---

### 12.3 Captação de Leads

Lead é qualquer pessoa que interagiu com o site. A tabela centraliza todos os pontos de captura sem atrito para o usuário. Projetada para evoluir para `users` quando vier autenticação (v2).

#### `leads`

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | |
| `email` | `text` | |
| `whatsapp` | `text` | Nullable |
| `source` | `text` | `ticket_checkout` \| `membership_interest` \| `sponsorship_interest` \| `newsletter` \| `history_gallery` |
| `metadata` | `jsonb` | Dados extras do contexto (ex.: plano de interesse, jogo selecionado) |
| `created_at` | `timestamp` | |

**Índice:** `email` + `source` (evita duplicatas por canal sem bloquear o mesmo e-mail em canais diferentes).

**Pontos de captura planejados (sem atrito):**
- Checkout de ingresso — captura automática ao preencher dados (step 4)
- Botão "Seja Sócio" — modal leve com nome/email/WhatsApp + plano de interesse
- Botão "Patrocine o Misto" — nome/empresa/email/WhatsApp
- Indicação de ex-jogador (HistorySection) — nome + contato de quem indica
- Footer — campo opcional de newsletter

---

### 12.4 Sócio Torcedor _(fora do escopo v1 — planejado para v2)_

As tabelas abaixo estão modeladas para referência futura mas **não entram no desenvolvimento da primeira entrega**.

<details>
<summary>Ver modelagem v2</summary>

#### `membership_plans`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | Ex.: `Raiz`, `Carcará` |
| `slug` | `text` UNIQUE | |
| `icon` | `text` | Nome do ícone Lucide |
| `price_cents` | `integer` | Preço em centavos |
| `highlight` | `boolean` | Badge "Mais Popular" |
| `active` | `boolean` | |
| `order` | `integer` | |

#### `membership_benefits`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `label` | `text` | Ex.: `Carteirinha digital` |
| `order` | `integer` | |

#### `plan_benefits`
| Coluna | Tipo | Notas |
|---|---|---|
| `plan_id` | `uuid` FK → `membership_plans` | |
| `benefit_id` | `uuid` FK → `membership_benefits` | |
| `included` | `boolean` | |

PK composta: `(plan_id, benefit_id)`

#### `members`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `lead_id` | `uuid` FK → `leads` | Origem do cadastro |
| `name` | `text` | |
| `email` | `text` UNIQUE | |
| `whatsapp` | `text` | |
| `plan_id` | `uuid` FK → `membership_plans` | |
| `status` | `text` | `pending` \| `active` \| `cancelled` |
| `created_at` | `timestamp` | |
| `updated_at` | `timestamp` | |

</details>

---

### 12.5 Loja e Ingressos

#### `products`
Produtos da loja (camisas, etc.).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | |
| `slug` | `text` UNIQUE | |
| `category` | `text` | `camisa_oficial` \| `camisa_torcedor` |
| `price_cents` | `integer` | |
| `image_url` | `text` | |
| `active` | `boolean` | |
| `stock` | `integer` | Nullable = estoque ilimitado |

---

#### `orders`
Pedidos de ingressos e produtos.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `customer_name` | `text` | |
| `customer_email` | `text` | |
| `customer_whatsapp` | `text` | |
| `status` | `text` | `pending` \| `paid` \| `cancelled` \| `refunded` |
| `total_cents` | `integer` | |
| `created_at` | `timestamp` | |
| `updated_at` | `timestamp` | |

---

#### `order_items`
Itens de cada pedido.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `order_id` | `uuid` FK → `orders` | |
| `type` | `text` | `ticket` \| `product` \| `raffle` |
| `reference_id` | `uuid` | FK para `games.id` (ticket) ou `products.id` (product) |
| `quantity` | `integer` | |
| `unit_price_cents` | `integer` | Preço no momento da compra (snapshot) |
| `metadata` | `jsonb` | Dados extras: tipo de ingresso (inteira/meia), nº da sorte, etc. |

---

#### `payments`
Registro de cada tentativa/transação de pagamento.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `order_id` | `uuid` FK → `orders` | |
| `gateway_slug` | `text` | Ex.: `asaas`, `mercadopago` |
| `gateway_payment_id` | `text` | ID da transação no gateway externo |
| `status` | `text` | `pending` \| `paid` \| `failed` \| `refunded` |
| `amount_cents` | `integer` | |
| `pix_qr_code` | `text` | Payload EMV BR Code gerado pelo gateway |
| `pix_qr_code_url` | `text` | URL da imagem do QR Code (se o gateway fornecer) |
| `paid_at` | `timestamp` | Nullable |
| `created_at` | `timestamp` | |
| `updated_at` | `timestamp` | |

---

### 12.6 Diagrama de Relacionamentos (resumido)

```
── CONFIGURAÇÃO ──────────────────────────────────────────
site_config               chave/valor operacional + flags de seção
payment_gateways          gateways disponíveis (credenciais criptografadas)

── CONTEÚDO ──────────────────────────────────────────────
games                     jogos da temporada (base do countdown e TicketHighlight)
news                      notícias e artigos
players                   elenco profissional
board_members             diretoria executiva e conselho fiscal
legends                   galeria de ex-jogadores
personalities             médicos, técnicos, dirigentes, voluntários
timeline_events           linha do tempo da história
sponsors                  patrocinadores (com tier e ordem)

── LEADS ─────────────────────────────────────────────────
leads                     captação centralizada de todos os pontos do site

── LOJA E INGRESSOS ──────────────────────────────────────
products
orders ──────────────────── order_items  (type: ticket | product | raffle)
                                          metadata jsonb p/ dados específicos
orders ──────────────────── payments     (gateway_slug, status, pix_qr_code)

── V2 (fora do escopo v1) ────────────────────────────────
membership_plans ──┐
membership_benefits┼── plan_benefits
members ───────────┘   (FK → leads)
```

### 12.7 Decisões de Modelagem Registradas

| Decisão | Escolha | Motivo |
|---|---|---|
| `order_items` unificado vs. tabelas separadas | Unificado + `metadata jsonb` | Volume do projeto não justifica separação; FK enforçada na aplicação via Drizzle |
| Preços em centavos | `integer` (centavos) | Evita imprecisão de ponto flutuante em cálculos financeiros |
| Leads centralizado | Tabela única com `source` | Visão unificada de todos os contatos; evolui para `users` na v2 |
| Membership | Fora do escopo v1 | Reduz complexidade da primeira entrega sem perder dados modelados |
| Raffle | `order_items` + `metadata` | Suficiente para v1; tabela `raffle_draws` entra na v2 se necessário |
| Credenciais do gateway | Criptografadas no banco (AES-256) | Permite trocar gateway sem redeploy; `ENCRYPTION_KEY` fica só no ambiente |

---

## 13. Diretrizes de Segurança e Performance

Estas diretrizes são mandatórias em toda a base de código — não são checklist de fim de projeto, são restrições de desenvolvimento contínuo.

---

### 13.1 Segurança

#### Credenciais e Segredos
- **Nunca** expor `DATABASE_URL`, `ENCRYPTION_KEY` ou credenciais de gateway no cliente
- Variáveis de ambiente sem prefixo `NEXT_PUBLIC_` são server-only — manter todas as credenciais assim
- Credenciais do gateway armazenadas criptografadas no banco (AES-256-GCM); a `ENCRYPTION_KEY` existe apenas no ambiente Vercel
- Nunca logar credenciais, tokens ou dados de pagamento — nem em desenvolvimento
- `.env.local` no `.gitignore`; `.env.example` no repositório apenas com nomes das variáveis, sem valores

#### Chamadas de API — Sempre pelo Servidor
- Toda comunicação com gateways de pagamento, NeonDB e serviços externos ocorre exclusivamente em Server Components, Server Actions ou Route Handlers
- Nenhuma chave de API, URL de banco ou segredo trafega para o bundle do cliente
- Webhooks do gateway processados em `POST /api/webhooks/payment`; validar assinatura HMAC de cada requisição antes de processar
- Respostas de API para o cliente nunca incluem campos internos (IDs de gateway, credenciais, stack traces)

#### Validação de Entrada
- Todo input do usuário validado com Zod antes de qualquer operação de banco ou pagamento
- Validação aplicada tanto no cliente (UX) quanto no servidor (segurança) — nunca apenas no cliente
- Campos de texto sanitizados; sem interpolação direta de input em queries (Drizzle usa prepared statements por padrão)
- Formulários de lead e checkout com **honeypot field** oculto (campo invisível que bots preenchem e humanos não)

#### Rate Limiting
- Server Actions de lead capture e checkout protegidos por rate limiting via Vercel Edge
- Limites por IP: máximo de 10 submissões de lead por hora; 5 tentativas de checkout por hora
- Webhook endpoint com allowlist de IPs do gateway (quando disponibilizado pelo provedor)

#### Headers de Segurança (via `next.config`)
```
Content-Security-Policy       default-src 'self'; script-src 'self'; ...
X-Frame-Options               DENY
X-Content-Type-Options        nosniff
Referrer-Policy               strict-origin-when-cross-origin
Permissions-Policy            camera=(), microphone=(), geolocation=()
Strict-Transport-Security     max-age=31536000; includeSubDomains
```

#### Outros
- Links externos com `rel="noopener noreferrer"` em todo `target="_blank"`
- Imagens externas (CBF, Instagram) com domínios explicitamente permitidos em `next.config.images.remotePatterns`
- Sem `dangerouslySetInnerHTML` — se necessário, sanitizar com DOMPurify server-side
- Dependências auditadas com `bun audit` antes de cada release

---

### 13.2 Performance

#### Estratégia de Cache

| Camada | Mecanismo | TTL sugerido |
|---|---|---|
| Dados do banco (server) | `unstable_cache` do Next.js ou `cache()` do React | `site_config`: 5 min · conteúdo institucional: 1 min · jogos: 30 s |
| Rotas estáticas/semi-estáticas | ISR (`revalidate`) | Landing page: 60 s |
| Dados do cliente | `fetch` com `{ cache: 'force-cache' }` ou SWR/TanStack Query com TTL | conteúdo público: 60 s |
| Assets estáticos | Vercel CDN + `Cache-Control: public, max-age=31536000, immutable` | indefinido (hash no nome) |
| Fonte (next/font) | Self-hosted, servida pelo CDN da Vercel | indefinido |

- Cache do banco invalidado por tag (`revalidateTag`) quando um Server Action altera um registro
- Dados sensíveis (pedidos, leads, pagamentos) **nunca** cacheados no cliente

#### Imagens
- Todo `<img>` substituído por `next/image` com `sizes` explícito
- Imagens above-the-fold com `priority` (evita LCP tardio)
- Fallback local para brasões da CBF (`onError` → imagem placeholder)
- Assets locais servidos pelo CDN da Vercel com imutabilidade de cache
- Formatos modernos (WebP/AVIF) gerados automaticamente pelo `next/image`

#### JavaScript e Bundle
- Server Components por padrão; `"use client"` apenas onde há interatividade real
- Framer Motion carregado com `dynamic(() => import('framer-motion'), { ssr: false })` em seções não críticas
- shadcn/ui importado por componente (tree-shaking automático)
- Sem dependências client-side para operações que podem ser feitas no servidor (QR Code, criptografia, formatação de moeda)
- `next/bundle-analyzer` disponível como script de desenvolvimento para monitorar tamanho do bundle

#### Banco de Dados
- Selecionar apenas as colunas necessárias em cada query (sem `SELECT *`)
- Índices nas colunas de filtro mais usadas: `games.date`, `news.category`, `news.featured`, `leads.email`, `orders.status`
- Connection pooling via Neon serverless driver (evita cold start de conexão)
- Queries de leitura pública (jogos, notícias, config) sempre cacheadas no servidor antes de chegar ao banco

#### Core Web Vitals — Metas
| Métrica | Meta |
|---|---|
| LCP (Largest Contentful Paint) | < 2,5 s |
| CLS (Cumulative Layout Shift) | < 0,1 |
| INP (Interaction to Next Paint) | < 200 ms |
| FCP (First Contentful Paint) | < 1,8 s |

- Lighthouse CI configurado na Vercel; build bloqueado se score de Performance < 85 ou Acessibilidade < 90
- Fonte com `display: swap` para evitar FOIT (Flash of Invisible Text)

---

## 14. Plano de Desenvolvimento

Cada step é uma unidade entregável e testável de forma independente. Um step só começa quando o anterior estiver completo. Dependências cruzadas estão indicadas explicitamente.

---

### Step 0 — Repositório & Ambiente

**Objetivo:** base de trabalho configurada antes de qualquer código de produto.

**Entregáveis:**
- Repositório Git inicializado com `.gitignore` adequado para Next.js
- `README.md` com instruções de setup local
- Variáveis de ambiente documentadas em `.env.example`
- Conexão com NeonDB validada localmente

**Dependências:** nenhuma

---

### Step 1 — Scaffolding do Projeto Next.js

**Objetivo:** projeto Next.js funcional, rodando localmente, com toda a infraestrutura base configurada.

**Entregáveis:**
- Next.js 16.2.9 inicializado com App Router + TypeScript
- Todos os pacotes com versão exata no `package.json` (sem `^` ou `~`)
- Tailwind CSS configurado com design tokens do clube (dark theme, cor dourada, fontes)
- `next/font` com Bebas Neue + Inter (self-hosted)
- shadcn/ui inicializado e tematizado
- ESLint + Prettier configurados
- `next.config` com headers de segurança (CSP, X-Frame-Options, etc.)
- Deploy inicial na Vercel com preview por branch funcionando

**Dependências:** Step 0

---

### Step 2 — Schema do Banco + Migrations + Seed

**Objetivo:** banco de dados pronto com estrutura completa e dados iniciais.

**Entregáveis:**
- Todos os schemas Drizzle definidos (todas as tabelas da Seção 12)
- Migrations executadas no NeonDB (produção e preview)
- Seed completo com dados do projeto Lovable:
  - `site_config` — configurações padrão + flags de seção (todas `true`)
  - `games` — 4 jogos da temporada 2026
  - `news` — 10 notícias
  - `board_members` — 14 membros da diretoria
  - `legends` — 15 lendas
  - `personalities` — médicos e técnicos
  - `timeline_events` — 5 eventos
  - `sponsors` — 5 patrocinadores com tiers
  - `products` — 5 camisas
  - `membership_plans` + `membership_benefits` + `plan_benefits` _(seed apenas, sem UI no v1)_
- Script de seed idempotente (pode rodar múltiplas vezes sem duplicar)

**Dependências:** Step 1

---

### Step 3 — Layout Base + Design System

**Objetivo:** estrutura visual e de navegação que envolve todas as páginas.

**Entregáveis:**
- `RootLayout` com Header + Footer
- Header: logo, nav desktop com scroll suave, menu mobile (hamburger), link Instagram
- Footer: logo, links institucionais, contato, campo de newsletter (lead capture — conectado no Step 6)
- Skip-to-content (`<a href="#main-content">`) para acessibilidade
- Componente `<Avatar>` padronizado com fallback por iniciais
- Componente `<SectionWrapper>` que lê flag de visibilidade do banco e oculta a seção se desabilitada
- `MobileStickyCTA` como CTA fixo no mobile ("Seja Sócio")

**Dependências:** Step 2

---

### Step 4 — Seções Institucionais da Landing Page

**Objetivo:** landing page completa com todas as seções lendo dados do banco.

**Entregáveis:**
- `HeroSection` — countdown dinâmico para o jogo futuro mais próximo (query: `WHERE date > now() ORDER BY date ASC LIMIT 1`); ocultado quando não há jogos
- `TicketHighlight` — próximo jogo em casa; link para `/ingresso`
- `NewsSection` — notícias do banco com filtro por categoria; notícia destaque marcada por `featured`
- `SquadSection` — elenco do banco; placeholder "Em breve" quando vazio
- `BoardSection` — diretoria executiva e conselho fiscal do banco
- `HistorySection` — timeline, carrossel de lendas (duas linhas, sentidos opostos), personalidades
- `SponsorsSection` — marquee animado com logos do banco; CTA de patrocínio (lead form — conectado no Step 6)
- `ShopSection` — produtos do banco; botão "Comprar" abre checkout (Step 9) ou WhatsApp como fallback temporário

**Dependências:** Step 3

---

### Step 5 — Configuração Dinâmica via Banco

**Objetivo:** toda configuração operacional lida do banco, sem hardcode no código.

**Entregáveis:**
- `lib/config.ts` — helper tipado que lê `site_config` do banco com cache (`unstable_cache` ou similar)
- Todos os valores de configuração (WhatsApp, preços, textos) consumidos via helper, não hardcoded
- `SectionWrapper` consumindo flags `section.*.enabled` do banco (implementado no Step 3, conectado aqui)
- `payment.enabled` controlando visibilidade do checkout
- Testes unitários do helper de config

**Dependências:** Step 4

---

### Step 6 — Captação de Leads

**Objetivo:** capturar leads em todos os pontos planejados sem atrito para o usuário.

**Entregáveis:**
- Server Action `createLead` com validação Zod + deduplicação por `(email, source)`
- Rate limiting na Server Action (Vercel Edge)
- Honeypot field em todos os formulários
- Pontos de captura integrados:
  - **MembershipSection** — modal/form com nome, e-mail, WhatsApp, plano de interesse
  - **SponsorsSection** — form com nome, empresa, e-mail, WhatsApp
  - **Footer** — campo de newsletter (e-mail)
  - **HistorySection** — form "Indicar ex-jogador" (nome do indicante + contato)
- Feedback visual de sucesso/erro em todos os forms

**Dependências:** Step 5

---

### Step 7 — Módulo de Gateway de Pagamento

**Objetivo:** módulo agnóstico de pagamento com primeiro adaptador funcional.

**Entregáveis:**
- Interface `PaymentGateway` definida (`createPayment`, `getPayment`, `handleWebhook`)
- Adaptador ASAAS implementado e testado
- `lib/payment/index.ts` — factory que carrega o gateway ativo do banco (`payment_gateways`)
- Descriptografia de credenciais com `ENCRYPTION_KEY`
- Route Handler `POST /api/webhooks/payment` para receber notificações do gateway
- Testes unitários dos adaptadores com mocks

**Dependências:** Step 5

---

### Step 8 — Checkout de Ingressos

**Objetivo:** fluxo completo de compra de ingresso com pagamento real.

**Entregáveis:**
- Rota `/ingresso` com wizard de 6 etapas
- Step 1: seleção de jogo (jogos em casa do banco)
- Step 2: tipo de ingresso (inteira/meia) + quantidade; preços de `site_config`
- Step 3: sorteio (números da sorte); preços de `site_config`
- Step 4: dados do comprador (Zod); captura automática em `leads`
- Step 5: pagamento — QR Code + chave PIX gerados pelo gateway; `orders` + `order_items` + `payments` criados
- Step 6: confirmação — status atualizado via webhook; sem envio manual de comprovante
- Persistência de estado entre etapas via `sessionStorage`
- Tratamento de timeout/falha de pagamento

**Dependências:** Step 7

---

### Step 9 — SEO & Acessibilidade

**Objetivo:** site indexável, semântico e acessível.

**Entregáveis:**
- `metadata` por página (title, description, OG tags, Twitter cards)
- `sitemap.xml` gerado dinamicamente a partir do banco (notícias, jogos)
- `robots.txt`
- Revisão semântica completa: headings em ordem, landmarks (`main`, `nav`, `footer`, `section`)
- `aria-label` em ícones funcionais; `aria-hidden` em ícones decorativos
- Contraste WCAG AA verificado em todos os textos sobre fundo escuro
- Skip-to-content funcional e visível no foco

**Dependências:** Step 8

---

### Step 10 — Segurança

**Objetivo:** auditoria e aplicação de todas as diretrizes da Seção 13.1.

**Entregáveis:**
- Headers de segurança completos em `next.config` (CSP, HSTS, X-Frame-Options, Permissions-Policy, etc.)
- CSP testado e sem violações em produção (sem `unsafe-inline` ou `unsafe-eval`)
- Verificação de assinatura HMAC no webhook do gateway (`/api/webhooks/payment`)
- Rate limiting ativo e testado nas Server Actions de lead e checkout
- Honeypot validado em todos os formulários
- Auditoria: nenhuma variável sensível em bundle do cliente (`NEXT_PUBLIC_` apenas em dados verdadeiramente públicos)
- Auditoria: nenhuma resposta de API expõe campos internos (IDs de gateway, stack traces)
- `bun audit` executado e sem vulnerabilidades críticas ou altas
- Imagens externas restritas a domínios explícitos em `next.config.images.remotePatterns`

**Dependências:** Step 9

---

### Step 11 — Performance

**Objetivo:** auditoria e aplicação de todas as diretrizes da Seção 13.2, atingindo as metas de Core Web Vitals.

**Entregáveis:**
- Auditoria de `next/image` em todas as imagens: `sizes`, `priority` nas above-the-fold, fallback para CBF
- `"use client"` revisado — remover de componentes que não precisam de interatividade
- Framer Motion com `dynamic()` nas seções não críticas (abaixo do fold)
- Estratégia de cache revisada: todas as queries públicas com `unstable_cache` e TTLs corretos
- `revalidateTag` implementado em todos os Server Actions que alteram conteúdo
- Índices do banco validados com `EXPLAIN ANALYZE` nas queries mais frequentes
- `next/bundle-analyzer` executado; sem dependências desnecessárias no bundle do cliente
- Lighthouse CI configurado na Vercel: build bloqueado se Performance < 85 ou Acessibilidade < 90
- Metas atingidas: LCP < 2,5s · CLS < 0,1 · INP < 200ms · FCP < 1,8s

**Dependências:** Step 10

---

### Step 12 — Deploy de Produção

**Objetivo:** site no ar em produção com ambiente estável.

**Entregáveis:**
- Variáveis de ambiente de produção configuradas na Vercel (`DATABASE_URL`, `ENCRYPTION_KEY`)
- Seed de produção executado no NeonDB de produção
- Gateway de pagamento configurado no banco de produção (credenciais reais)
- Domínio customizado apontado na Vercel
- Preview deployments validados por branch
- Checklist de smoke test pós-deploy documentado

**Dependências:** Step 11

---

### Resumo Visual

```
Step 0   Repositório & Ambiente
  └── Step 1   Scaffolding Next.js
        └── Step 2   Schema + Migrations + Seed
              └── Step 3   Layout Base + Design System
                    └── Step 4   Seções Institucionais
                          └── Step 5   Config Dinâmica via Banco
                                ├── Step 6   Captação de Leads
                                └── Step 7   Módulo de Gateway
                                      └── Step 8   Checkout de Ingressos
                                            └── Step 9   SEO & Acessibilidade
                                                  └── Step 10  Segurança
                                                        └── Step 11  Performance
                                                              └── Step 12  Deploy de Produção
```
