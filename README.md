# Misto Esporte Clube Digital

Site institucional e de conversão do Misto Esporte Clube — Três Lagoas/MS.

## Stack

- **Next.js 16.2.9** (App Router)
- **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **Drizzle ORM** + **NeonDB** (Postgres Serverless)
- **Vercel** (deploy)

## Setup Local

### Pré-requisitos

- Node.js 20+ com npm
- Conta no [NeonDB](https://neon.tech) com um projeto criado

### 1. Clone e instale as dependências

```bash
git clone <repo-url>
cd landingpage-misto
npm install
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha `.env.local` com os valores reais:

| Variável | Como obter |
|---|---|
| `DATABASE_URL` | NeonDB Console → seu projeto → Connection string |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` |

### 3. Execute as migrations e o seed

```bash
npm run db:migrate
npm run db:seed
```

### 4. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Scripts Disponíveis

| Script | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção local |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run test` | Vitest |
| `npm run db:generate` | Gerar migrations Drizzle |
| `npm run db:migrate` | Executar migrations |
| `npm run db:seed` | Popular banco com dados iniciais |
| `npm run db:studio` | Drizzle Studio (interface visual do banco) |
| `npm run analyze` | Analisar bundle size |

## Estrutura de Pastas

```
src/
├── app/                  # App Router (páginas e layouts)
├── components/           # Componentes React
│   ├── ui/               # Primitivos shadcn/ui
│   └── sections/         # Seções da landing page
├── lib/
│   ├── db/               # Schema Drizzle + cliente NeonDB
│   ├── config.ts         # Helper de leitura do site_config
│   └── payment/          # Módulo agnóstico de gateway
├── actions/              # Server Actions
└── hooks/                # Custom hooks client-side
```

## Contexto do Produto

Ver [`CONTEXT.md`](./CONTEXT.md) para documentação completa de decisões de produto, modelagem do banco e plano de desenvolvimento.
