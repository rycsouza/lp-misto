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

- [Bun](https://bun.sh) instalado
- Conta no [NeonDB](https://neon.tech) com um projeto criado
- Node.js 20+

### 1. Clone e instale as dependências

```bash
git clone <repo-url>
cd landingpage-misto
bun install
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
bun run db:migrate
bun run db:seed
```

### 4. Inicie o servidor de desenvolvimento

```bash
bun run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Scripts Disponíveis

| Script | Descrição |
|---|---|
| `bun run dev` | Servidor de desenvolvimento |
| `bun run build` | Build de produção |
| `bun run start` | Servidor de produção local |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |
| `bun run test` | Vitest |
| `bun run db:generate` | Gerar migrations Drizzle |
| `bun run db:migrate` | Executar migrations |
| `bun run db:seed` | Popular banco com dados iniciais |
| `bun run db:studio` | Drizzle Studio (interface visual do banco) |
| `bun run analyze` | Analisar bundle size |

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
