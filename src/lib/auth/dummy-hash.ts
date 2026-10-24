import bcrypt from "bcryptjs";

/**
 * Hash bcrypt VÁLIDO (60 chars, custo 12 — o mesmo das contas reais) de uma
 * senha aleatória, gerado uma vez por instância. Login compara contra ele quando
 * o e-mail não existe, para que a resposta leve o mesmo tempo nos dois casos.
 *
 * Não usar literal fixo: bcryptjs devolve `false` NA HORA (sem derivar a chave)
 * para hash malformado — um literal com tamanho errado anula a proteção.
 */
let dummyHash: Promise<string> | null = null;

export function getDummyBcryptHash(): Promise<string> {
  // Web Crypto (global): funciona no runtime Node e no Edge.
  const random = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
  return (dummyHash ??= bcrypt.hash(random, 12));
}
