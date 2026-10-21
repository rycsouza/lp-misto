import { z } from "zod";
import { MEMBER_CARD_BACKGROUND_KEYS } from "@/lib/membership/card-background";
import { ANDROID_APP_KEYS } from "@/lib/android-app/assetlinks";
import { MEMBERSHIP_PROGRAM_NAME_KEY } from "@/lib/membership/program-name";

/**
 * Política de CHAVES de configuração (tabela siteConfig) gravadas por
 * `updateConfigValues` (src/app/actions/admin.ts).
 *
 * Módulo puro, SEM "use server" (server actions só podem exportar funções async).
 *
 * Regra de acesso:
 * - admin do CLUBE (role admin, sem isPlatform): só grava as chaves "tenant".
 *   Chave "platform" enviada com o MESMO valor atual no banco é ignorada (é o
 *   caso dos inputs hidden de mídia). Com valor DIFERENTE: recusa tudo.
 * - admin do SISTEMA (isPlatform): grava qualquer chave conhecida (tenant + platform).
 * - chave DESCONHECIDA (fora das listas e dos padrões): recusada para todos.
 *
 * INVENTÁRIO: quem grava o quê (mantenha em dia ao criar uma tela nova).
 *
 * Aba "Clube" (?tab=clube) — ConfigFormContact (src/components/admin/ConfigForm.tsx)
 *   tenant:   siteName, tagline, description, city, foundedYear, keywords,
 *             whatsapp, email, instagram, membershipProgramName (nome do programa de
 *             sócio: valor validado em src/lib/membership/program-name.ts)
 *   platform: clubLogoUrl, faviconUrl, heroImageUrl, heroStats (mídia). Para o
 *             admin do clube a página envia os valores atuais em hidden inputs;
 *             heroStats NÃO é hidden: ConfigFormContact o omite quando showMedia=false.
 *
 * Aba "Retirada" — ConfigFormPickup: pickupEnabled, pickupLocations (tenant).
 *
 * Visual da carteirinha (src/app/admin/(panel)/socios/carteirinha) — action própria
 *   updateMemberCardBackgroundAdmin (membership.ts, guarda do módulo socios): grava as
 *   3 chaves abaixo, validadas. Também tenant aqui, para o admin do clube; por isso
 *   updateConfigValues valida o VALOR delas (URL do destino de upload, fit, opacidade).
 *   memberCardBackgroundUrl, memberCardBackgroundFit, memberCardBackgroundOpacity,
 *   memberCardBackgroundBlend (tenant).
 *
 * Aba "Seções" — SectionToggles: section.<key>.enabled e section.<key>.order,
 *   para <key> em SECTION_KEYS (tenant). Mais um toggle fora da lista ordenável:
 *   section.member_wall.enabled (mural dos sócios, só liga/desliga; tenant).
 *
 * Abas só do admin do sistema (PLATFORM_ONLY_TABS em configuracoes/page.tsx):
 *   "App Android" — ConfigFormAndroid (src/components/admin/ConfigFormAndroid.tsx):
 *             androidPackageName, androidCertFingerprints (platform). Valor validado
 *             em src/lib/android-app/assetlinks.ts; publicado em /.well-known/assetlinks.json.
 *   "Aparência" — ConfigFormTheme: primaryColor, accentColor.
 *   "Loja" — ConfigFormShipping: shippingEnabled, shippingOriginCep, shippingFreeAboveCents.
 *   "Segurança" — ConfigFormSecurity: sessionDurationHours.
 *   "Ingressos" — a página hoje só renderiza TicketTypesEditor (catálogo em
 *     ticket-types.ts, que não usa esta action). ConfigFormPrices (ticketPriceInteiraCents,
 *     ticketPriceMeiaCents, meiaEligibilityLabel), ConfigFormBundle (ticketBundleTiers,
 *     ticketBundleTypeCodes) e ConfigFormShop (shopLowStockThreshold) existem mas não
 *     são renderizados. Ainda assim as chaves são do sistema: ticketPriceInteiraCents
 *     é lido por src/lib/tickets/resolve.ts (preço = risco Grave se alterado pelo clube).
 *   Sem tela: raffleNumberPriceCents (sorteios desligados, RAFFLES_ENABLED = false).
 *
 * Agente IA (src/lib/agent/executor.ts, update_site_config): whatsapp, email,
 *   instagram (tenant); ticketPriceInteiraCents, ticketPriceMeiaCents (platform).
 *   Com o admin do clube, o agente recebe "Não autorizado." ao tentar alterar preço.
 *
 * Fora desta política (gravadas por outras actions, não por updateConfigValues):
 *   cantina.serviceFeeType/Value e cantina.minOrderCents (cantina.ts),
 *   athlete_invite_code (athletes.ts).
 */

/** Chaves gravadas pela aba Clube sem mídia: visíveis ao admin do clube. */
export const TENANT_CLUB_KEYS = [
  "siteName",
  "tagline",
  "description",
  "city",
  "foundedYear",
  "keywords",
  "whatsapp",
  "email",
  "instagram",
  MEMBERSHIP_PROGRAM_NAME_KEY,
] as const;

