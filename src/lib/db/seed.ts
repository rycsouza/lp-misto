/**
 * Seed idempotente — pode ser executado múltiplas vezes sem duplicar dados.
 * Usa INSERT ... ON CONFLICT DO NOTHING ou upsert onde aplicável.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });

// ─── site_config ──────────────────────────────────────────────────────────────

const configRows: (typeof schema.siteConfig.$inferInsert)[] = [
  { key: "club.whatsapp", value: "5567991360075", type: "string", description: "Número WhatsApp do clube (só dígitos)" },
  { key: "club.instagram", value: "https://instagram.com/misto.esporteclube", type: "string", description: "URL do Instagram" },
  { key: "club.email", value: "contato@mistoec.com.br", type: "string", description: "E-mail de contato" },
  { key: "club.pix_key", value: "mistoesporteclubetreslagoas@gmail.com", type: "string", description: "Chave PIX do clube" },
  { key: "club.pix_recipient", value: "Misto Esporte Clube", type: "string", description: "Nome do recebedor PIX" },
  { key: "club.pix_city", value: "Três Lagoas", type: "string", description: "Cidade do recebedor PIX" },
  { key: "club.cnpj", value: "", type: "string", description: "CNPJ do clube" },
  { key: "ticket.price_full", value: "2500", type: "number", description: "Preço inteira em centavos" },
  { key: "ticket.price_half", value: "1250", type: "number", description: "Preço meia em centavos" },
  { key: "raffle.tier_1_price", value: "1000", type: "number", description: "1 número da sorte em centavos" },
  { key: "raffle.tier_2_price", value: "2000", type: "number", description: "2 números da sorte em centavos" },
  { key: "raffle.tier_3_price", value: "2500", type: "number", description: "3 números da sorte em centavos" },
  { key: "payment.enabled", value: "false", type: "boolean", description: "Habilita checkout de pagamento" },
  { key: "hero.image_url", value: "/hero-player.jpg", type: "string", description: "Imagem de fundo da seção hero (ideal: 1920×1080 landscape JPEG/WebP, mín. 200 KB)" },
  // sections — enabled
  { key: "section.hero.enabled",             value: "true", type: "boolean", description: "Exibe seção Hero" },
  { key: "section.ticket_highlight.enabled", value: "true", type: "boolean", description: "Exibe seção Ingressos" },
  { key: "section.news.enabled",             value: "true", type: "boolean", description: "Exibe seção Notícias" },
  { key: "section.squad.enabled",            value: "true", type: "boolean", description: "Exibe seção Elenco" },
  { key: "section.board.enabled",            value: "true", type: "boolean", description: "Exibe seção Diretoria" },
  { key: "section.history.enabled",          value: "true", type: "boolean", description: "Exibe seção História" },
  { key: "section.membership.enabled",       value: "true", type: "boolean", description: "Exibe seção Sócio-Torcedor" },
  { key: "section.sponsors.enabled",         value: "true", type: "boolean", description: "Exibe seção Patrocinadores" },
  { key: "section.shop.enabled",             value: "true", type: "boolean", description: "Exibe seção Loja" },
  // sections — order (menor número aparece primeiro; hero é fixo no topo)
  { key: "section.ticket_highlight.order",   value: "1",    type: "number",  description: "Ordem da seção Ingressos" },
  { key: "section.news.order",               value: "2",    type: "number",  description: "Ordem da seção Notícias" },
  { key: "section.squad.order",              value: "3",    type: "number",  description: "Ordem da seção Elenco" },
  { key: "section.board.order",              value: "4",    type: "number",  description: "Ordem da seção Diretoria" },
  { key: "section.history.order",            value: "5",    type: "number",  description: "Ordem da seção História" },
  { key: "section.membership.order",         value: "6",    type: "number",  description: "Ordem da seção Sócio-Torcedor" },
  { key: "section.sponsors.order",           value: "7",    type: "number",  description: "Ordem da seção Patrocinadores" },
  { key: "section.shop.order",               value: "8",    type: "number",  description: "Ordem da seção Loja" },
];

// ─── games ────────────────────────────────────────────────────────────────────

const gamesRows: (typeof schema.games.$inferInsert)[] = [
  {
    season: 2026,
    competition: "Sul-Mato-Grossense Série B",
    round: "1ª rodada",
    date: new Date("2026-06-22T16:00:00-04:00"),
    isHome: false,
    opponent: "EC Taveirópolis",
    opponentCrestUrl: null,
    venue: "Campo Grande/MS",
  },
  {
    season: 2026,
    competition: "Sul-Mato-Grossense Série B",
    round: "2ª rodada",
    date: new Date("2026-06-27T15:00:00-04:00"),
    isHome: true,
    opponent: "Aquidauanense FC",
    opponentCrestUrl: "/teams/aquidauanense.png",
    venue: "Estádio Madrugadão — Três Lagoas/MS",
  },
  {
    season: 2026,
    competition: "Sul-Mato-Grossense Série B",
    round: "4ª rodada",
    date: new Date("2026-07-11T15:00:00-04:00"),
    isHome: true,
    opponent: "São Gabriel EC",
    opponentCrestUrl: "/teams/sao-gabriel.png",
    venue: "Estádio Madrugadão — Três Lagoas/MS",
  },
  {
    season: 2026,
    competition: "Sul-Mato-Grossense Série B",
    round: "6ª rodada",
    date: new Date("2026-07-25T15:00:00-04:00"),
    isHome: true,
    opponent: "EC Campo Grande",
    opponentCrestUrl: "/teams/campo-grande.png",
    venue: "Estádio Madrugadão — Três Lagoas/MS",
  },
];

// ─── news ─────────────────────────────────────────────────────────────────────

const newsRows: (typeof schema.news.$inferInsert)[] = [
  {
    title: "Misto contrata técnico José Oliveira para a Série B 2026",
    summary: "O Misto Esporte Clube anuncia a contratação do técnico José Oliveira para comandar a equipe na disputa do Campeonato Sul-Mato-Grossense Série B de 2026.",
    category: "futebol_profissional",
    imageUrl: "/news/tecnico-oliveira.webp",
    sourceUrl: "https://www.campograndenews.com.br/esportes/misto-de-tres-lagoas-anuncia-contratacao-de-tecnico-para-serie-b-de-ms",
    source: "Campo Grande News",
    publishedAt: "2026-01-01",
    featured: true,
  },
  {
    title: "Patrocinadores que acreditam no projeto do Misto em 2026",
    summary: "Sicredi, Supermercado Nova Estrela, Tiete III, Concreluz, Unopar e Daikin se unem ao Carcará e fortalecem o projeto de reestruturação do clube para a Série B 2026.",
    category: "patrocinadores",
    imageUrl: "/news/patrocinadores-2026.jpg",
    sourceUrl: "https://www.instagram.com/p/DYr0PF4BQ2y/",
    source: "Instagram @misto.esporteclube",
    publishedAt: "2026-01-01",
    featured: false,
  },
  {
    title: "Charge: Carcará de volta!",
    summary: "O chargista Gerson Henrique retrata a força e união para reerguer o Carcará. 'Força Joaquim! Vamos tirar o Carcará do buraco!'",
    category: "institucional",
    imageUrl: "/news/charge-carcara.jpeg",
    sourceUrl: "https://hojemais.com.br/tres-lagoas/noticia/charge/charge-carcara-de-volta",
    source: "HojeMais Três Lagoas",
    publishedAt: "2026-01-01",
    featured: false,
  },
  {
    title: "Teixeira é novamente o novo presidente do Misto",
    summary: "Antônio Carlos Teixeira de Freitas assume novamente a presidência do Misto Esporte Clube, trazendo experiência e compromisso para reerguer o Carcará.",
    category: "institucional",
    imageUrl: "/news/nova-diretoria.jpeg",
    sourceUrl: "https://www.hojemais.com.br/tres-lagoas/noticia/esporte/teixeira-e-novamente-o-novo-presidente-do-misto",
    source: "HojeMais Três Lagoas",
    publishedAt: "2026-01-01",
    featured: false,
  },
  {
    title: "Misto elege nova diretoria na Quarta-feira de Cinzas",
    summary: "O Misto Esporte Clube realizou eleição e elegeu sua nova diretoria, reforçando o compromisso com a reestruturação do clube em Três Lagoas.",
    category: "institucional",
    imageUrl: "/news/misto-eleicao-diretoria.jpg",
    sourceUrl: "https://www.rcn67.com.br/tres-lagoas/jpnews/misto-elege-nova-diretoria-na-quarta-feira-de-cinzas/",
    source: "RCN67",
    publishedAt: "2025-03-05",
    featured: false,
  },
  {
    title: "Misto apresenta nova diretoria",
    summary: "O Misto Esporte Clube apresentou oficialmente sua nova diretoria em evento realizado na Câmara Municipal de Três Lagoas.",
    category: "institucional",
    imageUrl: "/news/misto-nova-diretoria-prefeitura.jpg",
    sourceUrl: "https://www.treslagoas.ms.gov.br/misto-apresenta-nova-diretoria/",
    source: "Prefeitura de Três Lagoas",
    publishedAt: "2025-04-01",
    featured: false,
  },
  {
    title: "Misto desiste da disputa do Sul-Mato-Grossense Série B em 2024",
    summary: "O presidente do clube de Três Lagoas alegou falta de recursos financeiros para a desistência da competição estadual.",
    category: "futebol_profissional",
    imageUrl: "/news/misto-desiste-serie-b.jpg",
    sourceUrl: "https://www.campograndenews.com.br/esportes/misto-desiste-da-disputa-do-sul-mato-grossense-serie-b-em-2024",
    source: "Campo Grande News",
    publishedAt: "2024-08-30",
    featured: false,
  },
  {
    title: "Misto EC é escolhido para representar Três Lagoas no futebol profissional",
    summary: "O Misto Esporte Clube foi escolhido para representar a cidade de Três Lagoas no futebol profissional de Mato Grosso do Sul.",
    category: "institucional",
    imageUrl: "/news/misto-representante-tl.jpeg",
    sourceUrl: "https://www.hojemais.com.br/tres-lagoas/noticia/esporte/misto-ec-e-escolhido-para-representar-tres-lagoas-no-futebol-profissional",
    source: "HojeMais Três Lagoas",
    publishedAt: "2024-01-01",
    featured: false,
  },
  {
    title: "Corinthians bate Misto e elimina jogo de volta pela Copa do Brasil",
    summary: "Com placar elástico, o Corinthians eliminou o Misto ainda no jogo de ida da Copa do Brasil 2009, dispensando a partida de volta.",
    category: "futebol_profissional",
    imageUrl: "/news/misto-corinthians-copa-brasil.jpg",
    sourceUrl: "https://cidadeverde.com/noticias/36123/corinthians-bate-misto-e-elimina-jogo-de-volta-pela-copa-do-brasil",
    source: "Cidade Verde",
    publishedAt: "2009-04-15",
    featured: false,
  },
  {
    title: "Jogo do Misto contra o Corinthians será no Morenão",
    summary: "A partida do Misto Esporte Clube contra o Corinthians pela Copa do Brasil será realizada no Estádio Morenão, em Campo Grande/MS.",
    category: "futebol_profissional",
    imageUrl: "/news/misto-corinthians-morenao.jpg",
    sourceUrl: "https://www.treslagoas.ms.gov.br/jogo-do-misto-contra-o-corinthians-sera-no-morenao/",
    source: "Prefeitura de Três Lagoas",
    publishedAt: "2009-03-09",
    featured: false,
  },
];

// ─── board_members ────────────────────────────────────────────────────────────

const boardRows: (typeof schema.boardMembers.$inferInsert)[] = [
  { name: "Antônio Carlos Teixeira de Freitas", role: "Presidente", profession: "Empresário — Tietê Mat Construção", photoUrl: "/board/teixeira.png", group: "executive", order: 1 },
  { name: "Joaquim Romero Barbosa", role: "Vice-Presidente", profession: "Empresário — Nova Estrela Supermercados", photoUrl: "/board/joaquim-romero.png", group: "executive", order: 2 },
  { name: "Joaquim Pedro Barbosa Sanches", role: "Tesoureiro", profession: "Empresário — Nova Estrela Supermercados", photoUrl: "/board/joaquim-pedro.png", group: "executive", order: 3 },
  { name: "Kuesley Fernandes do Nascimento", role: "Secretário", profession: "Empresário · Play55 Tecnologias", photoUrl: "/board/kuesley-fernandes.png", group: "executive", order: 4 },
  { name: "Jefferson José Gonçalves", role: "Diretor das Categorias de Base", profession: "Empresário — Colégio Unitrês Objetivo", photoUrl: "/board/jefferson.png", group: "executive", order: 5 },
  { name: "Pedro Bonfietti", role: "Diretor Jurídico", profession: "Advogado", photoUrl: "/board/pedro-bonfietti.png", group: "executive", order: 6 },
  { name: "Adilson Popó", role: "Diretor de Esportes", profession: "Empresário — Escolinha de Futebol", photoUrl: "/board/adilson-popo.jpg", group: "executive", order: 7 },
  { name: "Orlando Vicente Abate Sacchi", role: "Titular", profession: "Delegado de Polícia Aposentado", photoUrl: "/board/orlando-vicente.png", group: "fiscal", fiscalType: "titular", order: 1 },
  { name: "Antonio Carlos Noia", role: "Titular", profession: "Funcionário Público Aposentado", photoUrl: "/board/antonio-noia.png", group: "fiscal", fiscalType: "titular", order: 2 },
  { name: "Alessandro Rodrigues dos Santos", role: "Titular", profession: "Empresário", photoUrl: "/board/alessandro.png", group: "fiscal", fiscalType: "titular", order: 3 },
  { name: "Adriano Ferreira de Souza", role: "Suplente", profession: "Vendedor", photoUrl: "/board/adriano-ferreira.jpg", group: "fiscal", fiscalType: "suplente", order: 4 },
  { name: "Donizetti da Silva Lopes", role: "Suplente", profession: "Funcionário Público Aposentado", photoUrl: "/board/donizetti.png", group: "fiscal", fiscalType: "suplente", order: 5 },
  { name: "José Roberto Rodrigues", role: "Suplente", profession: "Aposentado", photoUrl: "/board/jose-roberto.jpg", group: "fiscal", fiscalType: "suplente", order: 6 },
  { name: "Fábio de Camargo", role: "Suplente", profession: "Empresário — Brasil Grill", photoUrl: "/board/fabio-camargo.jpg", group: "fiscal", fiscalType: "suplente", order: 7 },
];

// ─── legends ──────────────────────────────────────────────────────────────────

const legendsRows: (typeof schema.legends.$inferInsert)[] = [
  { name: "Mi Santa Luzia", photoUrl: "/legends/mi-santaluzia.jpg", order: 1 },
  { name: "Júlio Primavera", photoUrl: "/legends/julio-primavera.jpg", order: 2 },
  { name: "Crystiano", photoUrl: "/legends/cristiano.png", order: 3 },
  { name: "Olair", photoUrl: "/legends/olair.png", order: 4 },
  { name: "Maringá", photoUrl: "/legends/maringa.jpg", order: 5 },
  { name: "Bruno Diniz", photoUrl: "/legends/bruno.png", order: 6 },
  { name: "Célio", photoUrl: "/legends/celio.jpg", order: 7 },
  { name: "Arthur Hassam", photoUrl: "/legends/arthur.jpg", order: 8 },
  { name: "Digue", photoUrl: "/legends/digue.jpg", order: 9 },
  { name: "Ângelo", photoUrl: "/legends/angelo.png", order: 10 },
  { name: "Kayo", photoUrl: "/legends/kayo.png", order: 11 },
  { name: "Hodirley (Tranin)", photoUrl: "/legends/legend-1.jpg", order: 12 },
  { name: "Giordan (Belisca)", photoUrl: "/legends/legend-2.jpg", order: 13 },
  { name: "Jean (Vinícius)", photoUrl: "/legends/legend-3.jpg", order: 14 },
  { name: "Rodrigo Goiano", photoUrl: "/legends/legend-4.jpg", order: 15 },
];

// ─── personalities ────────────────────────────────────────────────────────────

const personalitiesRows: (typeof schema.personalities.$inferInsert)[] = [
  { name: "Dr. Joel", photoUrl: "/legends/joel.png", role: "Médico do clube", category: "medicos", order: 1 },
  { name: "Dr. Ari Arão", photoUrl: "/legends/ary-arao.png", role: "Médico do clube", category: "medicos", order: 2 },
  { name: "Dr. Nivaldo", photoUrl: "/legends/dr-nivaldo.png", role: "Médico do clube", category: "medicos", order: 3 },
  { name: "Ramão", role: "Técnico", category: "tecnicos", order: 1 },
  { name: "Amarildo Carvalho", role: "Técnico", category: "tecnicos", order: 2 },
];

// ─── timeline_events ──────────────────────────────────────────────────────────

const timelineRows: (typeof schema.timelineEvents.$inferInsert)[] = [
  { year: "1993", title: "Fundação do Clube", description: "Em 14 de abril de 1993, nasce o Misto Esporte Clube em Três Lagoas/MS.", order: 1 },
  { year: "2000", title: "Primeira Participação Estadual", description: "O Misto estreia oficialmente no Campeonato Sul-Mato-Grossense.", order: 2 },
  { year: "2010", title: "Título Histórico", description: "Conquista marcante que consolidou o clube no cenário estadual.", order: 3 },
  { year: "2020", title: "Reestruturação e Modernização", description: "Nova diretoria implementa gestão profissional e investe nas categorias de base.", order: 4 },
  { year: "2026", title: "Objetivo: Série A", description: "Com elenco competitivo, o Misto busca o acesso à primeira divisão estadual.", order: 5 },
];

// ─── sponsors ─────────────────────────────────────────────────────────────────

const sponsorsRows: (typeof schema.sponsors.$inferInsert)[] = [
  { name: "Sicredi",                logoUrl: "/__l5e/assets-v1/cf1b49d6-ca55-430f-ad21-60f3becea8d7/sicredi.png",        logoTone: "light", tier: "diamante", instagramUrl: "https://www.instagram.com/p/DYr0PF4BQ2y/", order: 1 },
  { name: "Supermercado Nova Estrela", logoUrl: "/nova-estrela-logo.avif",                                               logoTone: "light", tier: "ouro",     instagramUrl: "https://www.instagram.com/p/DYryq1dOOsU/", order: 1 },
  { name: "Concreluz",              logoUrl: "/__l5e/assets-v1/a8d175c6-0141-4c8b-a861-e2a4ec236421/concreluz.png",      logoTone: "dark",  tier: "ouro",     instagramUrl: "https://www.instagram.com/p/DYr1SHCOm5q/", order: 2 },
  { name: "Unopar",                 logoUrl: "/__l5e/assets-v1/3af15264-a8bd-4421-a19a-b30973ae52f4/unopar.png",         logoTone: "light", tier: "prata",    instagramUrl: "https://www.instagram.com/p/DYr1bl3Pitc/", order: 1 },
  { name: "Daikin",                 logoUrl: "/__l5e/assets-v1/5bee6845-be8c-47da-ab78-e376164d6c9c/daikin.png",         logoTone: "light", tier: "prata",    instagramUrl: "https://www.instagram.com/p/DYr1n84P71v/", order: 2 },
];

// ─── products ─────────────────────────────────────────────────────────────────

const productsRows: (typeof schema.products.$inferInsert)[] = [
  { name: "Camisa Oficial Preta",      slug: "camisa-oficial-preta",    category: "camisa_oficial",  priceCents: 19900, imageUrl: "/shop/camiseta-preta.png" },
  { name: "Camisa Oficial Branca",     slug: "camisa-oficial-branca",   category: "camisa_oficial",  priceCents: 19900, imageUrl: "/shop/camiseta-branca.png" },
  { name: "Camisa de Torcedor Preta",  slug: "camisa-torcedor-preta",  category: "camisa_torcedor", priceCents: 10900, imageUrl: "/shop/camiseta-preta.png" },
  { name: "Camisa de Torcedor Branca", slug: "camisa-torcedor-branca", category: "camisa_torcedor", priceCents: 10900, imageUrl: "/shop/camiseta-branca.png" },
  { name: "Camisa de Torcedor Rosa",   slug: "camisa-torcedor-rosa",   category: "camisa_torcedor", priceCents: 10900, imageUrl: "/shop/camiseta-rosa.png" },
];

// ─── membership (v2 — seed de referência apenas) ──────────────────────────────

const plansRows: (typeof schema.membershipPlans.$inferInsert)[] = [
  { name: "Raiz", slug: "raiz", icon: "Leaf", priceCents: 990, highlight: false, order: 1 },
  { name: "Torcedor", slug: "torcedor", icon: "Shield", priceCents: 1990, highlight: false, order: 2 },
  { name: "Carcará", slug: "carcara", icon: "Bird", priceCents: 3990, highlight: true, order: 3 },
  { name: "Elite", slug: "elite", icon: "Crown", priceCents: 7990, highlight: false, order: 4 },
  { name: "Empresarial", slug: "empresarial", icon: "Building2", priceCents: 19900, highlight: false, order: 5 },
];

const benefitsRows: (typeof schema.membershipBenefits.$inferInsert)[] = [
  { label: "Carteirinha digital", order: 1 },
  { label: "Participação em sorteios mensais", order: 2 },
  { label: "Grupo exclusivo (WhatsApp/Telegram)", order: 3 },
  { label: "Nome no mural digital do clube", order: 4 },
  { label: "5% desconto em produtos oficiais", order: 5 },
  { label: "Prioridade na compra de ingressos", order: 6 },
  { label: "Desconto em ingressos (10% a 20%)", order: 7 },
  { label: "Conteúdos exclusivos (bastidores, vídeos)", order: 8 },
  { label: "1 ingresso gratuito por mês", order: 9 },
  { label: "Nome em painel físico no estádio", order: 10 },
  { label: "Camiseta oficial anual", order: 11 },
  { label: "Área exclusiva no estádio", order: 12 },
  { label: "Meet & greet com jogadores", order: 13 },
  { label: "Divulgação da empresa nas redes do clube", order: 14 },
  { label: "Networking com diretoria e patrocinadores", order: 15 },
];

// ─── runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Starting seed...\n");

  // site_config — upsert por chave
  console.log("→ site_config");
  for (const row of configRows) {
    await db
      .insert(schema.siteConfig)
      .values(row)
      .onConflictDoUpdate({ target: schema.siteConfig.key, set: { value: row.value, type: row.type, description: row.description } });
  }

  // games — delete+insert para garantir dados atualizados
  console.log("→ games");
  await db.delete(schema.games);
  await db.insert(schema.games).values(gamesRows);

  // news — delete+insert
  console.log("→ news");
  await db.delete(schema.news);
  await db.insert(schema.news).values(newsRows);

  // board_members — delete+insert
  console.log("→ board_members");
  await db.delete(schema.boardMembers);
  await db.insert(schema.boardMembers).values(boardRows);

  // legends — delete+insert
  console.log("→ legends");
  await db.delete(schema.legends);
  await db.insert(schema.legends).values(legendsRows);

  // personalities — delete+insert
  console.log("→ personalities");
  await db.delete(schema.personalities);
  await db.insert(schema.personalities).values(personalitiesRows);

  // timeline_events — delete+insert
  console.log("→ timeline_events");
  await db.delete(schema.timelineEvents);
  await db.insert(schema.timelineEvents).values(timelineRows);

  // sponsors — delete+insert
  console.log("→ sponsors");
  await db.delete(schema.sponsors);
  await db.insert(schema.sponsors).values(sponsorsRows);

  // products — upsert por slug
  console.log("→ products");
  for (const row of productsRows) {
    await db
      .insert(schema.products)
      .values(row)
      .onConflictDoUpdate({ target: schema.products.slug, set: { name: row.name, priceCents: row.priceCents, imageUrl: row.imageUrl ?? null } });
  }

  // membership_plans (v2 seed)
  console.log("→ membership_plans (v2)");
  for (const row of plansRows) {
    await db
      .insert(schema.membershipPlans)
      .values(row)
      .onConflictDoUpdate({ target: schema.membershipPlans.slug, set: { name: row.name, priceCents: row.priceCents, highlight: row.highlight } });
  }

  // membership_benefits (v2 seed)
  console.log("→ membership_benefits (v2)");
  await db.insert(schema.membershipBenefits).values(benefitsRows).onConflictDoNothing();

  console.log("\n✅ Seed completed successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
