/**
 * Pix Automático: regras puras (sem banco nem gateway), seguras para componentes client.
 * O fluxo com o gateway fica em ./pix-automatic.ts.
 */

/** Chave de configuração (só admin do sistema): liga o Pix Automático na adesão do clube. */
export const PIX_AUTOMATIC_ENABLED_KEY = "membershipPixAutomaticEnabled";

/** Validade do QR Code da 1ª mensalidade: 1 hora para pagar e autorizar no app do banco. */
export const PIX_AUTOMATIC_QR_SECONDS = 60 * 60;

/** Id de autorização aceito (vem do webhook/banco antes de ir à URL do gateway). */
const AUTHORIZATION_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

export function isValidPixAutomaticAuthorizationId(id: unknown): id is string {
  return typeof id === "string" && AUTHORIZATION_ID_RE.test(id);
}

/** Valor da chave de configuração: só "true" liga (qualquer outro valor = desligado). */
export function isPixAutomaticEnabledValue(raw: unknown): boolean {
  return raw === true || raw === "true";
}

/** Valor que o admin pode gravar na chave: só "true" ou "false". Outras chaves: válidas aqui. */
export function isValidPixAutomaticConfigValue(key: string, value: string): boolean {
  if (key !== PIX_AUTOMATIC_ENABLED_KEY) return true;
  return value === "true" || value === "false";
}

/** Pix Automático na adesão: ligado pelo admin do sistema E gateway Asaas ativo. */
export function pixAutomaticAvailable(gatewaySlug: string | null | undefined, enabledRaw: unknown): boolean {
  return !!gatewaySlug && gatewaySlug.startsWith("asaas") && isPixAutomaticEnabledValue(enabledRaw);
}

