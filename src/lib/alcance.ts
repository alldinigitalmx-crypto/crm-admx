import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import type { ModuloSistema, NivelPermiso, Usuario } from "@/generated/prisma/client";

const RANGO: Record<NivelPermiso, number> = { Ver: 1, Crear: 2, Editar: 3 };

export function esAdmin(usuario: Pick<Usuario, "rol"> | null | undefined) {
  return usuario?.rol === "Admin";
}

export type PermisoModulo = {
  puedeVer: boolean;
  puedeCrear: boolean;
  puedeEditar: boolean;
  verTodo: boolean;
};

const SIN_ACCESO: PermisoModulo = {
  puedeVer: false,
  puedeCrear: false,
  puedeEditar: false,
  verTodo: false,
};

export async function permisosModulo(
  usuario: Pick<Usuario, "id" | "rol"> | null | undefined,
  modulo: ModuloSistema
): Promise<PermisoModulo> {
  if (esAdmin(usuario)) return { puedeVer: true, puedeCrear: true, puedeEditar: true, verTodo: true };
  if (!usuario) return SIN_ACCESO;

  const permiso = await prisma.moduloPermiso.findUnique({
    where: { usuarioId_modulo: { usuarioId: usuario.id, modulo } },
  });
  if (!permiso) return SIN_ACCESO;

  const rango = RANGO[permiso.nivel];
  return {
    puedeVer: rango >= RANGO.Ver,
    puedeCrear: rango >= RANGO.Crear,
    puedeEditar: rango >= RANGO.Editar,
    verTodo: permiso.alcance === "Todo",
  };
}

export async function requiereNivel(
  modulo: ModuloSistema,
  minimo: "Crear" | "Editar"
): Promise<boolean> {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, modulo);
  return minimo === "Crear" ? permisos.puedeCrear : permisos.puedeEditar;
}
