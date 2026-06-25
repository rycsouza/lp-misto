const SPORT55_BASE = "sport55.com.br";
const VERCEL_CNAME_TARGET = "cname.vercel-dns.com";

export interface SubdomainResult {
  ok: boolean;
  subdomain: string;
  error?: string;
}

/**
 * Registra {slug}.sport55.com.br automaticamente:
 * 1. Cria CNAME no Cloudflare apontando para o Vercel
 * 2. Adiciona o domínio ao projeto Vercel
 */
export async function registerTenantSubdomain(slug: string): Promise<SubdomainResult> {
  const subdomain = `${slug}.${SPORT55_BASE}`;

  const cfToken     = process.env.CLOUDFLARE_API_TOKEN;
  const cfZoneId    = process.env.CLOUDFLARE_ZONE_ID;
  const vercelToken = process.env.VERCEL_API_TOKEN;
  const vercelProjectId = process.env.VERCEL_PROJECT_ID;

  if (!cfToken || !cfZoneId || !vercelToken || !vercelProjectId) {
    return { ok: false, subdomain, error: "Variáveis de ambiente DNS não configuradas." };
  }

  try {
    // ── 1. Cloudflare: criar CNAME ─────────────────────────────────────────────
    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/dns_records`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "CNAME",
          name: slug,          // relativo à zona: slug.sport55.com.br
          content: VERCEL_CNAME_TARGET,
          ttl: 1,              // TTL automático
          proxied: false,      // sem proxy: Vercel precisa resolver o TLS direto
        }),
      }
    );

    if (!cfRes.ok) {
      const data = await cfRes.json() as { errors?: { code: number }[] };
      const alreadyExists = data.errors?.some((e) => e.code === 81057); // record exists
      if (!alreadyExists) {
        throw new Error(`Cloudflare DNS: ${JSON.stringify(data.errors)}`);
      }
    }

    // ── 2. Vercel: adicionar domínio ao projeto ────────────────────────────────
    const vercelRes = await fetch(
      `https://api.vercel.com/v10/projects/${vercelProjectId}/domains`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: subdomain }),
      }
    );

    if (!vercelRes.ok) {
      const data = await vercelRes.json() as { error?: { code: string } };
      const alreadyInUse = data.error?.code === "domain_already_in_use";
      if (!alreadyInUse) {
        throw new Error(`Vercel domains: ${JSON.stringify(data.error)}`);
      }
    }

    return { ok: true, subdomain };
  } catch (err) {
    return { ok: false, subdomain, error: err instanceof Error ? err.message : String(err) };
  }
}
