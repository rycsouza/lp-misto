export const dynamic = "force-dynamic";

import { PlatformLoginForm } from "@/components/admin/PlatformLoginForm";

export default function PlatformLoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl tracking-wider">
            <span style={{ color: "#C6FF00" }}>SPORT55</span>{" "}
            <span className="text-muted-foreground/60">SISTEMA</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Console da plataforma</p>
        </div>

        <PlatformLoginForm />

        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          Acesso restrito à equipe Sport55.
        </p>
      </div>
    </div>
  );
}
