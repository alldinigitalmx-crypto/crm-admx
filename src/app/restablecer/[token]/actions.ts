"use server";

import { createHash } from "crypto";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function restablecerPassword(token: string, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");

  if (password.length < 8) redirect(`/restablecer/${token}?error=corta`);
  if (password !== confirmar) redirect(`/restablecer/${token}?error=nocoincide`);

  const usuario = await prisma.usuario.findFirst({
    where: { resetTokenHash: hashToken(token), resetTokenExpiraEn: { gt: new Date() } },
  });
  if (!usuario) redirect(`/restablecer/${token}?error=invalido`);

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { passwordHash, resetTokenHash: null, resetTokenExpiraEn: null },
  });

  redirect("/login?restablecido=1");
}
