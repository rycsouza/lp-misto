/**
 * WhatsApp com cadastro, mas o aparelho não é do dono (sem login, nunca comprou daqui):
 * o servidor não completa os dados guardados, então a pessoa confirma nome e e-mail.
 * Depois da primeira compra neste aparelho, ele é lembrado e o atalho volta.
 */
export function KnownPhoneHint() {
  return (
    <p className="text-xs text-muted-foreground">
      Este WhatsApp já tem cadastro. Por segurança, confirme seu nome e e-mail neste aparelho — nas próximas compras
      daqui não precisa mais.
    </p>
  );
}
