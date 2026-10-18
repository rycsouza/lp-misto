import type { Metadata } from "next";
import { OfflinePanel } from "@/components/site/OfflinePanel";

// Fica fora do layout do site (que consulta o banco e lê cookies): o HTML desta página
// vai para o cache do service worker e precisa ser o mesmo para qualquer visitante.
// Renderização dinâmica é obrigatória: o nonce da CSP (proxy) só é aplicado no render por
// requisição. Sem ela, os scripts da página seriam bloqueados.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sem conexão",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return <OfflinePanel />;
}
