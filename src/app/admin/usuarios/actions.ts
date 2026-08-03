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
import { MODULOS } from "@/lib/modulo-sistema";

export type UsuarioFormState = { error?: string } | undefined;

async function currentUsuarioId() {
  const session = await auth();
  const id = session?.user?.id;
  return id ? Number(id) : null;
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
