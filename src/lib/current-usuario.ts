import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function currentUsuario() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return prisma.usuario.findUnique({ where: { id: Number(id) } });
}
