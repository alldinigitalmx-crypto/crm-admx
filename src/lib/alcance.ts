import { prisma } from "@/lib/prisma";
import type { ModuloSistema, Usuario } from "@/generated/prisma/client";

export function esAdmin(usuario: Pick<Usuario, "rol"> | null | undefined) {
  return usuario?.rol === "Admin";
}

export async function tieneAlcanceTodo(usuarioId: number, modulo: ModuloSistema) {
  const permiso = await prisma.moduloPermiso.findUnique({
    where: { usuarioId_modulo: { usuarioId, modulo } },
  });
  return permiso?.alcance === "Todo";
}

export async function puedeVerTodo(
  usuario: Pick<Usuario, "id" | "rol"> | null | undefined,
  modulo: ModuloSistema
) {
  if (!usuario) return false;
  if (esAdmin(usuario)) return true;
  return tieneAlcanceTodo(usuario.id, modulo);
}
