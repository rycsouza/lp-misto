import { getAllSiteConfig } from "@/lib/db/queries";
import { buildAssetLinkStatements } from "@/lib/android-app/assetlinks";

/**
 * Digital Asset Links do app Android (TWA) do clube: GET /.well-known/assetlinks.json.
 *
 * Público, sem login. Por tenant (o proxy resolve o host antes desta rota).
 * - Clube com app configurado: 200 com o JSON exigido pelo Android.
 * - Sem app configurado (ou configuração inválida): 404 com corpo []. Um 404 não
 *   "promete" um app; a verificação do Android simplesmente não passa.
 * - Falha de leitura: mesmo 404, sem cache e sem detalhe de erro.
 *
 * Só pacote e impressões digitais são públicos por natureza (o Android os exige no
 * arquivo). Nada mais da configuração sai por esta rota.
 */

const CACHE_SHORT = "public, max-age=300";
const HEADERS_BASE = {
  "Content-Type": "application/json",
  // Mesmo caminho, respostas diferentes por host: o cache precisa separar por Host.
  Vary: "Host",
};

export async function GET() {
  let rows: { key: string; value: string }[];
  try {
    rows = await getAllSiteConfig();
  } catch {
    return Response.json([], {
      status: 404,
      headers: { ...HEADERS_BASE, "Cache-Control": "no-store" },
    });
  }

  const statements = buildAssetLinkStatements(rows);
  if (!statements) {
    return Response.json([], {
      status: 404,
      headers: { ...HEADERS_BASE, "Cache-Control": CACHE_SHORT },
    });
  }

  return Response.json(statements, {
    status: 200,
    headers: { ...HEADERS_BASE, "Cache-Control": CACHE_SHORT },
  });
}
