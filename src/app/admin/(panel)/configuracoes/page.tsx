export const dynamic = "force-dynamic";

import { getAdminConfigRows, getAdminGateways } from "@/app/actions/admin";
import {
  ConfigFormContact,
  ConfigFormSecurity,
  ConfigFormShipping,
  ConfigFormPickup,
} from "@/components/admin/ConfigForm";
import type { PickupLocation } from "@/lib/config";
import { ConfigFormTheme } from "@/components/admin/ConfigFormTheme";
import { SectionToggles } from "@/components/admin/SectionToggles";
import { GatewayActions } from "@/components/admin/GatewayActions";
import { TicketTypesEditor } from "@/components/admin/TicketTypesEditor";
import {
  getTicketTypesAdmin,
  ensureDefaultGlobalTypes,
} from "@/app/actions/ticket-types";
import Link from "next/link";
import { Plus } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getConfigValue(
  rows: { key: string; value: string }[],
  key: string,
  fallback: string
): string {
  return rows.find((r) => r.key === key)?.value ?? fallback;
}

function parsePickupLocationsRows(
  rows: { key: string; value: string }[]
): PickupLocation[] {
  const raw = rows.find((r) => r.key === "pickupLocations")?.value;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
      .map((l) => ({
        id: String(l.id ?? crypto.randomUUID()),
        name: String(l.name ?? ""),
        address: String(l.address ?? ""),
        hours: String(l.hours ?? ""),
      }))
      .filter((l) => l.name);
  } catch {
    return [];
  }
}

const KNOWN_SECTIONS: { key: string; label: string; defaultOrder: number }[] = [
  { key: "hero", label: "Hero", defaultOrder: 0 },
  { key: "ticket_highlight", label: "Ingressos", defaultOrder: 1 },
  { key: "news", label: "Notícias", defaultOrder: 2 },
  { key: "squad", label: "Elenco", defaultOrder: 3 },
  { key: "board", label: "Diretoria", defaultOrder: 4 },
  { key: "history", label: "História", defaultOrder: 5 },
  { key: "membership", label: "Sócio-Torcedor", defaultOrder: 6 },
  { key: "sponsors", label: "Patrocinadores", defaultOrder: 7 },
  { key: "shop", label: "Loja", defaultOrder: 8 },
  { key: "raffle", label: "Rifa / Sorteio", defaultOrder: 9 },
];

