export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getMyAccount } from "@/app/actions/account";
import { getSiteConfig } from "@/lib/config";
import { AccountAuth } from "@/components/account/AccountAuth";
import { AccountDashboard } from "@/components/account/AccountDashboard";

export const metadata: Metadata = {
  title: "Minha conta",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ aba?: string; criar?: string }>;
}

export default async function ContaPage({ searchParams }: PageProps) {
  const { aba, criar } = await searchParams;
  const [account, config] = await Promise.all([getMyAccount(), getSiteConfig()]);

  return (
    <main className="min-h-screen bg-background">
      <div className={`${account ? "max-w-3xl" : "max-w-sm"} mx-auto px-4 py-10`}>
        {account ? (
          <AccountDashboard
            account={account}
            initialTab={aba === "socio" || aba === "dados" ? aba : "pedidos"}
            siteName={config.siteName}
          />
        ) : (
          <AccountAuth initialMode={criar ? "signup" : "login"} />
        )}
      </div>
    </main>
  );
}
