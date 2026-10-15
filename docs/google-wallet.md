# Google Carteira: carteirinha do sócio

O botão **Salvar no Google Carteira** aparece na área logada (/conta, aba de sócio), logo abaixo
da carteirinha, para o sócio com assinatura em dia. O passe leva nome do sócio, nome do clube,
plano, mês/ano de adesão e o QR de identificação (o mesmo da carteirinha).

Um emissor (conta da Play55) atende todos os clubes. Cada clube tem a sua classe de passe
(`<emissor>.socio_<slug-do-clube>`), e cada sócio tem um objeto (`..._<id-do-sócio>`). Salvar de
novo atualiza o mesmo passe.

Sem as três variáveis de ambiente, o recurso fica **desligado**: o botão não aparece.

## Como funciona

O servidor assina um JWT (RS256) com a chave da conta de serviço e monta o link
`https://pay.google.com/gp/v/save/<JWT>`. O JWT leva a classe e o objeto do passe. Não há chamada
à API REST do Google. O link é gerado só quando o sócio clica no botão.

Código: `src/lib/wallet/google.ts` (interno) e `getMyGoogleWalletUrl` em `src/app/actions/account.ts`.

## 1. Conta de emissor (Google Pay & Wallet Console)

1. Acesse o **Google Pay & Wallet Console** com a conta Google da Play55 (pay.google.com/business/console).
2. Crie a conta de emissor (issuer). Anote o **Issuer ID**: é um número, por exemplo `3388000000012345678`.
3. Os nomes das telas mudam com frequência. Se algo não bater, procure por "Issuer" e "Google Wallet API".

## 2. Projeto e conta de serviço (Google Cloud)

1. Em console.cloud.google.com, crie (ou use) um projeto da Play55.
2. Ative a **Google Wallet API** para esse projeto.
3. Em **IAM e administrador > Contas de serviço**, crie uma conta de serviço (por exemplo `wallet-socios`).
   O e-mail dela termina em `.iam.gserviceaccount.com`.
4. Na conta de serviço, em **Chaves**, adicione uma chave **JSON**. O arquivo é baixado para o seu computador.
   Ele é segredo: guarde num cofre de senhas e apague a cópia local depois da configuração.

## 3. Autorizar a conta de serviço no emissor

No Wallet Console, em **Usuários** (ou a seção de contas de serviço/acesso), adicione o e-mail da
conta de serviço com o papel de administrador ou desenvolvedor, conforme as opções da tela.
Sem isso, o Google recusa os passes com erro de permissão.

## 4. Variáveis de ambiente (Vercel)

Preencha no painel da Vercel (Settings > Environment Variables), no ambiente de produção:

| Variável | Valor (do arquivo JSON) |
|---|---|
| `GOOGLE_WALLET_ISSUER_ID` | o Issuer ID do passo 1 (só números) |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL` | campo `client_email` |
| `GOOGLE_WALLET_PRIVATE_KEY` | campo `private_key` |

Sobre a chave privada:

- Copie **só** o valor de `private_key` (começa com `-----BEGIN PRIVATE KEY-----`). Não cole o JSON inteiro.
- O valor pode ser colado com as quebras de linha reais ou em uma linha só com `\n` escapado,
  como vem no JSON. O código aceita as duas formas. Aspas ao redor também são removidas.
- Depois de salvar as variáveis, faça um novo deploy: elas só valem para builds e execuções novos.

Para testar em preview, repita as variáveis no ambiente de preview.

## 5. Modo de demonstração (até a publicação)

Enquanto o Google não aprovar o acesso de publicação do emissor, a classe fica em revisão
(`reviewStatus: UNDER_REVIEW`). Nesse modo, **só os usuários de teste** cadastrados no console
conseguem salvar o passe.

- Para testar: cadastre o seu e-mail Google como usuário de teste no console, entre na área logada
  com um sócio ativo e clique em **Salvar no Google Carteira**.
- Para publicar: peça o acesso de publicação no console. Depois de aprovado, a classe deixa de ser
  restrita aos usuários de teste. Confirme no console se a classe precisa de aprovação manual
  antes de liberar para todos.

Checagem rápida: o passe aparece na Carteira com o QR; escanear o QR abre a verificação pública
da carteirinha com a situação real do sócio.

## 6. Limitações conhecidas

- **O passe não muda sozinho.** Se o sócio for cancelado ou suspenso, o texto salvo no passe
  (plano e "Sócio desde") continua o mesmo. Mas o QR sempre mostra a situação real quando é escaneado:
  na portaria, o sócio sem benefício não passa. Atualizar o passe automaticamente exigiria chamadas à
  API REST do Google (atualizar o objeto a cada mudança de situação). Fica como evolução.
- **Botão:** o texto segue as diretrizes de marca em PT-BR, mas o ideal é usar o botão oficial
  "Salvar no Google Carteira" (arte fornecida pelo Google) antes do lançamento.
- **Link de salvamento:** o link contém o JWT do passe, que leva o token do QR do sócio. Quem tiver
  o link pode salvar o mesmo passe. Trate-o como a carteirinha em si: não o compartilhe, e não o cole
  em suporte ou em canal público.

## 7. Segurança

- A chave privada fica só na variável de ambiente. Nunca no repositório, nos logs nem no front-end.
- Se a chave JSON vazar: no Google Cloud, crie uma nova chave da conta de serviço, atualize
  `GOOGLE_WALLET_PRIVATE_KEY` na Vercel, faça deploy e **remova a chave antiga**.
- Os erros de montagem do link vão ao log só com o tipo do erro, sem a chave nem o JWT.
