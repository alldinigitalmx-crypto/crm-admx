"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import type {
  AlcanceModuloPermiso,
  NivelPermiso,
  RolUsuario,
  StatusTicketAcceso,
} from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { currentUsuario } from "@/lib/current-usuario";
import { esAdmin } from "@/lib/alcance";
import { MODULOS } from "@/lib/modulo-sistema";

export type UsuarioFormState = { error?: string } | undefined;

async function currentUsuarioId() {
  const session = await auth();
  const id = session?.user?.id;
  return id ? Number(id) : null;
}

// Gestionar usuarios, permisos y tickets de acceso es exclusivo de Admin —
// se revisa el rol fresco en base de datos (no el del JWT) en cada acción,
// nunca solo en la página, porque estas funciones son invocables
// directamente sin pasar por la UI.
async function requiereAdmin() {
  const usuario = await currentUsuario();
  return esAdmin(usuario);
}

function parseUsuarioForm(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rol = String(formData.get("rol") ?? "Interno") as RolUsuario;
  const activo = formData.get("activo") === "on";

  return { nombre, email, password, rol, activo };
}

function validateUsuarioForm(
  data: ReturnType<typeof parseUsuarioForm>,
  { requirePassword }: { requirePassword: boolean }
) {
  if (!data.nombre) return "El nombre es obligatorio.";
  if (!data.email) return "El correo es obligatorio.";
  if (requirePassword && !data.password) return "La contraseña es obligatoria.";
  if (data.password && data.password.length < 6) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  return null;
}

export async function crearUsuario(
  _prevState: UsuarioFormState,
  formData: FormData
): Promise<UsuarioFormState> {
  if (!(await requiereAdmin())) {
    return { error: "No tienes permiso para crear usuarios." };
  }

  const data = parseUsuarioForm(formData);
  const error = validateUsuarioForm(data, { requirePassword: true });
  if (error) return { error };

  const passwordHash = await bcrypt.hash(data.password, 10);

  try {
    await prisma.usuario.create({
      data: {
        nombre: data.nombre,
        email: data.email,
        passwordHash,
        rol: data.rol,
        activo: data.activo,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ya existe un usuario con ese correo." };
    }
    throw e;
  }

  revalidatePath("/admin/usuarios");
  return undefined;
}

export async function actualizarUsuario(
  id: number,
  _prevState: UsuarioFormState,
  formData: FormData
): Promise<UsuarioFormState> {
  if (!(await requiereAdmin())) {
    return { error: "No tienes permiso para editar usuarios." };
  }

  const data = parseUsuarioForm(formData);
  const error = validateUsuarioForm(data, { requirePassword: false });
  if (error) return { error };

  try {
    await prisma.usuario.update({
      where: { id },
      data: {
        nombre: data.nombre,
        email: data.email,
        rol: data.rol,
        activo: data.activo,
        ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 10) } : {}),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ya existe un usuario con ese correo." };
    }
    throw e;
  }

  revalidatePath("/admin/usuarios");
  return undefined;
}

export async function guardarPermisos(
  usuarioId: number,
  permisos: Record<string, { nivel: string; alcance: string }>
) {
  if (!(await requiereAdmin())) return;

  await prisma.$transaction(
    MODULOS.map((modulo) => {
      const { nivel = "none", alcance = "Propio" } = permisos[modulo] ?? {};
      if (nivel === "none" && alcance === "Propio") {
        return prisma.moduloPermiso.deleteMany({ where: { usuarioId, modulo } });
      }
      const nivelGuardado = (nivel === "none" ? "Ver" : nivel) as NivelPermiso;
      return prisma.moduloPermiso.upsert({
        where: { usuarioId_modulo: { usuarioId, modulo } },
        create: { usuarioId, modulo, nivel: nivelGuardado, alcance: alcance as AlcanceModuloPermiso },
        update: { nivel: nivelGuardado, alcance: alcance as AlcanceModuloPermiso },
      });
    })
  );

  revalidatePath("/admin/usuarios");
}

export async function resolverTicketAcceso(
  ticketId: number,
  decision: StatusTicketAcceso,
  nivel: NivelPermiso = "Ver"
) {
  if (!(await requiereAdmin())) return;

  const resueltoPorId = await currentUsuarioId();

  const ticket = await prisma.ticketAcceso.update({
    where: { id: ticketId },
    data: {
      status: decision,
      resueltoPorId,
      fechaResolucion: new Date(),
    },
  });

  if (decision === "Aprobado") {
    await prisma.moduloPermiso.upsert({
      where: {
        usuarioId_modulo: { usuarioId: ticket.usuarioSolicitanteId, modulo: ticket.moduloSolicitado },
      },
      create: { usuarioId: ticket.usuarioSolicitanteId, modulo: ticket.moduloSolicitado, nivel },
      update: { nivel },
    });
  }

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin");
}
