import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ game?: string }>;
}

/**
 * O pós-jogo virou a aba "Pós-jogo" da tela de relatórios. Mantemos esta rota
 * como redirect permanente para não quebrar links/favoritos antigos.
 */
export default async function PosJogoRedirect({ searchParams }: PageProps) {
  const { game } = await searchParams;
  const qs = new URLSearchParams({ aba: "pos-jogo" });
  if (game) qs.set("game", game);
  redirect(`/admin/relatorios?${qs.toString()}`);
}
