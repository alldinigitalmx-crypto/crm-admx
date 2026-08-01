"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma, type Etiqueta, type MedioCaptacion } from "@/generated/prisma/client";

export type ClienteFormState = { error?: string } | undefined;

function parseClienteForm(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const pais = String(formData.get("pais") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;
  const codigoReferido = String(formData.get("codigoReferido") ?? "").trim() || null;
  const etiquetaRaw = String(formData.get("etiqueta") ?? "");
  const medioCaptacionRaw = String(formData.get("medioCaptacion") ?? "");

  return {
    nombre,
    pais,
    telefono,
    email,
    notas,
    codigoReferido,
    etiqueta: etiquetaRaw && etiquetaRaw !== "none" ? (etiquetaRaw as Etiqueta) : null,
    medioCaptacion:
      medioCaptacionRaw && medioCaptacionRaw !== "none"
        ? (medioCaptacionRaw as MedioCaptacion)
        : null,
  };
}

export async function createCliente(
  _prevState: ClienteFormState,
  formData: FormData
): Promise<ClienteFormState> {
  const data = parseClienteForm(formData);
  if (!data.nombre) {
    return { error: "El nombre es obligatorio." };
  }

  let clienteId: number;
  try {
    const cliente = await prisma.cliente.create({ data });
    clienteId = cliente.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ese código de referido ya está en uso por otro cliente." };
    }
    throw e;
  }

  revalidatePath("/admin/clientes");
  redirect(`/admin/clientes/${clienteId}`);
}

export async function updateCliente(
  id: number,
  _prevState: ClienteFormState,
  formData: FormData
): Promise<ClienteFormState> {
  const data = parseClienteForm(formData);
  if (!data.nombre) {
    return { error: "El nombre es obligatorio." };
  }

  try {
    await prisma.cliente.update({ where: { id }, data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ese código de referido ya está en uso por otro cliente." };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { error: "Este cliente ya no existe." };
    }
    throw e;
  }

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${id}`);
  redirect(`/admin/clientes/${id}`);
}
