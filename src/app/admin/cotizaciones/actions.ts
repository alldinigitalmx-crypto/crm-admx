"use server";

import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { registrarEvento } from "@/lib/evento";
import { montoTotalServicio } from "@/lib/servicio";
import type { Moneda, TipoDescuento } from "@/generated/prisma/client";

export type CotizacionFormState = { error?: string } | undefined;
export type PublicActionState = { error?: string; success?: boolean } | undefined;

async function currentUserId() {
  const session = await auth();
  const id = session?.user?.id;
  return id ? Number(id) : null;
}

function calcularMontoTotal(
  subtotal: number,
  tipo: TipoDescuento | null,
  valor: number | null
) {
  if (!tipo || !valor) return subtotal;
  if (tipo === "Porcentaje") return subtotal - subtotal * (valor / 100);
  return Math.max(subtotal - valor, 0);
}

function parseDescuento(formData: FormData) {
  const tipoRaw = String(formData.get("descuentoTipo") ?? "");
  const valorRaw = String(formData.get("descuentoValor") ?? "");
  const motivo = String(formData.get("descuentoMotivo") ?? "").trim() || null;

  const tipo = tipoRaw && tipoRaw !== "none" ? (tipoRaw as TipoDescuento) : null;
  const valor = tipo && valorRaw ? Number(valorRaw) : null;

  return { tipo, valor, motivo };
}

export async function crearCotizacion(
  servicioId: number,
  _prevState: CotizacionFormState,
  formData: FormData
): Promise<CotizacionFormState> {
  const servicio = await prisma.servicio.findUnique({
    where: { id: servicioId },
    include: { ordenesCambio: true },
  });
  if (!servicio) return { error: "El servicio ya no existe." };

  const { tipo, valor, motivo } = parseDescuento(formData);
  if (tipo && (!valor || valor <= 0)) {
    return { error: "Indica un valor de descuento válido." };
  }
  if (tipo && !motivo) {
    return { error: "El motivo del descuento es obligatorio." };
  }

  const fechaVencimientoRaw = String(formData.get("fechaVencimiento") ?? "");
  const monedaRaw = String(formData.get("moneda") ?? "");
  const moneda = monedaRaw && monedaRaw !== "none" ? (monedaRaw as Moneda) : null;

  const montoSubtotal = montoTotalServicio(servicio);
  const montoTotal = calcularMontoTotal(montoSubtotal, tipo, valor);
  const userId = await currentUserId();

  const cotizacion = await prisma.cotizacion.create({
    data: {
      servicioId,
      token: randomUUID(),
      montoSubtotal,
      descuentoTipo: tipo,
      descuentoValor: valor,
      descuentoMotivo: motivo,
      montoTotal,
      moneda,
      fechaVencimiento: fechaVencimientoRaw ? new Date(fechaVencimientoRaw) : null,
      creadoPorId: userId,
      editadoPorId: userId,
    },
  });

  await registrarEvento("cotizacion.creada", "Cotizacion", cotizacion.id, {
    servicioId,
    montoTotal,
  });

  revalidatePath(`/admin/servicios/${servicioId}`);
  revalidatePath("/admin/cotizaciones");
  revalidatePath("/admin");
  redirect(`/admin/cotizaciones/${cotizacion.id}`);
}

export async function actualizarCotizacion(
  id: number,
  _prevState: CotizacionFormState,
  formData: FormData
): Promise<CotizacionFormState> {
  const cotizacion = await prisma.cotizacion.findUnique({ where: { id } });
  if (!cotizacion) return { error: "La cotización ya no existe." };
  if (cotizacion.status === "Pagada") {
    return { error: "No se puede editar una cotización ya pagada." };
  }

  const { tipo, valor, motivo } = parseDescuento(formData);
  if (tipo && (!valor || valor <= 0)) {
    return { error: "Indica un valor de descuento válido." };
  }
  if (tipo && !motivo) {
    return { error: "El motivo del descuento es obligatorio." };
  }

  const fechaVencimientoRaw = String(formData.get("fechaVencimiento") ?? "");
  const montoTotal = calcularMontoTotal(Number(cotizacion.montoSubtotal), tipo, valor);
  const userId = await currentUserId();

  await prisma.cotizacion.update({
    where: { id },
    data: {
      descuentoTipo: tipo,
      descuentoValor: valor,
      descuentoMotivo: motivo,
      montoTotal,
      fechaVencimiento: fechaVencimientoRaw ? new Date(fechaVencimientoRaw) : null,
      editadoPorId: userId,
    },
  });

  revalidatePath(`/admin/cotizaciones/${id}`);
  revalidatePath("/admin/cotizaciones");
  redirect(`/admin/cotizaciones/${id}`);
}

