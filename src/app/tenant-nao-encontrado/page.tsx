// Página de erro para hosts que não resolvem um tenant nem são domínio primário.
// Tenant-agnóstica de propósito: NÃO faz nenhuma consulta ao banco — evita
// renderizar dados de um cliente num domínio que não é dele.
export const dynamic = "force-static";

export const metadata = {
  title: "Domínio não configurado",
  robots: { index: false, follow: false },
};

export default function TenantNaoEncontradoPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Erro de configuração
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground">
          Domínio não configurado
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Este endereço ainda não está associado a nenhuma loja. Verifique a URL
          ou entre em contato com o responsável pelo site.
        </p>
      </div>
    </main>
  );
}
