"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import type { AmbitoGasto, MetodoPago } from "@/generated/prisma/client";

export type GastoFormState = { error?: string } | undefined;

async function currentUserId() {
  const session = await auth();
  const id = session?.user?.id;
  return id ? Number(id) : null;
}

function parseGastoForm(formData: FormData) {
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const ambito = String(formData.get("ambito") ?? "Empresa") as AmbitoGasto;
  const montoRaw = String(formData.get("monto") ?? "");
  const metodoPagoRaw = String(formData.get("metodoPago") ?? "");
  const metodoPago = metodoPagoRaw && metodoPagoRaw !== "none" ? (metodoPagoRaw as MetodoPago) : null;
  const fechaRaw = String(formData.get("fecha") ?? "");
  const comprobante = String(formData.get("comprobante") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  return { descripcion, categoria, ambito, montoRaw, metodoPago, fechaRaw, comprobante, notas };
}

function validateGastoForm(data: ReturnType<typeof parseGastoForm>) {
  if (!data.descripcion) return "La descripción es obligatoria.";
  if (!data.categoria) return "La categoría es obligatoria.";
  if (!data.montoRaw || Number.isNaN(Number(data.montoRaw)) || Number(data.montoRaw) <= 0) {
    return "El monto debe ser un número mayor a cero.";
  }
  return null;
}

export async function crearGasto(
  _prevState: GastoFormState,
  formData: FormData
): Promise<GastoFormState> {
  const data = parseGastoForm(formData);
  const error = validateGastoForm(data);
  if (error) return { error };

  const userId = await currentUserId();

  await prisma.gasto.create({
    data: {
      descripcion: data.descripcion,
      categoria: data.categoria,
      ambito: data.ambito,
      monto: data.montoRaw,
      metodoPago: data.metodoPago,
      fecha: data.fechaRaw ? new Date(data.fechaRaw) : new Date(),
      comprobante: data.comprobante,
      notas: data.notas,
      creadoPorId: userId,
    },
  });

  revalidatePath("/admin/gastos");
  return undefined;
}

export async function actualizarGasto(
  id: number,
  _prevState: GastoFormState,
  formData: FormData
): Promise<GastoFormState> {
  const data = parseGastoForm(formData);
  const error = validateGastoForm(data);
  if (error) return { error };

  await prisma.gasto.update({
    where: { id },
    data: {
      descripcion: data.descripcion,
      categoria: data.categoria,
      ambito: data.ambito,
      monto: data.montoRaw,
      metodoPago: data.metodoPago,
      fecha: data.fechaRaw ? new Date(data.fechaRaw) : new Date(),
      comprobante: data.comprobante,
      notas: data.notas,
    },
  });

  revalidatePath("/admin/gastos");
  return undefined;
}

export async function eliminarGasto(id: number) {
  await prisma.gasto.delete({ where: { id } });
  revalidatePath("/admin/gastos");
}
