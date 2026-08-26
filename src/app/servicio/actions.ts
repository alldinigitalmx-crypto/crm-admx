"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/lib/evento";
import type { CategoriaQueja } from "@/generated/prisma/client";
import type { QuejaFormState } from "@/app/admin/quejas/actions";

// Igual que firmarCotizacion (admin/cotizaciones/actions.ts): sin sesión,
// el token público de /servicio/[token] es la única credencial. El
// cliente se toma del propio servicio (nunca del formulario), así que no
// hay forma de mandar una queja a nombre de otro cliente con solo
// adivinar un servicioId.
export async function crearQuejaPublica(
  token: string,
  _prevState: QuejaFormState,
  formData: FormData
): Promise<QuejaFormState> {
  const servicio = await prisma.servicio.findUnique({ where: { tokenPublico: token } });
  if (!servicio) return { error: "No se encontró el proyecto." };

  const categoria = String(formData.get("categoria") ?? "") as CategoriaQueja;
  if (!categoria) return { error: "Selecciona una categoría." };

  const descripcion = String(formData.get("descripcion") ?? "").trim();
  if (!descripcion) return { error: "Escribe tu queja o sugerencia." };

  const queja = await prisma.queja.create({
    data: {
      clienteId: servicio.clienteId,
      servicioId: servicio.id,
      categoria,
      descripcion,
    },
  });

  await registrarEvento("queja.creada_publica", "Queja", queja.id, {
    clienteId: servicio.clienteId,
    servicioId: servicio.id,
  });

  revalidatePath(`/servicio/${token}`);
  revalidatePath("/admin/quejas");
  revalidatePath("/admin");
  return undefined;
}
