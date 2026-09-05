"use server";

import { randomBytes, createHash } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { passwordResetEmail } from "@/lib/email-templates";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function solicitarRecuperacion(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/recuperar?error=1");

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  // Freno anti abuso: sin esto, este formulario público (sin sesión) se
  // podía usar para bombardear de correos a cualquier cuenta real con
  // solo reenviar el POST -- como el token dura 1 hora, si todavía le
  // queda casi toda su vigencia es que se pidió hace menos de un minuto.
  const pidioHaceMenosDeUnMinuto =
    usuario?.resetTokenExpiraEn != null &&
    usuario.resetTokenExpiraEn.getTime() - Date.now() > 59 * 60 * 1000;

  if (usuario && usuario.activo && !pidioHaceMenosDeUnMinuto) {
    const token = randomBytes(32).toString("hex");
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        resetTokenHash: hashToken(token),
        resetTokenExpiraEn: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const headersList = await headers();
    const origin =
      headersList.get("origin") ??
      `${headersList.get("x-forwarded-proto") ?? "http"}://${headersList.get("host")}`;
    const resetUrl = `${origin}/restablecer/${token}`;

    await sendMail({
      to: usuario.email,
      subject: "Recupera tu contraseña — Admx Dev",
      html: passwordResetEmail(usuario.nombre, resetUrl),
    });
  }

  // Mensaje genérico siempre, para no revelar si el correo existe.
  redirect("/recuperar?enviado=1");
}
