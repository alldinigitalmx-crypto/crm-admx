"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requiereNivel } from "@/lib/alcance";

export type IntermediarioFormState = { error?: string } | undefined;

function parseIntermediarioForm(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  return { nombre, telefono, email, notas };
}

function validateIntermediarioForm(data: ReturnType<typeof parseIntermediarioForm>) {
  if (!data.nombre) return "El nombre es obligatorio.";
  return null;
}

export async function crearIntermediario(
  _prevState: IntermediarioFormState,
  formData: FormData
): Promise<IntermediarioFormState> {
  if (!(await requiereNivel("Intermediarios", "Crear"))) {
    return { error: "No tienes permiso para crear en este módulo." };
  }

  const data = parseIntermediarioForm(formData);
  const error = validateIntermediarioForm(data);
  if (error) return { error };

  await prisma.intermediario.create({ data });

  revalidatePath("/admin/intermediarios");
  return undefined;
}

export async function actualizarIntermediario(
  id: number,
  _prevState: IntermediarioFormState,
  formData: FormData
): Promise<IntermediarioFormState> {
  if (!(await requiereNivel("Intermediarios", "Editar"))) {
    return { error: "No tienes permiso para editar en este módulo." };
  }

  const data = parseIntermediarioForm(formData);
  const error = validateIntermediarioForm(data);
  if (error) return { error };

  await prisma.intermediario.update({ where: { id }, data });

  revalidatePath("/admin/intermediarios");
  return undefined;
}

export async function eliminarIntermediario(id: number) {
  if (!(await requiereNivel("Intermediarios", "Editar"))) return;

  const serviciosAsociados = await prisma.servicio.count({ where: { intermediarioId: id } });
  if (serviciosAsociados > 0) return;

  await prisma.intermediario.delete({ where: { id } });
  revalidatePath("/admin/intermediarios");
}
