export const dynamic = "force-dynamic";

import { LoginForm } from "@/components/admin/LoginForm";
import { getSiteConfig } from "@/lib/config";

export default async function AdminLoginPage() {
  const brand =
    (await getSiteConfig().catch(() => null))?.siteName?.trim().toUpperCase() || "PAINEL";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl tracking-wider">
            <span className="text-primary">{brand}</span>{" "}
            <span className="text-muted-foreground/60">ADMIN</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Painel Administrativo
          </p>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
