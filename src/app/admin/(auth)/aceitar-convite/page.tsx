export const dynamic = "force-dynamic";

import { getInviteByToken } from "@/app/actions/admin-auth";
import { AcceptInviteForm } from "@/components/admin/AcceptInviteForm";
import { getSiteConfig } from "@/lib/config";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function AcceptInvitePage({ searchParams }: Props) {
  const { token } = await searchParams;
  const brand =
    (await getSiteConfig().catch(() => null))?.siteName?.trim().toUpperCase() || "PAINEL";

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-display text-4xl text-primary tracking-wider mb-4">
            <span className="text-primary">{brand}</span>{" "}
            <span className="text-muted-foreground/60">ADMIN</span>
          </h1>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-destructive text-sm mb-4">Link de convite inválido.</p>
            <Link href="/admin/login" className="text-primary text-sm hover:underline">
              Ir para o login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const invite = await getInviteByToken(token);

  if (!invite.valid) {
    const msg = invite.alreadyAccepted
      ? "Este convite já foi utilizado. Faça login com sua conta."
      : invite.expired
      ? "Este convite expirou. Solicite um novo convite ao administrador."
      : "Link de convite inválido ou não encontrado.";

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-display text-4xl text-primary tracking-wider mb-4">
            <span className="text-primary">{brand}</span>{" "}
            <span className="text-muted-foreground/60">ADMIN</span>
          </h1>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-muted-foreground text-sm mb-4">{msg}</p>
            <Link href="/admin/login" className="text-primary text-sm hover:underline">
              Ir para o login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl tracking-wider">
            <span className="text-primary">{brand}</span>{" "}
            <span className="text-muted-foreground/60">ADMIN</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Criar sua senha
          </p>
        </div>
        <AcceptInviteForm
          token={token}
          name={invite.name!}
          email={invite.email!}
        />
      </div>
    </div>
  );
}
