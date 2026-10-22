import { and, eq, inArray, ne, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import {
  members,
  membershipBenefits,
  membershipPlans,
  planBenefits,
} from "@/lib/db/schema";
import { endOfDaySaoPaulo } from "./plan-benefits";
import { PLAN_AUDIENCES } from "./plan-audience";

/**
 * Escrita dos planos de sócio no admin. INTERNO: fica fora dos arquivos "use
 * server" (lá só entram as actions, que chamam requireModule antes). Tudo que
 * muda mais de uma linha vai num db.batch (o driver neon-http não tem
 * transaction; o batch roda como uma transação só).
 */

type Db = Awaited<ReturnType<typeof getDb>>;
type BatchQuery = Parameters<Db["batch"]>[0][number];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const pct = z.number({ error: "Percentual inválido" }).int("Percentual deve ser inteiro").min(0, "Percentual entre 0 e 100").max(100, "Percentual entre 0 e 100");
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullish()
    .transform((v) => (v ? v : null));

const promoEndsAtSchema = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || endOfDaySaoPaulo(v) !== null, "Data-limite inválida")
  .transform((v) => (v ? endOfDaySaoPaulo(v) : null));

/** Campos do plano vindos do formulário/agente. Campos extras são descartados (sem mass assignment). */
export const planFieldsSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(60, "Nome muito longo"),
  // Público: pessoa física (CPF) ou empresa (CNPJ). Enum estrito; define a adesão.
  audience: z.enum(PLAN_AUDIENCES, { error: "Tipo de plano inválido" }),
  slug: z
    .string()
    .trim()
    .min(2, "Slug muito curto")
    .max(60, "Slug muito longo")
    .regex(SLUG_RE, "Slug só pode ter letras minúsculas, números e hífens"),
  icon: z.string().trim().min(1).max(40).optional(),
  description: optionalText(140, "Descrição muito longa"),
  priceCents: z
    .number({ error: "Preço inválido" })
    .int("Preço inválido")
    .min(0, "Preço inválido")
    .max(10_000_000, "Preço acima do limite"),
  ticketDiscountPct: pct,
  productDiscountPct: pct,
  freeTicketsPerHomeGame: z
    .number({ error: "Ingressos grátis inválidos" })
    .int("Ingressos grátis devem ser inteiros")
    .min(0, "Ingressos grátis entre 0 e 10")
    .max(10, "Ingressos grátis entre 0 e 10"),
  firstMonthFree: z.boolean(),
  promoEndsAt: promoEndsAtSchema,
  highlightLabel: z
    .string()
    .trim()
    .max(24, "Etiqueta do destaque: no máximo 24 caracteres")
    .nullish()
    .transform((v) => (v ? v : null)),
  cardColor: z
    .string()
    .trim()
    .regex(HEX_COLOR_RE, "Cor inválida (use #RRGGBB)")
    .nullish()
    .transform((v) => (v ? v.toLowerCase() : null)),
  highlight: z.boolean(),
  active: z.boolean(),
  order: z.number().int("Ordem inválida").min(0, "Ordem inválida").max(999, "Ordem inválida"),
});

export type PlanFieldsInput = z.input<typeof planFieldsSchema>;
export type PlanFields = z.output<typeof planFieldsSchema>;

/** Atualização parcial (agente/atalhos): só o que vier é gravado. */
export const planPatchSchema = planFieldsSchema.partial();

const benefitLinkSchema = z.object({
  benefitId: z.uuid("Benefício inválido"),
  detail: optionalText(60, "Detalhe: no máximo 60 caracteres"),
});

export type BenefitLinkInput = z.input<typeof benefitLinkSchema>;
export type BenefitLink = z.output<typeof benefitLinkSchema>;

/** Benefícios de UM plano: sem repetição. */
export const planBenefitLinksSchema = z
  .array(benefitLinkSchema)
  .max(100, "Benefícios demais")
  .superRefine((links, ctx) => {
    const seen = new Set<string>();
    for (const link of links) {
      if (seen.has(link.benefitId)) {
        ctx.addIssue({ code: "custom", message: "Benefício repetido" });
        return;
      }
      seen.add(link.benefitId);
    }
  });

