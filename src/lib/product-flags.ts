/**
 * Interruptores de feature do PRODUTO controlados EM CÓDIGO — diferentes do
 * kill-switch por tenant em `@/lib/platform/features` (que é runtime, via DB).
 *
 * RAFFLES_ENABLED = false: Sorteios/Rifas foram REMOVIDOS das telas (nav do
 * painel, seção da home, checkout e a aba de relatórios) e as rotas `/sorteio`
 * e `/admin/sorteios` respondem 404. O código e as TABELAS do banco permanecem
 * intactos (pedidos antigos não quebram). Para religar, basta voltar para
 * `true` — nada mais precisa mudar.
 */
export const RAFFLES_ENABLED = false;
