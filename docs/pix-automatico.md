# Pix Automático na assinatura do sócio

O sócio pode assinar com **cartão** ou **Pix Automático** (Asaas, Jornada 3). No Pix Automático, ele paga a
1ª mensalidade por QR Code e, no mesmo pagamento, autoriza no app do banco o débito das próximas.

## Como ligar para um clube

1. **Liberar na conta Asaas do clube.** O Pix Automático tem acesso controlado: peça a liberação em
   integracoes@asaas.com.br, informando a conta do clube.
2. **Webhook.** No painel do Asaas (Integrações → Webhooks), no webhook que já aponta para
   `https://<domínio do clube>/api/webhooks/asaas`, marque também os eventos do Pix Automático:
   - `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_*` (criada, ativada, recusada, cancelada, expirada)
   - `PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_*` (criada, agendada, recusada, cancelada)
   O token do webhook é o mesmo já configurado no gateway.
3. **Migração.** Rode `src/lib/db/migrations/0037_member_pix_automatic.sql` no banco do clube (idempotente).
4. **Ligar no painel.** Admin do sistema → Configurações → aba **Gateways** → "Pix Automático
   (sócio-torcedor)" → marcar "Oferecer Pix Automático na adesão". Só aparece na adesão com o gateway Asaas ativo.

## Como funciona

| Momento | O que acontece |
| --- | --- |
| Adesão | Cria a autorização (`POST /v3/pix/automatic/authorizations`, mensal, modo `SUBSCRIPTION`, até 3 retentativas em 7 dias) com o QR da 1ª mensalidade (válido por 1 hora). O sócio fica **pendente**. |
| Pagou e autorizou | O banco confirma → autorização `ACTIVE` → sócio **ativo**, 1ª mensalidade no ledger, e-mail de boas-vindas. O Asaas cria a assinatura das próximas mensalidades; ela é vinculada ao sócio (`subscriptionId`). |
| Meses seguintes | Igual ao cartão: os eventos `PAYMENT_*` da assinatura mantêm o sócio em dia (carência, suspensão, ledger). |
| Cancelou no app do banco | Autorização `CANCELLED` → assinatura encerrada no Asaas e sócio cancelado, com benefícios até o fim do período pago. |
| Banco recusou após o 1º pagamento | Autorização `REFUSED` → o mês pago vale (sócio cancelado com benefício até o fim desse mês), sem cobranças futuras. |
| QR não pago / expirou | Sócio segue pendente. Pode refazer a adesão (a autorização anterior é cancelada). |

O estado do sócio muda **só** pelo que o Asaas responde ao reconsultar a autorização: o corpo do webhook é só
gatilho. O cron diário (`/api/internal/expire-orders`) reconsulta as adesões pendentes recentes e os ativos ainda
sem assinatura vinculada.

## Limitações atuais


- **Troca de plano:** só no cartão. No Pix Automático, o sócio cancela e faz uma nova adesão (a autorização tem
  valor fixo).
- **Sandbox:** a documentação do Asaas não descreve como simular a autorização do pagador no sandbox. Teste o
  fluxo completo com a equipe do Asaas antes de ligar em produção.