/** Matriz inteira: planos (colunas) e células marcadas "inclui" (linha × coluna). */
export const benefitMatrixSchema = z
  .object({
    planIds: z.array(z.uuid("Plano inválido")).max(50, "Planos demais"),
    cells: z
      .array(
        z.object({
          benefitId: z.uuid("Benefício inválido"),
          planId: z.uuid("Plano inválido"),
          detail: optionalText(60, "Detalhe: no máximo 60 caracteres"),
        })
      )
      .max(5000, "Matriz grande demais"),
  })
  .superRefine((matrix, ctx) => {
    const planSet = new Set(matrix.planIds);
    if (planSet.size !== matrix.planIds.length) {
      ctx.addIssue({ code: "custom", message: "Plano repetido na matriz", path: ["planIds"] });
    }
    const pairs = new Set<string>();
    for (const cell of matrix.cells) {
      if (!planSet.has(cell.planId)) {
        ctx.addIssue({ code: "custom", message: "Célula de plano fora da matriz", path: ["cells"] });
        return;
      }
      const key = `${cell.benefitId}|${cell.planId}`;
      if (pairs.has(key)) {
        ctx.addIssue({ code: "custom", message: "Célula repetida", path: ["cells"] });
        return;
      }
      pairs.add(key);
    }
  });

export type BenefitMatrixInput = z.input<typeof benefitMatrixSchema>;
export type BenefitMatrix = z.output<typeof benefitMatrixSchema>;

/** Tipo (CPF/CNPJ) muda o documento da adesão: só é trocado enquanto o plano não tem sócios. */
const AUDIENCE_LOCKED_MESSAGE =
  "Este plano já tem sócios. Não dá para trocar o tipo (CPF/CNPJ) depois que ele tem sócios.";

export class PlanAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanAdminError";
  }
}

async function assertBenefitsExist(db: Db, benefitIds: string[]): Promise<void> {
  const unique = [...new Set(benefitIds)];
  if (unique.length === 0) return;
  const rows = await db
    .select({ id: membershipBenefits.id })
    .from(membershipBenefits)
    .where(inArray(membershipBenefits.id, unique));
  if (rows.length !== unique.length) {
    throw new PlanAdminError("Benefício não encontrado. Atualize a página e tente de novo.");
  }
}

async function assertPlansExist(db: Db, planIds: string[]): Promise<void> {
  const unique = [...new Set(planIds)];
  if (unique.length === 0) return;
  const rows = await db
    .select({ id: membershipPlans.id })
    .from(membershipPlans)
    .where(inArray(membershipPlans.id, unique));
  if (rows.length !== unique.length) {
    throw new PlanAdminError("Plano não encontrado. Atualize a página e tente de novo.");
  }
}

async function assertSlugFree(db: Db, slug: string, exceptId: string | null): Promise<void> {
  const rows = await db
    .select({ id: membershipPlans.id })
    .from(membershipPlans)
    .where(
      exceptId
        ? and(eq(membershipPlans.slug, slug), ne(membershipPlans.id, exceptId))
        : eq(membershipPlans.slug, slug)
    )
    .limit(1);
  if (rows.length > 0) throw new PlanAdminError("Já existe um plano com este slug.");
}

function runBatch(db: Db, queries: BatchQuery[]): Promise<unknown> {
  const [first, ...rest] = queries;
  if (!first) return Promise.resolve();
  return db.batch([first, ...rest] as [BatchQuery, ...BatchQuery[]]);
}

/**
 * Cria (planId null) ou atualiza um plano e substitui seus benefícios, tudo num
 * batch. Se o plano vai ser destaque, os outros do MESMO público (CPF ou CNPJ) perdem o
 * destaque no mesmo batch.
 * `benefits` undefined = não mexe nos benefícios.
 */
