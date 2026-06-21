import { getAdminConfigRows, getAdminGateways } from "@/app/actions/admin";
import {
  ConfigFormBundle,
  ConfigFormContact,
  ConfigFormSecurity,
} from "@/components/admin/ConfigForm";
import { parseBundleTiers } from "@/lib/promotions/bundle";
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
];

type Tab = "ingressos" | "clube" | "gateways" | "secoes" | "seguranca";
const TABS: { id: Tab; label: string }[] = [
  { id: "ingressos", label: "Ingressos" },
  { id: "clube", label: "Clube" },
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
    tabParam === "clube" || tabParam === "gateways" || tabParam === "secoes" || tabParam === "seguranca"
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

      {/* Tab nav */}
      <nav className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`?tab=${t.id}`}
            className={
              activeTab === t.id
                ? "px-4 py-2.5 text-sm border-b-2 border-primary text-foreground font-semibold -mb-px"
                : "px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
            }))}
          />
        </section>
      )}

      {activeTab === "ingressos" && (
        <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-foreground">Combo de Jogos</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Desconto progressivo conforme o número de jogos diferentes no carrinho.
            </p>
          </div>
          <ConfigFormBundle
            tiers={parseBundleTiers(
              getConfigValue(configRows, "ticketBundleTiers", "[]")
            )}
            types={globalTicketTypes.map((t) => ({ code: t.code, name: t.name }))}
            selectedCodes={(() => {
              try {
                const v = JSON.parse(getConfigValue(configRows, "ticketBundleTypeCodes", "[]"));
                return Array.isArray(v) ? v.map(String) : [];
              } catch {
                return [];
              }
            })()}
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
            whatsapp={getConfigValue(configRows, "whatsapp", "+5567991360075")}
            email={getConfigValue(configRows, "email", "contato@mistoec.com.br")}
            instagram={getConfigValue(
              configRows,
              "instagram",
              "https://www.instagram.com/misto.esporteclube"
            )}
            clubLogoUrl={getConfigValue(
              configRows,
              "clubLogoUrl",
              "https://res.cloudinary.com/df798ispp/image/upload/misto/misto-logotipo.jpg"
            )}
          />
        </section>
      )}

      {/* ── Aba: Gateways ────────────────────────────────────────────────── */}
      {activeTab === "gateways" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
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
              className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
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
              <table className="w-full text-sm">
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
              const previewEnabledRow = configRows.find(
                (r) => r.key === `preview.section.${s.key}.enabled`
              );
              const orderRow = configRows.find(
                (r) => r.key === `section.${s.key}.order`
              );
              const prodEnabled = enabledRow ? enabledRow.value !== "false" : true;
              return {
                key: s.key,
                label: s.label,
                enabled: prodEnabled,
                previewEnabled: previewEnabledRow ? previewEnabledRow.value !== "false" : true,
                order: orderRow ? Number(orderRow.value) : s.defaultOrder,
              };
            })}
          />
        </section>
      )}
    </div>
  );
}
