# App Android (TWA) por clube — guia do Bubblewrap

O app de cada clube é um **TWA** (Trusted Web Activity): o Android abre o site do
clube em tela cheia, pelo Chrome do aparelho. Login, carteirinha, ingressos e
pagamentos são os do próprio site. **Mudanças no site chegam ao app na hora** — só
é preciso publicar versão nova na Play Store quando mudar nome, ícone, cores ou o
pacote.

Um app por clube: cada clube tem **seu pacote, sua chave e sua pasta**. Nunca
reutilize a pasta/chave de um clube em outro.

---

## 0. Pré-requisitos (na máquina de build, não na de desenvolvimento)

- Node.js 18+.
- Bubblewrap: `npm i -g @bubblewrap/cli`
- JDK 17 e Android SDK: na primeira execução o Bubblewrap oferece baixar e
  configurar os dois sozinho (recomendado aceitar).
- O site do clube no ar, em HTTPS, com o manifesto respondendo:
  `https://<dominio-do-clube>/manifest.webmanifest`

## 1. Criar o projeto

```bash
mkdir -p ~/apps-clubes/<slug-do-clube> && cd ~/apps-clubes/<slug-do-clube>
bubblewrap init --manifest https://<dominio-do-clube>/manifest.webmanifest
```

Respostas recomendadas (o resto pode ficar no padrão sugerido, que vem do manifesto):

| Pergunta | Valor |
|---|---|
| Domain | `<dominio-do-clube>` (sem `https://`) |
| Application name / Short name | nome do clube (curto ≤ 12 caracteres) |
| **Application ID (pacote)** | ex.: `br.com.<dominio>.app` — **definitivo**, não dá para trocar depois de publicar |
| Display mode | `standalone` |
| Orientation | `portrait` |
| Status bar / navigation color | cor do tema do clube |
| Start URL | `/` |
| Icon / Maskable icon | já vêm do manifesto (512 px e maskable) |
| Include support for Play Billing | **Não** (ingressos, produtos e sócio são cobrados pelo Asaas) |
| Location delegation / Notifications | Não, por enquanto |
| **Signing key** | criar nova: `android.keystore`, alias `android`, senhas fortes |

> **Guarde o `android.keystore` e as senhas** (cofre de senhas da empresa + backup
> fora da máquina). Com o Play App Signing (padrão), perder essa chave tem
> recuperação pelo suporte do Google, mas dá trabalho. Nunca suba o keystore no Git.

## 2. Gerar o app

```bash
bubblewrap build
```

Saídas:
- `app-release-bundle.aab` → vai para a Play Store.
- `app-release-signed.apk` → para instalar direto num celular e testar.

## 3. Ligar o app ao domínio (Digital Asset Links)

Sem isso o app abre **com a barra de endereço do Chrome** (parece um navegador).

1. Pegue a impressão digital SHA-256 da **chave de upload** (a do keystore):
   ```bash
   bubblewrap fingerprint list
   ```
   (ou `keytool -list -v -keystore android.keystore -alias android` → linha `SHA256:`)
2. Depois de criar o app no Play Console e subir o primeiro `.aab`, pegue a
   SHA-256 da **chave de assinatura do Google**: Play Console → *Testar e lançar* →
   *Integridade do app* → *Assinatura de apps* → "Certificado da chave de assinatura
   do app".
3. No painel do clube, como **admin da plataforma**: *Configurações → App Android*
   — preencha o **nome do pacote** e cole **as duas** impressões digitais (uma por
   linha). Salve.
4. Confira: `https://<dominio-do-clube>/.well-known/assetlinks.json` deve listar o
   pacote e as duas impressões. Validador do Google:
   https://developers.google.com/digital-asset-links/tools/generator

## 4. Testar no celular

```bash
adb install app-release-signed.apk
```

- Abriu **sem** barra de endereço → asset links ok.
- Abriu **com** barra → pacote/impressão no painel não confere com a chave usada
  no APK (lembre: o APK local usa a chave de upload; o app da loja, a do Google —
  por isso cadastrar as duas).
- Teste: login (deve continuar logado ao reabrir), carteirinha, "Salvar no Google
  Carteira", compra com cartão, e modo avião (deve aparecer a página "sem conexão"
  com a carteirinha salva).

## 5. Publicar na Play Store

1. Play Console → *Criar app* (nome do clube, app, gratuito).
2. *Teste interno* → subir o `.aab`.
3. Preencher: ficha da loja (descrição, ícone 512, capturas de celular), **política
   de privacidade** (URL do site do clube), *Segurança dos dados* (coleta nome,
   e-mail, telefone, CPF para compras/assinatura; pagamentos processados pelo
   Asaas), classificação de conteúdo, público-alvo.
4. Conta **pessoal** criada após nov/2023: o Google exige **teste fechado com 12
   testadores por 14 dias** antes da produção. Conta de **empresa** (com D-U-N-S)
   não tem essa exigência.
5. Enviar para produção.

**Faturamento:** ingressos, produtos físicos e sócio-torcedor (benefícios no mundo
real) ficam fora da obrigação do Google Play Billing. Se a revisão questionar,
explicar que são bens/serviços físicos e eventos presenciais.

## 6. Atualizar o app

Só quando mudar nome, ícone, cores, tela de abertura ou pacote:

```bash
cd ~/apps-clubes/<slug-do-clube>
bubblewrap update      # relê o manifesto e incrementa a versão
bubblewrap build
```

Suba o novo `.aab` no Play Console. Mudanças de conteúdo/funcionalidade do site
**não** precisam de nova versão.