export async function savePlan(
  db: Db,
  planId: string | null,
  fields: PlanFields,
  benefits?: BenefitLink[]
): Promise<{ id: string }> {
  if (planId) {
    const [existing] = await db
      .select({ id: membershipPlans.id, audience: membershipPlans.audience })
      .from(membershipPlans)
      .where(eq(membershipPlans.id, planId))
      .limit(1);
    if (!existing) throw new PlanAdminError("Plano não encontrado.");
    if (existing.audience !== fields.audience) {
      // Sócio (ativo, pendente ou com troca agendada) já amarrado ao plano: não muda o tipo.
      const [linked] = await db
        .select({ id: members.id })
        .from(members)
        .where(or(eq(members.planId, planId), eq(members.pendingPlanId, planId)))
        .limit(1);
      if (linked) throw new PlanAdminError(AUDIENCE_LOCKED_MESSAGE);
    }
  }
  await assertSlugFree(db, fields.slug, planId);
  if (benefits) await assertBenefitsExist(db, benefits.map((b) => b.benefitId));

  const id = planId ?? crypto.randomUUID();
  const values = {
    name: fields.name,
    slug: fields.slug,
    audience: fields.audience,
    ...(fields.icon !== undefined ? { icon: fields.icon } : {}),
    description: fields.description,
    priceCents: fields.priceCents,
    ticketDiscountPct: fields.ticketDiscountPct,
    productDiscountPct: fields.productDiscountPct,
    freeTicketsPerHomeGame: fields.freeTicketsPerHomeGame,
    firstMonthFree: fields.firstMonthFree,
    promoEndsAt: fields.promoEndsAt,
    highlightLabel: fields.highlightLabel,
    cardColor: fields.cardColor,
    highlight: fields.highlight,
    active: fields.active,
    order: fields.order,
  };

  const queries: BatchQuery[] = [];
  if (planId) {
    queries.push(db.update(membershipPlans).set(values).where(eq(membershipPlans.id, id)));
  } else {
    queries.push(
      db.insert(membershipPlans).values({ id, icon: fields.icon ?? "Star", ...values })
    );
  }
  if (fields.highlight) {
    queries.push(
      db
        .update(membershipPlans)
        .set({ highlight: false })
        // Um destaque por público: cada grupo da vitrine (CPF e CNPJ) tem o seu.
        .where(
          and(
            eq(membershipPlans.highlight, true),
            eq(membershipPlans.audience, fields.audience),
            ne(membershipPlans.id, id)
          )
        )
    );
  }
  if (benefits) {
    queries.push(db.delete(planBenefits).where(eq(planBenefits.planId, id)));
    if (benefits.length > 0) {
      queries.push(
        db.insert(planBenefits).values(
          benefits.map((b) => ({ planId: id, benefitId: b.benefitId, included: true, detail: b.detail }))
        )
      );
    }
  }
  await runBatch(db, queries);
  return { id };
}

/**
 * Atualização parcial (agente): lê o plano atual, aplica só os campos enviados e
 * regrava pelo mesmo caminho do formulário (validação de slug, destaque único).
 */
export async function patchPlan(
  db: Db,
  planId: string,
  patch: Partial<PlanFields>
): Promise<{ id: string }> {
  const [row] = await db
    .select()
    .from(membershipPlans)
    .where(eq(membershipPlans.id, planId))
    .limit(1);
  if (!row) throw new PlanAdminError("Plano não encontrado.");

  const current: PlanFields = {
    name: row.name,
    slug: row.slug,
    audience: row.audience === "pj" ? "pj" : "pf",
    icon: row.icon,
    description: row.description ?? null,
    priceCents: row.priceCents,
    ticketDiscountPct: row.ticketDiscountPct,
    productDiscountPct: row.productDiscountPct,
    freeTicketsPerHomeGame: row.freeTicketsPerHomeGame,
    firstMonthFree: row.firstMonthFree,
    promoEndsAt: row.promoEndsAt ?? null,
    highlightLabel: row.highlightLabel ?? null,
    cardColor: row.cardColor ?? null,
    highlight: row.highlight,
    active: row.active,
    order: row.order,
  };
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined)
  ) as Partial<PlanFields>;
  return savePlan(db, planId, { ...current, ...defined });
}

/** Só troca os benefícios de um plano (com detalhe), atomicamente. */
export async function replacePlanBenefits(
  db: Db,
  planId: string,
  benefits: BenefitLink[]
): Promise<void> {
  await assertPlansExist(db, [planId]);
  await assertBenefitsExist(db, benefits.map((b) => b.benefitId));
  const queries: BatchQuery[] = [db.delete(planBenefits).where(eq(planBenefits.planId, planId))];
  if (benefits.length > 0) {
    queries.push(
      db.insert(planBenefits).values(
        benefits.map((b) => ({ planId, benefitId: b.benefitId, included: true, detail: b.detail }))
      )
    );
  }
  await runBatch(db, queries);
}

/**
 * Grava a matriz da tela de benefícios: para cada plano listado, apaga os vínculos
 * atuais e insere as células marcadas. Planos fora da lista não são tocados.
 */
export async function saveBenefitMatrix(db: Db, matrix: BenefitMatrix): Promise<void> {
  if (matrix.planIds.length === 0) return;
  await assertPlansExist(db, matrix.planIds);
  await assertBenefitsExist(db, matrix.cells.map((c) => c.benefitId));
  const queries: BatchQuery[] = [db.delete(planBenefits).where(inArray(planBenefits.planId, matrix.planIds))];
  if (matrix.cells.length > 0) {
    queries.push(
      db.insert(planBenefits).values(
        matrix.cells.map((c) => ({ planId: c.planId, benefitId: c.benefitId, included: true, detail: c.detail }))
      )
    );
  }
  await runBatch(db, queries);
}
