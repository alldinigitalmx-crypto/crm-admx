"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { registrarEvento } from "@/lib/evento";
import type {
  CanalVenta,
  MetodoPago,
  OrigenVenta,
  TipoEntrega,
} from "@/generated/prisma/client";

export type VentaFormState = { error?: string } | undefined;

type ItemInput = { productoId: number; cantidad: number; precioUnitario: number };

async function currentUserId() {
  const session = await auth();
  const id = session?.user?.id;
  return id ? Number(id) : null;
}

function parseItems(raw: string): ItemInput[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const items = parsed
      .map((it) => ({
        productoId: Number(it.productoId),
        cantidad: Number(it.cantidad),
        precioUnitario: Number(it.precioUnitario),
      }))
      .filter((it) => it.productoId > 0 && it.cantidad > 0 && it.precioUnitario >= 0);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

function parseVentaForm(formData: FormData) {
  const nombreComprador = String(formData.get("nombreComprador") ?? "").trim() || null;
  const emailComprador = String(formData.get("emailComprador") ?? "").trim() || null;
  const fechaRaw = String(formData.get("fecha") ?? "");
  const origen = String(formData.get("origen") ?? "Manual") as OrigenVenta;
  const canalRaw = String(formData.get("canal") ?? "");
  const canal = origen === "Manual" && canalRaw && canalRaw !== "none" ? (canalRaw as CanalVenta) : null;
  const metodoPagoRaw = String(formData.get("metodoPago") ?? "");
  const metodoPago = metodoPagoRaw && metodoPagoRaw !== "none" ? (metodoPagoRaw as MetodoPago) : null;
  const tipoEntrega = String(formData.get("tipoEntrega") ?? "Inmediata") as TipoEntrega;
  const referidoPorIdRaw = String(formData.get("referidoPorId") ?? "");
  const referidoPorId = referidoPorIdRaw && referidoPorIdRaw !== "none" ? Number(referidoPorIdRaw) : null;
  const comisionReferidoRaw = String(formData.get("comisionReferido") ?? "");
  const items = parseItems(String(formData.get("items") ?? "[]"));

  return {
    nombreComprador,
    emailComprador,
    fecha: fechaRaw ? new Date(fechaRaw) : new Date(),
    origen,
    canal,
    metodoPago,
    tipoEntrega,
    referidoPorId,
    comisionReferidoRaw,
    items,
  };
}

function validateVentaForm(data: ReturnType<typeof parseVentaForm>) {
  if (!data.items) return "Agrega al menos un producto con cantidad válida.";
  if (data.referidoPorId && data.comisionReferidoRaw && Number.isNaN(Number(data.comisionReferidoRaw))) {
    return "La comisión del referido debe ser un número válido.";
  }
  return null;
}

export async function crearVenta(
  _prevState: VentaFormState,
  formData: FormData
): Promise<VentaFormState> {
  const data = parseVentaForm(formData);
  const error = validateVentaForm(data);
  if (error) return { error };

  const items = data.items!;
  const total = items.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0);
  const userId = await currentUserId();

  const venta = await prisma.venta.create({
    data: {
      fecha: data.fecha,
      origen: data.origen,
      canal: data.canal,
      nombreComprador: data.nombreComprador,
      emailComprador: data.emailComprador,
      metodoPago: data.metodoPago,
      total,
      referidoPorId: data.referidoPorId,
      comisionReferido: data.referidoPorId && data.comisionReferidoRaw ? data.comisionReferidoRaw : null,
      tipoEntrega: data.tipoEntrega,
      creadoPorId: userId,
      editadoPorId: userId,
      detalles: {
        create: items.map((it) => ({
          productoId: it.productoId,
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario,
          subtotal: it.cantidad * it.precioUnitario,
        })),
      },
    },
  });

  await registrarEvento("venta.creada", "Venta", venta.id, { origen: data.origen, total });

  revalidatePath("/admin/ventas");
  revalidatePath("/admin");
  return undefined;
}

export async function actualizarVenta(
  id: number,
  _prevState: VentaFormState,
  formData: FormData
): Promise<VentaFormState> {
  const venta = await prisma.venta.findUnique({ where: { id } });
  if (!venta) return { error: "Esta venta ya no existe." };

  const data = parseVentaForm(formData);
  const error = validateVentaForm(data);
  if (error) return { error };

  const items = data.items!;
  const total = items.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0);
  const userId = await currentUserId();

  await prisma.$transaction([
    prisma.detalleVenta.deleteMany({ where: { ventaId: id } }),
    prisma.venta.update({
      where: { id },
      data: {
        fecha: data.fecha,
        origen: data.origen,
        canal: data.canal,
        nombreComprador: data.nombreComprador,
        emailComprador: data.emailComprador,
        metodoPago: data.metodoPago,
        total,
        referidoPorId: data.referidoPorId,
        comisionReferido:
          data.referidoPorId && data.comisionReferidoRaw ? data.comisionReferidoRaw : null,
        tipoEntrega: data.tipoEntrega,
        editadoPorId: userId,
        detalles: {
          create: items.map((it) => ({
            productoId: it.productoId,
            cantidad: it.cantidad,
            precioUnitario: it.precioUnitario,
            subtotal: it.cantidad * it.precioUnitario,
          })),
        },
      },
    }),
  ]);

  revalidatePath("/admin/ventas");
  revalidatePath("/admin");
  return undefined;
}

export async function eliminarVenta(id: number) {
  await prisma.detalleVenta.deleteMany({ where: { ventaId: id } });
  await prisma.venta.delete({ where: { id } });

  revalidatePath("/admin/ventas");
  revalidatePath("/admin");
}