export async function firmarCotizacion(
  token: string,
  _prevState: PublicActionState,
  formData: FormData
): Promise<PublicActionState> {
  const cotizacion = await prisma.cotizacion.findUnique({ where: { token } });
  if (!cotizacion) return { error: "Cotización no encontrada." };
  if (cotizacion.status !== "Enviada") {
    return { error: "Esta cotización ya fue firmada o no admite firma." };
  }

  const firmanteNombre = String(formData.get("firmanteNombre") ?? "").trim();
  const firmaDataUrl = String(formData.get("firma") ?? "");

  if (!firmanteNombre) return { error: "Escribe tu nombre completo." };
  if (!firmaDataUrl.startsWith("data:image")) {
    return { error: "Captura tu firma antes de continuar." };
  }

  const headersList = await headers();
  const firmanteIp =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    null;

  await prisma.$transaction([
    prisma.cotizacion.update({
      where: { id: cotizacion.id },
      data: {
        status: "Firmada",
        firmanteNombre,
        firmanteIp,
        fechaFirma: new Date(),
      },
    }),
    prisma.archivo.create({
      data: {
        entidadTipo: "Cotizacion",
        entidadId: cotizacion.id,
        nombre: `firma-${cotizacion.id}.png`,
        url: firmaDataUrl,
        tipo: "Imagen",
      },
    }),
  ]);

  await registrarEvento("cotizacion.firmada", "Cotizacion", cotizacion.id, {
    firmanteNombre,
  });

  revalidatePath(`/cotizacion/${token}`);
  revalidatePath(`/admin/cotizaciones/${cotizacion.id}`);
  return { success: true };
}

export async function reportarPagoTransferencia(
  token: string,
  _prevState: PublicActionState,
  formData: FormData
): Promise<PublicActionState> {
  const cotizacion = await prisma.cotizacion.findUnique({ where: { token } });
  if (!cotizacion) return { error: "Cotización no encontrada." };
  if (cotizacion.status === "Pagada") {
    return { error: "Esta cotización ya fue pagada." };
  }

  const referencia = String(formData.get("referencia") ?? "").trim();
  const comprobanteDataUrl = String(formData.get("comprobante") ?? "");

  if (!comprobanteDataUrl.startsWith("data:")) {
    return { error: "Sube tu comprobante de transferencia." };
  }

  const pago = await prisma.pago.create({
    data: {
      servicioId: cotizacion.servicioId,
      cotizacionId: cotizacion.id,
      metodoPago: "Transferencia",
      monto: cotizacion.montoTotal,
      confirmado: false,
      comprobante: referencia || null,
    },
  });

  await prisma.archivo.create({
    data: {
      entidadTipo: "Cotizacion",
      entidadId: cotizacion.id,
      nombre: `comprobante-${cotizacion.id}`,
      url: comprobanteDataUrl,
      tipo: comprobanteDataUrl.startsWith("data:application/pdf") ? "Documento" : "Imagen",
    },
  });

  await registrarEvento("cotizacion.pago_reportado", "Cotizacion", cotizacion.id, {
    pagoId: pago.id,
  });

  revalidatePath(`/cotizacion/${token}`);
  revalidatePath(`/admin/cotizaciones/${cotizacion.id}`);
  return { success: true };
}

export async function confirmarPagoCotizacion(cotizacionId: number, pagoId: number) {
  const cotizacion = await prisma.cotizacion.findUnique({ where: { id: cotizacionId } });
  if (!cotizacion) return;

  const userId = await currentUserId();

  await prisma.$transaction([
    prisma.pago.update({
      where: { id: pagoId },
      data: { confirmado: true, confirmadoPorId: userId, confirmadoEn: new Date() },
    }),
    prisma.cotizacion.update({
      where: { id: cotizacionId },
      data: { status: "Pagada", pagoConfirmado: true, fechaPago: new Date() },
    }),
  ]);

  await registrarEvento("cotizacion.pago_confirmado", "Cotizacion", cotizacionId, {
    pagoId,
  });

  revalidatePath(`/admin/cotizaciones/${cotizacionId}`);
  revalidatePath(`/admin/servicios/${cotizacion.servicioId}`);
  revalidatePath("/admin/cotizaciones");
  revalidatePath("/admin");
}
