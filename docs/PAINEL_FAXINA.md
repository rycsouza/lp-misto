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
  **Clube** (enxuto), **Retirada** e **Seções** (liberada de volta ao tenant em
  2026-10-14). Forçar `?tab=...` numa aba escondida cai na
  primeira aba visível.
- **Abas escondidas do tenant (visíveis ao admin do sistema):**
  - **Ingressos** — ingressos agora são configurados por jogo.
  - **Aparência** — cores da plataforma.
  - **Loja** — frete / Melhor Envio.
  - **Gateways** — gateways de pagamento.
  - **Segurança** — expiração da sessão.
- **Aba Clube (enxuta para o tenant):** escondidos os campos de **mídia** —
  upload de logo, favicon, imagem de destaque (hero) e destaques do hero. Os
  valores atuais seguem em inputs `hidden`, então **salvar não apaga nada**. O
  admin do sistema vê e edita tudo. (`ConfigFormContact` prop `showMedia`.)
- **Reverter:** remover a aba de `PLATFORM_ONLY_TABS` (e/ou `showMedia`).

> **Nota de segurança (backend):** o bloqueio é **real** também no servidor.
> - **Gateways:** todas as actions de gateway (`getAdminGateways`, `getAdminGatewayById`,
>   `createGateway`, `updateGateway`, `deleteGateway`, `setActiveGateway`) exigem
>   `requirePlatformAdmin`, e as páginas `/admin/configuracoes/gateways/*` redirecionam
>   quem não é admin do sistema (testes em `admin-gateways.authz.test.ts`).
> - **Demais abas (`updateConfigValues`):** o servidor aplica a mesma divisão por chave,
>   definida em `src/lib/admin/config-keys.ts`, com o inventário de quem grava o quê.
>   Admin de tenant grava só as chaves do Clube (sem mídia), Retirada e Seções
>   (`section.<chave>.enabled/order`, só para as seções conhecidas). Chave de sistema
>   (Ingressos, Aparência, Loja, Segurança e mídia do Clube) só passa se o valor for
>   **igual ao atual** (caso dos inputs hidden). Valor diferente ou chave desconhecida
>   recusa o lote inteiro com "Não autorizado.", sem gravar nada. Admin do sistema
>   grava as chaves conhecidas de todas as abas. Payload inválido (não é objeto plano
>   de strings, valor > 20.000 caracteres, mais de 100 chaves) recusa com "Dados inválidos.".
>   Testes: `admin-config.authz.test.ts` e `src/lib/admin/config-keys.test.ts`.
> - **Efeito colateral:** o agente IA (`update_site_config`) não altera mais preço de
>   ingresso quando logado como admin do clube (recebe "Não autorizado.").
> - O gate de **UI** continua valendo para esconder as abas; a autorização real está no servidor.
