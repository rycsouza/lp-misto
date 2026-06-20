/** Cookie que guarda o código de cupom vindo de um link (?cupom=CODE),
 *  para sobreviver à navegação até o checkout (loja → carrinho → pagamento). */
export const COUPON_COOKIE = "mec_coupon";

/** Formato aceito de código de cupom em links públicos. */
export const COUPON_CODE_RE = /^[a-zA-Z0-9_-]{3,40}$/;
