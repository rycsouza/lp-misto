/**
 * Imagens do produto na LISTAGEM (vitrine da loja e lista do painel). Puro: sem banco.
 *
 * A imagem principal do produto é a capa: vem sempre primeiro. As imagens por cor das
 * variações entram depois, no carrossel (sem repetir URL). Antes, com qualquer imagem de cor
 * a principal era ignorada, e trocar a imagem do produto não aparecia na listagem.
 */
export function productListImages(
  imageUrl: string | null | undefined,
  colorVariants: readonly { colorImageUrl: string | null }[]
): string[] {
  const out: string[] = [];
  for (const url of [imageUrl, ...colorVariants.map((v) => v.colorImageUrl)]) {
    if (url && !out.includes(url)) out.push(url);
  }
  return out;
}
