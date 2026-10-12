export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/lib/db/client";
import { members, membershipPlans } from "@/lib/db/schema";
import { verifyCancelToken } from "@/lib/membership/cancel-token";
import { getCurrentTenantSlug } from "@/lib/base-url";
import { ConfirmCancelButton } from "@/components/membership/ConfirmCancelButton";

export const metadata: Metadata = {
  title: "Cancelar assinatura de sócio",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ t?: string }>;
}

const fmtDate = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/**
 * Link do e-mail de cancelamento. Abrir a página NÃO cancela (leitores de e-mail
 * pré-carregam links): só o botão "Confirmar cancelamento" cancela.
 */
export default async function CancelarSocioPage({ searchParams }: PageProps) {
  const { t } = await searchParams;
  const memberId = t ? await verifyCancelToken(t, await getCurrentTenantSlug()) : null;

  const member = memberId
    ? (
        await (await getDb())
          .select({
            name: members.name,
            status: members.status,
            nextBillingDate: members.nextBillingDate,
            planName: membershipPlans.name,
          })
          .from(members)
          .leftJoin(membershipPlans, eq(members.planId, membershipPlans.id))
          .where(eq(members.id, memberId))
          .limit(1)
      )[0]
    : null;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6">
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-3">
          Cancelar assinatura
        </h1>
        {!member ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Este link é inválido ou expirou. Peça um novo pela sua carteirinha.
            </p>
            <Link href="/socios/carteirinha" className="text-sm text-primary underline">
              Minha carteirinha
            </Link>
          </>
        ) : member.status === "cancelled" ? (
          <p className="text-sm text-muted-foreground">Esta assinatura já está cancelada.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-1">
              {member.name.split(" ")[0]}, você está cancelando o plano{" "}
              <strong className="text-foreground">{member.planName ?? "Sócio-Torcedor"}</strong>.
            </p>
            <p className="text-sm text-muted-foreground mb-5">
              As cobranças param.{" "}
              {member.status === "active" && member.nextBillingDate
                ? `Seus benefícios continuam até ${fmtDate(member.nextBillingDate)}.`
                : "Os benefícios se encerram agora."}
            </p>
            <ConfirmCancelButton token={t!} />
          </>
        )}
      </div>
    </main>
  );
}