type Tab = "ingressos" | "clube" | "aparencia" | "loja" | "retirada" | "gateways" | "secoes" | "seguranca";
const TABS: { id: Tab; label: string }[] = [
  { id: "ingressos", label: "Ingressos" },
  { id: "clube", label: "Clube" },
  { id: "aparencia", label: "Aparência" },
  { id: "loja", label: "Loja" },
  { id: "retirada", label: "Retirada" },
  { id: "gateways", label: "Gateways" },
  { id: "secoes", label: "Seções" },
  { id: "seguranca", label: "Segurança" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ConfiguracoesPage({ searchParams }: PageProps) {
  const { tab: tabParam } = await searchParams;
  const activeTab: Tab =
    tabParam === "clube" || tabParam === "aparencia" || tabParam === "loja" || tabParam === "retirada" || tabParam === "gateways" || tabParam === "secoes" || tabParam === "seguranca"
      ? tabParam
      : "ingressos";

  const [configRows, gateways] = await Promise.all([
    getAdminConfigRows(),
    getAdminGateways(),
  ]);

  // Catálogo global de tipos de ingresso (semeado a partir do config legado se vazio)
  let globalTicketTypes: Awaited<ReturnType<typeof getTicketTypesAdmin>> = [];
  if (activeTab === "ingressos") {
    await ensureDefaultGlobalTypes();
    globalTicketTypes = await getTicketTypesAdmin(null);
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h2 className="font-display text-xl text-foreground tracking-wide">
        CONFIGURAÇÕES
      </h2>

      {/* Tab nav — rola no mobile (8 abas não cabem em 375px; sem overflow as
          últimas ficariam inacessíveis). */}
      <nav className="flex gap-1 border-b border-border overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`?tab=${t.id}`}
            className={
              activeTab === t.id
                ? "shrink-0 whitespace-nowrap px-4 py-2.5 text-sm border-b-2 border-primary text-foreground font-semibold -mb-px"
                : "shrink-0 whitespace-nowrap px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* ── Aba: Ingressos ───────────────────────────────────────────────── */}
      {activeTab === "ingressos" && (
        <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-foreground">Tipos de Ingresso (catálogo global)</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Defina os tipos padrão (Inteira, Meia, VIP…), seus preços e a definição
              de cada um. Cada jogo pode usar este catálogo ou ter tipos próprios.
            </p>
          </div>
          <TicketTypesEditor
            scope={null}
            initial={globalTicketTypes.map((t) => ({
              name: t.name,
              description: t.description,
              priceCents: t.priceCents,
              comboTiers: t.comboTiers,
            }))}
          />
        </section>
      )}

      {/* ── Aba: Clube ───────────────────────────────────────────────────── */}
      {activeTab === "clube" && (
        <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-foreground">Dados do Clube</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Informações de contato exibidas na plataforma.
            </p>
          </div>
          <ConfigFormContact
            siteName={getConfigValue(configRows, "siteName", "")}
            faviconUrl={getConfigValue(configRows, "faviconUrl", "")}
            whatsapp={getConfigValue(configRows, "whatsapp", "")}
            email={getConfigValue(configRows, "email", "")}
            instagram={getConfigValue(configRows, "instagram", "")}
            clubLogoUrl={getConfigValue(configRows, "clubLogoUrl", "")}
            tagline={getConfigValue(configRows, "tagline", "")}
            description={getConfigValue(configRows, "description", "")}
            city={getConfigValue(configRows, "city", "")}
            foundedYear={getConfigValue(configRows, "foundedYear", "")}
            heroImageUrl={getConfigValue(configRows, "heroImageUrl", "")}
            keywords={getConfigValue(configRows, "keywords", "")}
            heroStats={getConfigValue(configRows, "heroStats", "")}
          />
        </section>
      )}

      {/* ── Aba: Aparência ──────────────────────────────────────────────── */}
      {activeTab === "aparencia" && (
        <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-foreground">Cores do Clube</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Personalize as cores da plataforma para refletir a identidade visual do clube.
              Aplicado em botões, links, badges e elementos interativos.
            </p>
          </div>
          <ConfigFormTheme
            primaryColor={getConfigValue(configRows, "primaryColor", "")}
            accentColor={getConfigValue(configRows, "accentColor", "")}
          />
        </section>
      )}

      {/* ── Aba: Loja ───────────────────────────────────────────────────── */}
      {activeTab === "loja" && (
        <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-foreground">Frete — Melhor Envio</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ative/desative o frete, configure o CEP de origem e defina o valor mínimo para frete grátis.
            </p>
          </div>
          <ConfigFormShipping
            originCep={getConfigValue(configRows, "shippingOriginCep", "")}
            shippingEnabled={getConfigValue(configRows, "shippingEnabled", "true") !== "false"}
            shippingFreeAboveCents={Number(getConfigValue(configRows, "shippingFreeAboveCents", "0"))}
          />
        </section>
      )}

      {/* ── Aba: Retirada ───────────────────────────────────────────────── */}
      {activeTab === "retirada" && (
        <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-foreground">Pontos de Retirada</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure onde e em que horário os clientes retiram os produtos. Esses
              locais aparecem ao final da compra e nos e-mails de aviso de retirada.
            </p>
          </div>
          <ConfigFormPickup
            pickupEnabled={getConfigValue(configRows, "pickupEnabled", "false") === "true"}
            locations={parsePickupLocationsRows(configRows)}
          />
        </section>
      )}

      {/* ── Aba: Gateways ────────────────────────────────────────────────── */}
      {activeTab === "gateways" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-foreground">
                Gateways de Pagamento
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Gerencie os gateways e defina qual está ativo.
              </p>
            </div>
            <Link
              href="/admin/configuracoes/gateways/novo"
              className="shrink-0 self-start sm:self-auto flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus size={15} />
              Adicionar Gateway
            </Link>
          </div>

          {gateways.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-6">
              <p className="text-sm text-muted-foreground">
                Nenhum gateway cadastrado. Clique em &quot;Adicionar Gateway&quot; para
                começar.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Mobile: cards */}
              <ul className="sm:hidden divide-y divide-border/50">
                {gateways.map((gw) => (
                  <li key={gw.id} className="px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-foreground font-medium">{gw.name}</span>
                      {gw.active ? (
                        <span className="shrink-0 bg-green-500/15 text-green-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                          Ativo
                        </span>
                      ) : (
                        <span className="shrink-0 bg-secondary text-muted-foreground px-2 py-0.5 rounded-full text-xs font-medium">
                          Inativo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground uppercase text-xs font-mono">{gw.slug}</span>
                      <GatewayActions id={gw.id} active={gw.active} />
                    </div>
                  </li>
                ))}
              </ul>

              {/* Desktop: tabela */}
              <table className="hidden sm:table w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Slug
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gateways.map((gw) => (
                    <tr key={gw.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 text-foreground font-medium">
                        {gw.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground uppercase text-xs font-mono">
                        {gw.slug}
                      </td>
                      <td className="px-4 py-3">
                        {gw.active ? (
                          <span className="bg-green-500/15 text-green-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                            Ativo
                          </span>
                        ) : (
                          <span className="bg-secondary text-muted-foreground px-2 py-0.5 rounded-full text-xs font-medium">
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <GatewayActions id={gw.id} active={gw.active} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Aba: Segurança ───────────────────────────────────────────────── */}
      {activeTab === "seguranca" && (
        <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-foreground">Sessão de Administrador</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure o tempo de expiração do token de sessão.
            </p>
          </div>
          <ConfigFormSecurity
            sessionDurationHours={Number(
              getConfigValue(configRows, "sessionDurationHours", "24")
            )}
          />
        </section>
      )}

      {/* ── Aba: Seções ──────────────────────────────────────────────────── */}
      {activeTab === "secoes" && (
        <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-foreground">
              Visibilidade das Seções
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ative ou desative seções da página inicial e defina a ordem de exibição.
            </p>
          </div>
          <SectionToggles
            sections={KNOWN_SECTIONS.map((s) => {
              const enabledRow = configRows.find(
                (r) => r.key === `section.${s.key}.enabled`
              );
              const orderRow = configRows.find(
                (r) => r.key === `section.${s.key}.order`
              );
              return {
                key: s.key,
                label: s.label,
                enabled: enabledRow ? enabledRow.value !== "false" : true,
                order: orderRow ? Number(orderRow.value) : s.defaultOrder,
              };
            })}
          />
        </section>
      )}
    </div>
  );
}
