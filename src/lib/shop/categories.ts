// Fonte única de categorias e tamanhos da loja.

export const PRODUCT_CATEGORIES = ["camisa_oficial", "camisa_torcedor", "infantil"] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  camisa_oficial: "Camisa Oficial",
  camisa_torcedor: "Camisa Torcedor",
  infantil: "Camiseta Infantil",
};

/** Rótulo curto para abas/filtros na vitrine. */
export const CATEGORY_TAB_LABELS: Record<ProductCategory, string> = {
  camisa_oficial: "Oficial",
  camisa_torcedor: "Torcedor",
  infantil: "Infantil",
};

// Tamanhos por categoria: adulto (PP→Único) e infantil (02 ao 16).
export const ADULT_SIZES = ["PP", "P", "M", "G", "GG", "XGG", "Único"] as const;
export const CHILD_SIZES = ["02", "03", "04", "06", "08", "10", "12", "14", "16"] as const;

export function sizesForCategory(category: string): readonly string[] {
  return category === "infantil" ? CHILD_SIZES : ADULT_SIZES;
}
