"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { requiereNivel, requiereNivelTarea } from "@/lib/alcance";
import type { PrioridadTarea } from "@/generated/prisma/client";

export type TareaFormState = { error?: string } | undefined;

async function currentUserId() {
  const usuario = await currentUsuario();
  return usuario?.id ?? null;
}

function revalidateTareaPaths(
  servicioId: number | null,
  cotizacionId: number | null,
  clienteId: number | null = null
) {
  revalidatePath("/admin/tareas");
  revalidatePath("/admin");
  if (servicioId) revalidatePath(`/admin/servicios/${servicioId}`);
  if (cotizacionId) revalidatePath(`/admin/cotizaciones/${cotizacionId}`);
  if (clienteId) {
    revalidatePath(`/admin/clientes/${clienteId}`);
    revalidatePath("/admin/prospectos");
  }
}

export async function crearTarea(
  _prevState: TareaFormState,
  formData: FormData
): Promise<TareaFormState> {
  if (!(await requiereNivel("Tareas", "Crear"))) {
    return { error: "No tienes permiso para crear en este módulo." };
  }

  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) return { error: "Escribe un título para la tarea." };

  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const prioridad = (String(formData.get("prioridad") ?? "Media") as PrioridadTarea) ?? "Media";
  const fechaLimiteRaw = String(formData.get("fechaLimite") ?? "");

  const vinculoRaw = String(formData.get("vinculo") ?? "none");
  const [tipo, idRaw] = vinculoRaw.split(":");
  const servicioId = tipo === "servicio" ? Number(idRaw) : null;
  const cotizacionId = tipo === "cotizacion" ? Number(idRaw) : null;
  const clienteId = tipo === "cliente" ? Number(idRaw) : null;

  const asignadoAIdRaw = String(formData.get("asignadoAId") ?? "");

  const userId = await currentUserId();

  await prisma.tarea.create({
    data: {
      titulo,
      descripcion,
      prioridad,
      fechaLimite: fechaLimiteRaw ? new Date(fechaLimiteRaw) : null,
      servicioId,
      cotizacionId,
      clienteId,
      creadoPorId: userId,
      asignadoAId: asignadoAIdRaw ? Number(asignadoAIdRaw) : userId,
    },
  });

  revalidateTareaPaths(servicioId, cotizacionId, clienteId);
  return undefined;
}

export async function completarTarea(id: number, completada: boolean) {
  if (!(await requiereNivelTarea(id, "Editar"))) return;

  const tarea = await prisma.tarea.update({
    where: { id },
    data: { completada, completadaEn: completada ? new Date() : null },
  });

  revalidateTareaPaths(tarea.servicioId, tarea.cotizacionId, tarea.clienteId);
}

export async function eliminarTarea(id: number) {
  if (!(await requiereNivelTarea(id, "Editar"))) return;

  const tarea = await prisma.tarea.findUnique({ where: { id } });
  if (!tarea) return;

  await prisma.subtarea.deleteMany({ where: { tareaId: id } });
  await prisma.tarea.delete({ where: { id } });
  revalidateTareaPaths(tarea.servicioId, tarea.cotizacionId, tarea.clienteId);
}

export async function actualizarTarea(
  id: number,
  _prevState: TareaFormState,
  formData: FormData
): Promise<TareaFormState> {
  if (!(await requiereNivelTarea(id, "Editar"))) {
    return { error: "No tienes permiso para editar esta tarea." };
  }

  const tarea = await prisma.tarea.findUnique({ where: { id } });
  if (!tarea) return { error: "Esta tarea ya no existe." };

  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) return { error: "Escribe un título para la tarea." };

  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const prioridad = (String(formData.get("prioridad") ?? "Media") as PrioridadTarea) ?? "Media";
  const fechaLimiteRaw = String(formData.get("fechaLimite") ?? "");

  const vinculoRaw = String(formData.get("vinculo") ?? "none");
  const [tipo, idRaw] = vinculoRaw.split(":");
  const servicioId = tipo === "servicio" ? Number(idRaw) : null;
  const cotizacionId = tipo === "cotizacion" ? Number(idRaw) : null;
  const clienteId = tipo === "cliente" ? Number(idRaw) : null;

  const asignadoAIdRaw = String(formData.get("asignadoAId") ?? "");

  await prisma.tarea.update({
    where: { id },
    data: {
      titulo,
      descripcion,
      prioridad,
      fechaLimite: fechaLimiteRaw ? new Date(fechaLimiteRaw) : null,
      servicioId,
      cotizacionId,
      clienteId,
      asignadoAId: asignadoAIdRaw ? Number(asignadoAIdRaw) : null,
    },
  });

  revalidateTareaPaths(tarea.servicioId, tarea.cotizacionId, tarea.clienteId);
  revalidateTareaPaths(servicioId, cotizacionId, clienteId);
  return undefined;
}

export async function cambiarPrioridad(id: number, prioridad: PrioridadTarea) {
  if (!(await requiereNivelTarea(id, "Editar"))) return;

  const tarea = await prisma.tarea.update({ where: { id }, data: { prioridad } });
  revalidateTareaPaths(tarea.servicioId, tarea.cotizacionId, tarea.clienteId);
}

export async function crearSubtarea(tareaId: number, titulo: string) {
  if (!(await requiereNivelTarea(tareaId, "Editar"))) return;
  const limpio = titulo.trim();
  if (!limpio) return;

  const tarea = await prisma.tarea.findUnique({ where: { id: tareaId } });
  if (!tarea) return;

  await prisma.subtarea.create({ data: { tareaId, titulo: limpio } });
  revalidateTareaPaths(tarea.servicioId, tarea.cotizacionId, tarea.clienteId);
}

export async function alternarSubtarea(id: number, completada: boolean) {
  const subtareaExistente = await prisma.subtarea.findUnique({
    where: { id },
    select: { tareaId: true },
  });
  if (!subtareaExistente) return;
  if (!(await requiereNivelTarea(subtareaExistente.tareaId, "Editar"))) return;

  const subtarea = await prisma.subtarea.update({
    where: { id },
    data: { completada },
    include: { tarea: true },
  });
  revalidateTareaPaths(subtarea.tarea.servicioId, subtarea.tarea.cotizacionId, subtarea.tarea.clienteId);
}

export async function eliminarSubtarea(id: number) {
  const subtarea = await prisma.subtarea.findUnique({ where: { id }, include: { tarea: true } });
  if (!subtarea) return;
  if (!(await requiereNivelTarea(subtarea.tareaId, "Editar"))) return;

  await prisma.subtarea.delete({ where: { id } });
  revalidateTareaPaths(subtarea.tarea.servicioId, subtarea.tarea.cotizacionId, subtarea.tarea.clienteId);
}

export async function duplicarTarea(id: number) {
  if (!(await requiereNivelTarea(id, "Editar"))) return;

  const tarea = await prisma.tarea.findUnique({ where: { id } });
  if (!tarea) return;

  const userId = await currentUserId();

  await prisma.tarea.create({
    data: {
      titulo: `${tarea.titulo} (copia)`,
      descripcion: tarea.descripcion,
      prioridad: tarea.prioridad,
      fechaLimite: tarea.fechaLimite,
      servicioId: tarea.servicioId,
      cotizacionId: tarea.cotizacionId,
      clienteId: tarea.clienteId,
      creadoPorId: userId,
      asignadoAId: tarea.asignadoAId,
    },
  });

  revalidateTareaPaths(tarea.servicioId, tarea.cotizacionId, tarea.clienteId);
}
