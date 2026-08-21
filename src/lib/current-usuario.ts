import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Memoizado por request con React cache(): el layout de /admin y casi
// todas las páginas llaman currentUsuario() por separado (una para el
// gate de sesión, otra para permisosModulo) — sin esto, cada carga de
// página hacía la misma consulta a usuario 2 veces contra la base.
export const currentUsuario = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return prisma.usuario.findUnique({ where: { id: Number(id) } });
});
