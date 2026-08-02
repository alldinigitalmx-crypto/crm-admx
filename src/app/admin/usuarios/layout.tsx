import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function UsuariosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const usuario = await prisma.usuario.findUnique({
    where: { id: Number(session?.user?.id) },
  });

  if (usuario?.rol !== "Admin") {
    redirect("/admin");
  }

  return <>{children}</>;
}
