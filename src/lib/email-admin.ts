import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.MAILTRAP_HOST;
  const user = process.env.MAILTRAP_USER;
  const pass = process.env.MAILTRAP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.MAILTRAP_PORT ?? 587),
    auth: { user, pass },
  });
}

export async function sendInviteEmail(params: {
  to: string;
  inviteeName: string;
  inviterName: string;
  role: "admin" | "editor";
  inviteLink: string;
}): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email] MAILTRAP_* env vars não configuradas — e-mail de convite ignorado");
    return;
  }

  const { to, inviteeName, inviterName, role, inviteLink } = params;
  const roleLabel = role === "admin" ? "Administrador" : "Editor";
  const from = process.env.MAILTRAP_FROM ?? "contato@mistoec.com.br";

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;color:#e5e5e5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a;">

        <tr><td style="background:#c19a5a;padding:24px;text-align:center;">
          <h1 style="margin:0;font-size:28px;color:#0a0a0a;letter-spacing:2px;font-weight:900;">MISTO ADMIN</h1>
          <p style="margin:4px 0 0;font-size:12px;color:#0a0a0a;letter-spacing:3px;text-transform:uppercase;">Painel Administrativo</p>
        </td></tr>

        <tr><td style="padding:32px 24px;">
          <h2 style="margin:0 0 16px;font-size:20px;color:#c19a5a;">Você foi convidado!</h2>
          <p style="margin:0 0 16px;color:#ccc;font-size:14px;line-height:1.6;">
            Olá, <strong style="color:#e5e5e5;">${inviteeName}</strong>,
          </p>
          <p style="margin:0 0 16px;color:#ccc;font-size:14px;line-height:1.6;">
            <strong style="color:#e5e5e5;">${inviterName}</strong> te convidou para acessar o painel administrativo do Misto Esporte Clube como <strong style="color:#c19a5a;">${roleLabel}</strong>.
          </p>
          <p style="margin:0 0 24px;color:#ccc;font-size:14px;line-height:1.6;">
            Clique no botão abaixo para criar sua senha e acessar o painel:
          </p>

          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr>
              <td style="background:#c19a5a;border-radius:8px;padding:12px 24px;text-align:center;">
                <a href="${inviteLink}" style="color:#0a0a0a;font-weight:bold;font-size:14px;text-decoration:none;letter-spacing:0.5px;">Aceitar Convite</a>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 8px;font-size:12px;color:#666;">
            Ou copie e cole este link no navegador:
          </p>
          <p style="margin:0 0 24px;font-size:12px;color:#888;word-break:break-all;">
            <a href="${inviteLink}" style="color:#c19a5a;">${inviteLink}</a>
          </p>

          <p style="margin:0;font-size:12px;color:#555;">
            Este link expira em 7 dias. Se você não esperava este convite, ignore este e-mail.
          </p>
        </td></tr>

        <tr><td style="padding:16px 24px;border-top:1px solid #2a2a2a;text-align:center;">
          <p style="margin:0;font-size:11px;color:#555;">© 2026 Misto Esporte Clube · Três Lagoas/MS</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transport.sendMail({
    from: `"Misto EC" <${from}>`,
    to,
    subject: "Você foi convidado para o Misto Admin",
    html,
  });
}
