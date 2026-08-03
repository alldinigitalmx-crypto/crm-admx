"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import type { PrioridadTarea } from "@/generated/prisma/client";

export type TareaFormState = { error?: string } | undefined;

async function currentUserId() {
  const usuario = await currentUsuario();
  return usuario?.id ?? null;
}

function revalidateTareaPaths(servicioId: number | null, cotizacionId: number | null) {
  revalidatePath("/admin/tareas");
  revalidatePath("/admin");
  if (servicioId) revalidatePath(`/admin/servicios/${servicioId}`);
  if (cotizacionId) revalidatePath(`/admin/cotizaciones/${cotizacionId}`);
}

export async function crearTarea(
  _prevState: TareaFormState,
  formData: FormData
): Promise<TareaFormState> {
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) return { error: "Escribe un título para la tarea." };

  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const prioridad = (String(formData.get("prioridad") ?? "Media") as PrioridadTarea) ?? "Media";
  const fechaLimiteRaw = String(formData.get("fechaLimite") ?? "");

  const vinculoRaw = String(formData.get("vinculo") ?? "none");
  const [tipo, idRaw] = vinculoRaw.split(":");
  const servicioId = tipo === "servicio" ? Number(idRaw) : null;
  const cotizacionId = tipo === "cotizacion" ? Number(idRaw) : null;

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
      creadoPorId: userId,
      asignadoAId: asignadoAIdRaw ? Number(asignadoAIdRaw) : userId,
    },
  });

  revalidateTareaPaths(servicioId, cotizacionId);
  return undefined;
}

export async function completarTarea(id: number, completada: boolean) {
  const tarea = await prisma.tarea.update({
    where: { id },
    data: { completada, completadaEn: completada ? new Date() : null },
  });

  revalidateTareaPaths(tarea.servicioId, tarea.cotizacionId);
}

export async function eliminarTarea(id: number) {
  const tarea = await prisma.tarea.findUnique({ where: { id } });
  if (!tarea) return;

  await prisma.tarea.delete({ where: { id } });
  revalidateTareaPaths(tarea.servicioId, tarea.cotizacionId);
}
