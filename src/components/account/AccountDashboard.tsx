"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { logoutAccount } from "@/app/actions/account";
import { MyOrders } from "./MyOrders";
import { MyMembership } from "./MyMembership";
import { MyProfile } from "./MyProfile";

type Tab = "pedidos" | "socio" | "dados";
const TABS: { key: Tab; label: string }[] = [
  { key: "pedidos", label: "Pedidos e ingressos" },
  { key: "socio", label: "Sócio-torcedor" },
  { key: "dados", label: "Meus dados" },
];

export function AccountDashboard({
  account,
  initialTab = "pedidos",
}: {
  account: { name: string; email: string; whatsapp: string | null };
  initialTab?: Tab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground">
            Olá, {account.name.split(" ")[0]}
          </h1>
          <p className="text-xs text-muted-foreground">{account.email}</p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(async () => { await logoutAccount(); router.refresh(); })}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <LogOut size={14} /> Sair
        </button>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${
              tab === t.key ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pedidos" && <MyOrders />}
      {tab === "socio" && <MyMembership />}
      {tab === "dados" && <MyProfile account={account} />}
    </div>
  );
}
