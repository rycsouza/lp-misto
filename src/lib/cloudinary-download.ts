/**
 * Transforma uma URL de entrega do Cloudinary para FORÇAR download (attachment),
 * em vez de abrir o PDF inline no navegador. Opcionalmente define o nome do
 * arquivo baixado a partir de um título. Sem `/upload/` (URL não-Cloudinary),
 * devolve a original.
 *
 * Obs.: isto só resolve o "abrir vs. baixar". A ENTREGA de PDF precisa estar
 * habilitada na conta Cloudinary (Settings → Security), senão a URL responde 401.
 */
export function toDownloadUrl(url: string, filename?: string): string {
  if (!url || !url.includes("/upload/")) return url;
  const slug = (filename ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const flag = slug ? `fl_attachment:${slug}` : "fl_attachment";
  return url.replace("/upload/", `/upload/${flag}/`);
}
