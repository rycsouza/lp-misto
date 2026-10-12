import { redirect } from "next/navigation";

/**
 * "Meus Pedidos" deixou de existir: pedidos e ingressos ficam na área logada.
 * Links antigos (e-mails, WhatsApp) caem aqui e seguem para a conta.
 */
export default function PedidosPage() {
  redirect("/conta");
}
