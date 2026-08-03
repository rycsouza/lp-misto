# Faxina do Painel — features removidas/escondidas

Registro do que foi tirado do painel para manter só o que é útil ao clube.
Objetivo: documentar **o quê**, **como** e **como reverter** cada item.

Duas técnicas em uso:

- **Flag de código** (`src/lib/product-flags.ts`): esconde de **todos** e faz a
  rota dar 404. Reverter = trocar a flag para `true`. Código e tabelas do banco
  ficam intactos.
- **Gate por papel**: esconde do **admin de tenant**, mas o **admin do sistema**
  (`session.isPlatform === true`) continua vendo. Nada é apagado.

---

## 1. Sorteios / Rifas — ESCONDIDO (flag de código)

- **Quando:** 2026-08-03 · commit `ff1afce`
- **Flag:** `RAFFLES_ENABLED = false` em `src/lib/product-flags.ts`
- **O que some:** item "Sorteios" no nav do painel; seção de sorteio na home;
  aba "Sorteios" em Relatórios (link antigo `?aba=sorteios` cai em Vendas);
  toggle "Sorteio" em Configurações → Seções; bloco "Divulgar sorteio" no portal
  de Afiliados. Rotas `/sorteio/*` e `/admin/sorteios/*` respondem **404**.
- **Mantido de propósito:** código (`admin-raffles.ts`, `src/lib/raffle/*`,
  componentes `Raffle*`), **tabelas do banco** (pedidos antigos não quebram),
  a receita histórica de rifas no relatório de Vendas e o registro `rifas` no
  kill-switch da plataforma.
- **Reverter:** `RAFFLES_ENABLED = true`.

## 2. Campanhas de e-mail — ESCONDIDO (flag de código)

- **Quando:** 2026-08-03 · commit `affca82`
- **Flag:** `CAMPAIGNS_ENABLED = false` em `src/lib/product-flags.ts`
- **O que some:** item "Campanhas" no nav; rota `/admin/campanhas` → **404**.
- **Mantido de propósito:** `campaigns.ts`, `CampaignComposer`, disparo de
  e-mail. **`getCampaignProducts` NÃO é afetado** (é usado pelos filtros de
  Pedidos e Cupons, apesar do nome).
- **Reverter:** `CAMPAIGNS_ENABLED = true`.

## 3. Configurações (`/admin/configuracoes`) — GATE POR PAPEL

- **Quando:** 2026-08-03
- **Como:** as abas abaixo entram em `PLATFORM_ONLY_TABS` na própria página; só
  aparecem para o **admin do sistema**. O admin de tenant passa a ver apenas
  **Clube** (enxuto) e **Retirada**. Forçar `?tab=...` numa aba escondida cai na
  primeira aba visível.
- **Abas escondidas do tenant (visíveis ao admin do sistema):**
  - **Ingressos** — ingressos agora são configurados por jogo.
  - **Aparência** — cores da plataforma.
  - **Loja** — frete / Melhor Envio.
  - **Gateways** — gateways de pagamento.
  - **Seções** — visibilidade/ordem das seções da home.
  - **Segurança** — expiração da sessão.
- **Aba Clube (enxuta para o tenant):** escondidos os campos de **mídia** —
  upload de logo, favicon, imagem de destaque (hero) e destaques do hero. Os
  valores atuais seguem em inputs `hidden`, então **salvar não apaga nada**. O
  admin do sistema vê e edita tudo. (`ConfigFormContact` prop `showMedia`.)
- **Reverter:** remover a aba de `PLATFORM_ONLY_TABS` (e/ou `showMedia`).

> **Nota de segurança (backend):** este gate é de **UI**. As server actions por
> trás (ex.: `updateGateway`, `updateConfigValues`) ainda exigem só `requireAdmin`,
> então um admin de tenant continua tecnicamente autorizado a chamá-las direto.
> Se quiser bloqueio real (recomendado ao menos para **Gateways**), é um passo
> à parte: trocar o guard dessas actions para exigir `isPlatform`.
