export function generateAffiliateCode(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${suffix}`;
}

export function computeAffiliateCommission(
  orderTotalCents: number,
  commissionType: "pct" | "fixed",
  commissionValue: number
): number {
  if (orderTotalCents <= 0 || commissionValue <= 0) return 0;
  if (commissionType === "fixed") {
    return Math.min(commissionValue, orderTotalCents);
  }
  const pct = Math.min(commissionValue, 100);
  return Math.round((orderTotalCents * pct) / 100);
}

export function isValidAffiliateCode(code: string): boolean {
  return /^[a-zA-Z0-9]{4,20}$/.test(code);
}

export const AFFILIATE_COOKIE = "mec_ref";
export const AFFILIATE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 dias em segundos
