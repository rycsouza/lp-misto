/**
 * Dados de sócio-torcedor do seed, espelho da planilha oficial de planos.
 * Espelha scripts/sql/socios-reset-planilha.sql: ao mudar um, mude o outro.
 * Módulo sem efeitos colaterais (não abre banco), para o teste conferir os valores.
 */

export interface SocioPlanSeed {
  name: string;
  slug: string;
  /** Público: 'pf' = CPF; 'pj' = empresa (CNPJ). */
  audience: "pf" | "pj";
  icon: string;
  description: string;
  priceCents: number;
  productDiscountPct: number;
  ticketDiscountPct: number;
  freeTicketsPerHomeGame: number;
  firstMonthFree: boolean;
  highlight: boolean;
  highlightLabel: string | null;
  cardColor: string;
  active: boolean;
  order: number;
}

export interface SocioBenefitSeed {
  label: string;
  order: number;
  /** Slugs dos planos que incluem o benefício. */
  planSlugs: string[];
  /** Valor específico para esses planos (ex.: "3 segundos"). */
  detail?: string;
}

export const SOCIO_PLANS: SocioPlanSeed[] = [
  {
    name: "Raiz",
    slug: "raiz",
    audience: "pf",
    icon: "Star",
    description: "Para quem é Misto de raiz: carteirinha e seu nome no mural do clube.",
    priceCents: 990,
    productDiscountPct: 5,
    ticketDiscountPct: 0,
    freeTicketsPerHomeGame: 0,
    firstMonthFree: false,
    highlight: false,
    highlightLabel: null,
    cardColor: "#3f6212",
    active: true,
    order: 1,
  },
  {
    name: "Torcedor",
    slug: "torcedor",
    audience: "pf",
    icon: "Star",
    description: "Para quem acompanha o Misto de perto: tudo do Raiz e mais desconto na loja oficial.",
    priceCents: 1990,
    productDiscountPct: 7,
    ticketDiscountPct: 0,
    freeTicketsPerHomeGame: 0,
    firstMonthFree: false,
    highlight: false,
    highlightLabel: null,
    cardColor: "#1d4ed8",
    active: true,
    order: 2,
  },
  {
    name: "Carcará",
    slug: "carcara",
    audience: "pf",
    icon: "Star",
    description: "Entre no time de verdade: ingresso em treinos abertos, visitas e feijoadas, com 10% off na loja.",
    priceCents: 4990,
    productDiscountPct: 10,
    ticketDiscountPct: 0,
    freeTicketsPerHomeGame: 0,
    firstMonthFree: false,
    highlight: true,
    highlightLabel: "MAIS POPULAR",
    cardColor: "#b45309",
    active: true,
    order: 3,
  },
  {
    name: "Elite",
    slug: "elite",
    audience: "pf",
    icon: "Star",
    description: "Viva o clube por dentro: área exclusiva no estádio, meet & greet com jogadores e ingresso grátis em jogos em casa.",
    priceCents: 7990,
    productDiscountPct: 12,
    ticketDiscountPct: 0,
    freeTicketsPerHomeGame: 1,
    firstMonthFree: false,
    highlight: false,
    highlightLabel: null,
    cardColor: "#111827",
    active: true,
    order: 4,
  },
  {
    name: "Empresarial",
    slug: "empresarial",
    audience: "pj",
    icon: "Star",
    description: "Para empresas que querem o Misto como vitrine: divulgação nas redes, networking e sua marca no painel de LED.",
    priceCents: 24900,
    productDiscountPct: 15,
    ticketDiscountPct: 0,
    freeTicketsPerHomeGame: 2,
    firstMonthFree: false,
    highlight: false,
    highlightLabel: null,
    cardColor: "#7a5c12",
    active: true,
    order: 5,
  },
];

/** Benefícios textuais. Descontos e ingressos grátis NÃO entram aqui (vêm dos campos do plano). */
export const SOCIO_BENEFITS: SocioBenefitSeed[] = [
  { label: "Carteirinha digital", order: 1, planSlugs: ["raiz", "torcedor", "carcara", "elite", "empresarial"] },
  { label: "Nome no mural digital do clube", order: 2, planSlugs: ["raiz", "torcedor", "carcara", "elite", "empresarial"] },
  {
    label: "Ingresso em experiências (treino aberto, visitas, feijoadas)",
    order: 3,
    planSlugs: ["carcara", "elite", "empresarial"],
  },
  {
    label: "Acesso a área exclusiva no estádio (se possível — ver termo de adesão)",
    order: 4,
    planSlugs: ["elite", "empresarial"],
  },
  { label: "Meet & greet com jogadores", order: 5, planSlugs: ["elite", "empresarial"] },
  { label: "Divulgação da empresa nas redes sociais do clube", order: 6, planSlugs: ["empresarial"] },
  { label: "Networking com diretoria e patrocinadores", order: 7, planSlugs: ["empresarial"] },
  { label: "Nome da empresa no painel de LED", order: 8, planSlugs: ["empresarial"], detail: "3 segundos" },
];
