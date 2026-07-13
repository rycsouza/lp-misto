"use server";

import { getDb } from "@/lib/db/client";
import { games } from "@/lib/db/schema/content";
import { ticketTypes } from "@/lib/db/schema/tickets";
import { getAdminSession } from "@/app/actions/admin-auth";
import { getAdminGateways } from "@/app/actions/admin";
import { getSiteConfig } from "@/lib/config";
import { and, eq, count } from "drizzle-orm";

export interface OnboardingStep {
  key: string;
  label: string;
  description: string;
  done: boolean;
  href: string;
}

export interface OnboardingStatus {
  steps: OnboardingStep[];
  completed: number;
  total: number;
  allDone: boolean;
}

/**
 * Estado de ativação do clube (checklist de primeiros passos no dashboard).
 *
 * Só faz sentido para quem configura o clube → retorna `null` para não-admins
 * (o dashboard renderiza nada nesse caso, sem quebrar). Todos os sinais são
 * booleanos de "está configurado?"; nenhum dado sensível trafega.
 */
export async function getOnboardingStatus(): Promise<OnboardingStatus | null> {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") return null;

  const db = await getDb();

  const [config, gateways, ticketTypeCount, homeGameCount] = await Promise.all([
    getSiteConfig().catch(() => null),
    getAdminGateways().catch(() => [] as Awaited<ReturnType<typeof getAdminGateways>>),
    db
      .select({ n: count() })
      .from(ticketTypes)
      .then((r) => r[0]?.n ?? 0)
      .catch(() => 0),
    db
      .select({ n: count() })
      .from(games)
      .where(and(eq(games.isHome, true), eq(games.active, true)))
      .then((r) => r[0]?.n ?? 0)
      .catch(() => 0),
  ]);

  const hasLogo = !!config?.clubLogoUrl?.trim();
  const hasColor = !!config?.primaryColor?.trim();
  const hasContact = !!config?.whatsapp?.trim();
  const hasActiveGateway = gateways.some((g) => g.active);
  const hasTicketType = ticketTypeCount > 0;
  const hasHomeGame = homeGameCount > 0;

  const steps: OnboardingStep[] = [
    {
      key: "logo",
      label: "Envie o logo do clube",
      description: "Aparece no site, nos ingressos e no painel.",
      done: hasLogo,
      href: "/admin/configuracoes",
    },
    {
      key: "color",
      label: "Escolha a cor da marca",
      description: "Deixa o site e os ingressos com a identidade do clube.",
      done: hasColor,
      href: "/admin/configuracoes",
    },
    {
      key: "contact",
      label: "Cadastre o WhatsApp de contato",
      description: "Canal de suporte ao torcedor na compra.",
      done: hasContact,
      href: "/admin/configuracoes",
    },
    {
      key: "gateway",
      label: "Conecte um meio de pagamento",
      description: "Sem um gateway ativo, ninguém consegue comprar.",
      done: hasActiveGateway,
      href: "/admin/configuracoes",
    },
    {
      key: "ticketType",
      label: "Crie um tipo de ingresso",
      description: "Ex.: Inteira, Meia, Área Exclusiva.",
      done: hasTicketType,
      href: "/admin/configuracoes",
    },
    {
      key: "game",
      label: "Cadastre seu primeiro jogo em casa",
      description: "É o que abre a bilheteria para o torcedor.",
      done: hasHomeGame,
      href: "/admin/jogos",
    },
  ];

  const completed = steps.filter((s) => s.done).length;

  return {
    steps,
    completed,
    total: steps.length,
    allDone: completed === steps.length,
  };
}
