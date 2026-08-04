const COLORS = {
  bg: "#f1f5f9",
  card: "#ffffff",
  header: "#0f172a",
  text: "#334155",
  muted: "#64748b",
  border: "#e2e8f0",
  accent: "#2563eb",
  accentText: "#ffffff",
};

function baseLayout(opts: { preheader: string; bodyHtml: string }) {
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Admx Dev</title>
  </head>
  <body style="margin:0; padding:0; background-color:${COLORS.bg}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none; font-size:1px; color:${COLORS.bg}; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
      ${opts.preheader}
    </span>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.bg};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:100%; max-width:480px; background-color:${COLORS.card}; border-radius:12px; overflow:hidden; border:1px solid ${COLORS.border};">
            <tr>
              <td style="background-color:${COLORS.header}; padding:24px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:28px; height:28px; background-color:${COLORS.accent}; border-radius:6px; text-align:center; vertical-align:middle;">
                      <span style="color:#ffffff; font-size:14px; font-weight:700; line-height:28px;">A</span>
                    </td>
                    <td style="padding-left:10px;">
                      <span style="color:#ffffff; font-size:14px; font-weight:600; letter-spacing:0.04em;">ADMX DEV</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:32px;">
                ${opts.bodyHtml}
              </td>
            </tr>
          </table>

          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:100%; max-width:480px;">
            <tr>
              <td style="padding:20px 8px; text-align:center;">
                <span style="color:${COLORS.muted}; font-size:12px;">
                  © ${year} Admx Dev · Panel interno
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function passwordResetEmail(nombre: string, resetUrl: string) {
  const bodyHtml = `
    <h1 style="margin:0 0 12px; font-size:20px; font-weight:600; color:#0f172a;">
      Recupera tu contraseña
    </h1>
    <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:${COLORS.text};">
      Hola ${nombre}, recibimos una solicitud para restablecer la contraseña de tu cuenta en Admx Dev.
      Haz clic en el siguiente botón para elegir una nueva:
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="border-radius:8px; background-color:${COLORS.accent};">
          <a href="${resetUrl}"
             style="display:inline-block; padding:12px 24px; font-size:14px; font-weight:600; color:${COLORS.accentText}; text-decoration:none; border-radius:8px;">
            Restablecer contraseña
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px; font-size:13px; line-height:1.6; color:${COLORS.muted};">
      Este enlace es válido durante 1 hora y solo puede usarse una vez. Si no fuiste tú quien lo solicitó, puedes ignorar este correo con tranquilidad.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 0; padding-top:16px; border-top:1px solid ${COLORS.border}; width:100%;">
      <tr>
        <td>
          <p style="margin:0; font-size:12px; line-height:1.6; color:${COLORS.muted}; word-break:break-all;">
            ¿El botón no funciona? Copia y pega este enlace en tu navegador:<br />
            <a href="${resetUrl}" style="color:${COLORS.accent};">${resetUrl}</a>
          </p>
        </td>
      </tr>
    </table>
  `;

  return baseLayout({
    preheader: "Restablece tu contraseña de Admx Dev — el enlace vence en 1 hora.",
    bodyHtml,
  });
}
