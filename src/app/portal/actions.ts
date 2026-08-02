"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { registrarEvento } from "@/lib/evento";
import type { CategoriaQueja } from "@/generated/prisma/client";
import type { QuejaFormState } from "@/app/admin/quejas/actions";

export async function crearQuejaPortal(
  _prevState: QuejaFormState,
  formData: FormData
): Promise<QuejaFormState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "cliente") {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }
  const clienteId = Number(session.user.id);

  const servicioIdRaw = String(formData.get("servicioId") ?? "");
  let servicioId: number | null = null;
  if (servicioIdRaw && servicioIdRaw !== "none") {
    const servicio = await prisma.servicio.findUnique({ where: { id: Number(servicioIdRaw) } });
    if (!servicio || servicio.clienteId !== clienteId) {
      return { error: "El servicio seleccionado no es válido." };
    }
    servicioId = servicio.id;
  }

  const categoria = String(formData.get("categoria") ?? "") as CategoriaQueja;
  if (!categoria) return { error: "Selecciona una categoría." };

  const descripcion = String(formData.get("descripcion") ?? "").trim();
  if (!descripcion) return { error: "Describe tu queja." };

  const queja = await prisma.queja.create({
    data: { clienteId, servicioId, categoria, descripcion },
  });

  await registrarEvento("queja.creada_portal", "Queja", queja.id, { clienteId, servicioId });

  revalidatePath("/portal");
  revalidatePath("/admin/quejas");
  revalidatePath("/admin");
  return undefined;
}
