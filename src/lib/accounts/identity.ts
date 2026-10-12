/**
 * WhatsApp da conta: só dígitos, DDD + número (11) — o mesmo formato do checkout
 * e da tabela `customers`. Aceita com DDI 55. Fora disso → null.
 */
export function normalizeAccountPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let d = raw.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
  return /^[1-9][0-9]9[0-9]{8}$/.test(d) ? d : null;
}

/** "joao.silva@gmail.com" → "joao***@gmail.com" (mesma máscara do checkout). */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, Math.min(4, local.length))}***@${domain}`;
}

/** "67999998888" → "(67) 99999-8888". */
export function formatPhone(digits: string): string {
  return digits.length === 11 ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}` : digits;
}