/** Chaves da aba Retirada: visíveis ao admin do clube. */
export const TENANT_PICKUP_KEYS = ["pickupEnabled", "pickupLocations"] as const;

/** Fundo da carteirinha (página Visual da carteirinha, módulo socios). */
export const TENANT_MEMBER_CARD_KEYS = MEMBER_CARD_BACKGROUND_KEYS;

/** Seções da home que a aba Seções controla (mesma lista de src/app/(site)/page.tsx). */
export const SECTION_KEYS = [
  "hero",
  "ticket_highlight",
  "news",
  "squad",
  "board",
  "history",
  "membership",
  "sponsors",
  "shop",
  "raffle",
] as const;

/** Campos por seção gravados pela aba Seções. */
export const SECTION_FIELDS = ["enabled", "order"] as const;

/**
 * Mural dos sócios na home: toggle próprio, FORA de SECTION_KEYS (não tem ordem: fica sempre
 * acima dos planos, dentro da seção de sócio). Não entra em SECTION_KEYS porque aquela lista
 * também libera section.<key>.order.
 */
export const MEMBER_WALL_KEY = "section.member_wall.enabled";

/** Chaves de toggle da home que o admin do clube grava (só liga/desliga). */
export const TENANT_HOME_TOGGLE_KEYS = [MEMBER_WALL_KEY] as const;

/**
 * Chaves só do admin do sistema. Inclui a mídia da aba Clube (escudo, favicon,
 * hero, destaques), que o admin do clube não edita e envia apenas como valor atual.
 */
export const PLATFORM_KEYS = [
  // Mídia (aba Clube, mas gate de plataforma)
  "clubLogoUrl",
  "faviconUrl",
  "heroImageUrl",
  "heroStats",
  // App Android (TWA): Digital Asset Links do clube
  ...ANDROID_APP_KEYS,
  // Aparência
  "primaryColor",
  "accentColor",
  // Loja (frete e estoque)
  "shippingEnabled",
  "shippingOriginCep",
  "shippingFreeAboveCents",
  "shopLowStockThreshold",
  // Segurança
  "sessionDurationHours",
  // Ingressos (preços e combos) e legado de sorteio
  "ticketPriceInteiraCents",
  "ticketPriceMeiaCents",
  "meiaEligibilityLabel",
  "ticketBundleTiers",
  "ticketBundleTypeCodes",
  "raffleNumberPriceCents",
] as const;

/** Acesso de uma chave: "tenant" = admin do clube pode gravar; "platform" = só admin do sistema; "unknown" = recusada. */
export type ConfigKeyAccess = "tenant" | "platform" | "unknown";

const TENANT_SET: ReadonlySet<string> = new Set<string>([
  ...TENANT_CLUB_KEYS,
  ...TENANT_PICKUP_KEYS,
  ...TENANT_MEMBER_CARD_KEYS,
  ...TENANT_HOME_TOGGLE_KEYS,
]);
const PLATFORM_SET: ReadonlySet<string> = new Set<string>(PLATFORM_KEYS);
const SECTION_SET: ReadonlySet<string> = new Set<string>(SECTION_KEYS);
const SECTION_FIELD_SET: ReadonlySet<string> = new Set<string>(SECTION_FIELDS);

/**
 * Classifica uma chave. Usa Set (sem lookup em objeto), então chaves como
 * "constructor" ou "__proto__" caem em "unknown".
 */
export function configKeyAccess(key: string): ConfigKeyAccess {
  if (TENANT_SET.has(key)) return "tenant";
  if (PLATFORM_SET.has(key)) return "platform";
  const m = /^section\.([a-z_]+)\.([a-z]+)$/.exec(key);
  if (m && SECTION_SET.has(m[1]) && SECTION_FIELD_SET.has(m[2])) return "tenant";
  return "unknown";
}

/**
 * Valor de um toggle da home: o mural dos sócios aceita só "true" ou "false" (o resto é recusado
 * antes de gravar). Chaves sem regra própria passam aqui sem checagem extra.
 */
export function isValidHomeToggleValue(key: string, value: string): boolean {
  if (key === MEMBER_WALL_KEY) return value === "true" || value === "false";
  return true;
}

/** Limites do payload de `updateConfigValues`. */
export const CONFIG_UPDATES_MAX_KEYS = 100;
export const CONFIG_KEY_MAX_CHARS = 100;
export const CONFIG_VALUE_MAX_CHARS = 20_000;

/**
 * Payload: objeto plano com chaves e valores string. Rejeita arrays, números,
 * booleanos, null, objetos aninhados e listas vazias ou com mais de 100 chaves.
 */
export const configUpdatesSchema = z
  .record(
    z.string().min(1).max(CONFIG_KEY_MAX_CHARS),
    z.string().max(CONFIG_VALUE_MAX_CHARS),
  )
  .refine((o) => {
    const n = Object.keys(o).length;
    return n >= 1 && n <= CONFIG_UPDATES_MAX_KEYS;
  });
