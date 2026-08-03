"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { registrarEvento } from "@/lib/evento";
import type { CategoriaQueja, StatusQueja } from "@/generated/prisma/client";

export type QuejaFormState = { error?: string } | undefined;

async function currentUserId() {
  const usuario = await currentUsuario();
  return usuario?.id ?? null;
}

export async function crearQueja(
  _prevState: QuejaFormState,
  formData: FormData
): Promise<QuejaFormState> {
  const clienteIdRaw = String(formData.get("clienteId") ?? "");
  const clienteId = clienteIdRaw ? Number(clienteIdRaw) : null;
  if (!clienteId) return { error: "Selecciona un cliente." };

  const servicioIdRaw = String(formData.get("servicioId") ?? "");
  const servicioId = servicioIdRaw && servicioIdRaw !== "none" ? Number(servicioIdRaw) : null;

  const categoria = String(formData.get("categoria") ?? "") as CategoriaQueja;
  if (!categoria) return { error: "Selecciona una categoría." };

  const descripcion = String(formData.get("descripcion") ?? "").trim();
  if (!descripcion) return { error: "Describe la queja." };

  const queja = await prisma.queja.create({
    data: { clienteId, servicioId, categoria, descripcion },
  });

  await registrarEvento("queja.creada", "Queja", queja.id, { clienteId, servicioId });

  revalidatePath("/admin/quejas");
  revalidatePath(`/admin/clientes/${clienteId}`);
  revalidatePath("/admin");
  return undefined;
}

export async function actualizarQueja(
  id: number,
  _prevState: QuejaFormState,
  formData: FormData
): Promise<QuejaFormState> {
  const queja = await prisma.queja.findUnique({ where: { id } });
  if (!queja) return { error: "Esta queja ya no existe." };

  const status = String(formData.get("status") ?? "") as StatusQueja;
  if (!status) return { error: "Selecciona un status." };

  const respuesta = String(formData.get("respuesta") ?? "").trim() || null;
  const asignadoAIdRaw = String(formData.get("asignadoAId") ?? "");
  const asignadoAId =
    asignadoAIdRaw && asignadoAIdRaw !== "none" ? Number(asignadoAIdRaw) : null;
  const userId = await currentUserId();
  const seResponde = Boolean(respuesta) && respuesta !== queja.respuesta;

  await prisma.queja.update({
    where: { id },
    data: {
      status,
      respuesta,
      asignadoAId,
      respondidoPorId: seResponde ? userId : queja.respondidoPorId,
      respondidoEn: seResponde ? new Date() : queja.respondidoEn,
    },
  });

  await registrarEvento("queja.actualizada", "Queja", id, { status, respondida: seResponde });

  revalidatePath("/admin/quejas");
  revalidatePath(`/admin/clientes/${queja.clienteId}`);
  revalidatePath("/admin");
  return undefined;
}

export async function eliminarQueja(id: number) {
  const queja = await prisma.queja.findUnique({ where: { id } });
  if (!queja) return;

  await prisma.queja.delete({ where: { id } });

  revalidatePath("/admin/quejas");
  revalidatePath(`/admin/clientes/${queja.clienteId}`);
  revalidatePath("/admin");
}
