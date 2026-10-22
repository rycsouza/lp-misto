import { NextResponse } from "next/server";

/**
 * Guardas comuns dos envios de imagem do sócio (foto e logo): resposta sem cache, mesma
 * origem e leitura do corpo com teto de bytes. Só servidor (usa NextResponse).
 */

export function replyNoStore(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Envio de outro site: se houver Origin, precisa ser o mesmo host. */
export function fromSameHost(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  const host = request.headers.get("host");
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Lê o corpo com teto de bytes (sem confiar só no Content-Length). Devolve "too_large" se
 * passar do limite, ou null se não houver corpo.
 */
export async function readBodyCapped(request: Request, max: number): Promise<Uint8Array<ArrayBuffer> | "too_large" | null> {
  const declared = Number(request.headers.get("content-length") ?? Number.NaN);
  if (Number.isFinite(declared) && declared > max) return "too_large";
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return "too_large";
    }
    chunks.push(value);
  }
  const out = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
