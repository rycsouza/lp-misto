export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPlatformSession } from "@/app/actions/platform-auth";
import { getPlatformOrganizations } from "@/app/actions/platform-tenants";
import { getFeatureFlagsState } from "@/app/actions/platform-features";
import { FEATURES } from "@/lib/platform/features";
import { FeatureFlagsManager } from "@/components/admin/FeatureFlagsManager";

export default async function PlatformFeaturesPage() {
  const session = await getPlatformSession();
  if (!session) redirect("/admin/sistema/login");

  const [orgs, state] = await Promise.all([
    getPlatformOrganizations().catch(() => []),
    getFeatureFlagsState().catch(() => ({ global: {}, overrides: {} })),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card/50 flex items-center gap-3 px-4 md:px-6">
        <Link href="/admin/sistema" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-sm">
          <ArrowLeft size={16} /> Console
        </Link>
        <span className="font-display text-lg tracking-wider text-foreground ml-2">Kill-switch de features</span>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6">
        <p className="text-sm text-muted-foreground mb-6">
          Emergência: se uma feature apresentar bug crítico, desligue aqui para removê-la do painel
          na hora — sem deploy. Efeito na próxima navegação dos usuários.
        </p>
        <FeatureFlagsManager
          features={FEATURES.map((f) => ({ key: f.key, label: f.label, description: f.description }))}
          orgs={orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug }))}
          state={state}
        />
      </main>
    </div>
  );
}
