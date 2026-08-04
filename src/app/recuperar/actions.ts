"use server";

import { randomBytes, createHash } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function solicitarRecuperacion(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/recuperar?error=1");

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  if (usuario && usuario.activo) {
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
      html: `
        <p>Hola ${usuario.nombre},</p>
        <p>Recibimos una solicitud para restablecer tu contraseña. Este enlace es válido por 1 hora:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Si no fuiste tú, ignora este correo.</p>
      `,
    });
  }

  // Mensaje genérico siempre, para no revelar si el correo existe.
  redirect("/recuperar?enviado=1");
}
