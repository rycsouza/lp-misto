import { redirect } from "next/navigation";

/** O cancelamento agora é feito na área logada (Minha conta → Sócio-torcedor). */
export default function CancelarSocioPage() {
  redirect("/conta?aba=socio");
}
