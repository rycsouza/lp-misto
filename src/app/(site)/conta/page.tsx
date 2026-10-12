export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getMyAccount } from "@/app/actions/account";
import { AccountAuth } from "@/components/account/AccountAuth";
import { AccountDashboard } from "@/components/account/AccountDashboard";

export const metadata: Metadata = {
  title: "Minha conta",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ confirmacao?: string; aba?: string; criar?: string }>;
}

const NOTICES: Record<string, string> = {
  ok: "E-mail confirmado! Agora é só entrar com sua senha.",
  invalida: "Link de confirmação inválido ou expirado. Entre para receber um novo.",
  erro: "Não foi possível confirmar agora. Tente o link novamente em instantes.",
};

export default async function ContaPage({ searchParams }: PageProps) {
  const { confirmacao, aba, criar } = await searchParams;
  const account = await getMyAccount();

  return (
    <main className="min-h-screen bg-background">
      <div className={`${account ? "max-w-3xl" : "max-w-sm"} mx-auto px-4 py-10`}>
        {account ? (
          <AccountDashboard
            account={account}
            initialTab={aba === "socio" || aba === "dados" ? aba : "pedidos"}
          />
        ) : (
          <AccountAuth initialMode={criar ? "signup" : "login"} notice={confirmacao ? NOTICES[confirmacao] ?? null : null} />
        )}
      </div>
    </main>
  );
}
