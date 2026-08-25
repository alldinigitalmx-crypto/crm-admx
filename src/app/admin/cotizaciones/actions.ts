"use server";

import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import {
  requiereNivel,
  requiereNivelCotizacion,
  requiereNivelCotizacionNuevaParaServicio,
} from "@/lib/alcance";
import { registrarEvento } from "@/lib/evento";
import { montoTotalServicio } from "@/lib/servicio";
import { cotizacionQuedaSaldada, montoAPagarAhora } from "@/lib/cotizacion";
import { asegurarServicioParaCotizacion } from "@/lib/cotizacion-servicio";
import type { Moneda, TipoDescuento } from "@/generated/prisma/client";

export type CotizacionFormState = { error?: string } | undefined;
export type PublicActionState = { error?: string; success?: boolean } | undefined;

async function currentUserId() {
  const usuario = await currentUsuario();
  return usuario?.id ?? null;
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

function parsePorcentajeAnticipo(formData: FormData): number | null {
  const raw = String(formData.get("porcentajeAnticipo") ?? "").trim();
  if (!raw) return null;
  const valor = Math.round(Number(raw));
  if (!Number.isFinite(valor) || valor < 1 || valor > 99) return null;
  return valor;
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
  _prevState: CotizacionFormState,
  formData: FormData
): Promise<CotizacionFormState> {
  if (!(await requiereNivel("Cotizaciones", "Crear"))) {
    return { error: "No tienes permiso para crear en este módulo." };
  }

  const servicioIdRaw = String(formData.get("servicioId") ?? "");
  const servicioId = servicioIdRaw && servicioIdRaw !== "none" ? Number(servicioIdRaw) : null;

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
  const userId = await currentUserId();

  let clienteId: number | null;
  let prospectoNombre: string | null = null;
  let ordenCambioId: number | null = null;
  let descripcion: string | null = null;
  let detalles: string | null = null;
  let montoSubtotal: number;

  if (servicioId) {
    const servicio = await prisma.servicio.findUnique({
      where: { id: servicioId },
      include: { ordenesCambio: true },
    });
    if (!servicio) return { error: "El servicio ya no existe." };
    if (!(await requiereNivelCotizacionNuevaParaServicio(servicioId))) {
      return { error: "No tienes permiso para cotizar sobre ese servicio." };
    }

    const ordenCambioIdRaw = String(formData.get("ordenCambioId") ?? "");
    ordenCambioId = ordenCambioIdRaw && ordenCambioIdRaw !== "none" ? Number(ordenCambioIdRaw) : null;

    let ordenCambio = null;
    if (ordenCambioId) {
      ordenCambio = servicio.ordenesCambio.find((o) => o.id === ordenCambioId) ?? null;
      if (!ordenCambio) return { error: "La orden de cambio seleccionada no pertenece a este servicio." };
    }

    clienteId = servicio.clienteId;
    montoSubtotal = ordenCambio ? Number(ordenCambio.monto) : montoTotalServicio(servicio);
  } else {
    const clienteIdRaw = String(formData.get("clienteId") ?? "");

    if (clienteIdRaw === "__prospecto__") {
      prospectoNombre = String(formData.get("prospectoNombre") ?? "").trim();
      if (!prospectoNombre) return { error: "Escribe el nombre del prospecto." };
      clienteId = null;
    } else {
      const id = Number(clienteIdRaw);
      if (!id) return { error: "Selecciona un cliente." };
      const cliente = await prisma.cliente.findUnique({ where: { id } });
      if (!cliente) return { error: "El cliente ya no existe." };
      clienteId = cliente.id;
    }

    descripcion = String(formData.get("descripcion") ?? "").trim();
    if (!descripcion) return { error: "Describe brevemente qué se está cotizando." };
    detalles = String(formData.get("detalles") ?? "").trim() || null;

    const montoSubtotalRaw = Number(formData.get("montoSubtotal") ?? "");
    if (!montoSubtotalRaw || montoSubtotalRaw <= 0) {
      return { error: "Indica el monto de la cotización." };
    }

    montoSubtotal = montoSubtotalRaw;
  }

  const montoTotal = calcularMontoTotal(montoSubtotal, tipo, valor);
  const porcentajeAnticipo = parsePorcentajeAnticipo(formData);

  const cotizacion = await prisma.cotizacion.create({
    data: {
      clienteId,
      prospectoNombre,
      servicioId,
      ordenCambioId,
      descripcion,
      detalles,
      token: randomUUID(),
      montoSubtotal,
      descuentoTipo: tipo,
      descuentoValor: valor,
      descuentoMotivo: motivo,
      montoTotal,
      moneda,
      porcentajeAnticipo,
      fechaVencimiento: fechaVencimientoRaw ? new Date(fechaVencimientoRaw) : null,
      creadoPorId: userId,
      editadoPorId: userId,
    },
  });

  await registrarEvento("cotizacion.creada", "Cotizacion", cotizacion.id, {
    servicioId,
    ordenCambioId,
    montoTotal,
  });

  if (servicioId) revalidatePath(`/admin/servicios/${servicioId}`);
  revalidatePath("/admin/cotizaciones");
  revalidatePath("/admin");
  redirect(`/admin/cotizaciones/${cotizacion.id}`);
}

export async function actualizarCotizacion(
  id: number,
  _prevState: CotizacionFormState,
  formData: FormData
): Promise<CotizacionFormState> {
  if (!(await requiereNivelCotizacion(id, "Editar"))) {
    return { error: "No tienes permiso para editar esta cotización." };
  }

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
  const userId = await currentUserId();

  let montoSubtotal = Number(cotizacion.montoSubtotal);
  let descripcion = cotizacion.descripcion;
  let detalles = cotizacion.detalles;

  if (!cotizacion.servicioId) {
    descripcion = String(formData.get("descripcion") ?? "").trim() || descripcion;
    detalles = String(formData.get("detalles") ?? "").trim() || null;
    const montoSubtotalRaw = Number(formData.get("montoSubtotal") ?? "");
    if (montoSubtotalRaw > 0) montoSubtotal = montoSubtotalRaw;
  }

  const montoTotal = calcularMontoTotal(montoSubtotal, tipo, valor);
  const porcentajeAnticipo = parsePorcentajeAnticipo(formData);

  await prisma.cotizacion.update({
    where: { id },
    data: {
      descripcion,
      detalles,
      montoSubtotal,
      descuentoTipo: tipo,
      descuentoValor: valor,
      descuentoMotivo: motivo,
      montoTotal,
      porcentajeAnticipo,
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
  const cotizacion = await prisma.cotizacion.findUnique({
    where: { token },
    include: { servicio: true, ordenCambio: true },
  });
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

  const servicioSeAprueba = cotizacion.servicio?.status === "Cotizado";
  const ordenSeAprueba = cotizacion.ordenCambio?.status === "Pendiente";
  const userId = await currentUserId();

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
    ...(servicioSeAprueba && cotizacion.servicioId
      ? [
          prisma.servicio.update({
            where: { id: cotizacion.servicioId },
            data: { status: "Aprobado" },
          }),
        ]
      : []),
    ...(ordenSeAprueba && cotizacion.ordenCambioId
      ? [
          prisma.ordenCambio.update({
            where: { id: cotizacion.ordenCambioId },
            data: { status: "Aprobada", aprobadoPorId: userId, aprobadoEn: new Date() },
          }),
        ]
      : []),
  ]);

  await registrarEvento("cotizacion.firmada", "Cotizacion", cotizacion.id, {
    firmanteNombre,
    servicioAprobado: servicioSeAprueba,
    ordenCambioAprobada: ordenSeAprueba,
  });

  revalidatePath(`/cotizacion/${token}`);
  revalidatePath(`/admin/cotizaciones/${cotizacion.id}`);
  if (cotizacion.servicioId) revalidatePath(`/admin/servicios/${cotizacion.servicioId}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function reportarPagoTransferencia(
  token: string,
  _prevState: PublicActionState,
  formData: FormData
): Promise<PublicActionState> {
  const cotizacion = await prisma.cotizacion.findUnique({
    where: { token },
    include: { pagos: true },
  });
  if (!cotizacion) return { error: "Cotización no encontrada." };
  if (cotizacion.status === "Pagada") {
    return { error: "Esta cotización ya fue pagada." };
  }

  const servicioId = await asegurarServicioParaCotizacion(cotizacion.id);
  if (!servicioId) {
    return {
      error:
        "Este proyecto todavía está en negociación con un prospecto sin registrar. Contáctanos para poder recibir tu pago.",
    };
  }

  const monto = montoAPagarAhora(cotizacion, cotizacion.pagos);
  const referencia = String(formData.get("referencia") ?? "").trim();
  const comprobanteDataUrl = String(formData.get("comprobante") ?? "");
  const metodoRaw = String(formData.get("metodoPago") ?? "Transferencia");
  const metodosValidos = ["Transferencia", "Spin", "Binance"];
  const metodoPago = (
    metodosValidos.includes(metodoRaw) ? metodoRaw : "Transferencia"
  ) as "Transferencia" | "Spin" | "Binance";

  if (!comprobanteDataUrl.startsWith("data:")) {
    return { error: "Sube tu comprobante de pago." };
  }

  const pago = await prisma.pago.create({
    data: {
      servicioId,
      cotizacionId: cotizacion.id,
      metodoPago,
      monto,
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
  revalidatePath(`/admin/servicios/${servicioId}`);
  revalidatePath("/admin/servicios");
  revalidatePath("/admin");
  return { success: true };
}

export async function eliminarCotizacion(id: number) {
  if (!(await requiereNivelCotizacion(id, "Editar"))) return;

  const cotizacion = await prisma.cotizacion.findUnique({ where: { id } });
  if (!cotizacion || cotizacion.status === "Pagada") return;

  const servicioId = cotizacion.servicioId;

  await prisma.archivo.deleteMany({ where: { entidadTipo: "Cotizacion", entidadId: id } });
  await prisma.eventoSistema.deleteMany({ where: { entidadTipo: "Cotizacion", entidadId: id } });
  await prisma.tarea.deleteMany({ where: { cotizacionId: id } });
  await prisma.cotizacion.delete({ where: { id } });

  revalidatePath("/admin/cotizaciones");
  if (servicioId) revalidatePath(`/admin/servicios/${servicioId}`);
  revalidatePath("/admin");
  redirect("/admin/cotizaciones");
}

// Conversión manual desde el admin — sigue disponible para quien prefiera
// formalizar el proyecto antes de que el cliente pague. Ya no es requisito
// para poder cobrar: eso lo cubre asegurarServicioParaCotizacion en el
// momento del pago (ver reportarPagoTransferencia, pagar-mercadopago,
// pagar-paypal, y las confirmaciones de pago).
export async function convertirEnServicio(cotizacionId: number) {
  if (!(await requiereNivelCotizacion(cotizacionId, "Editar"))) return;

  const cotizacion = await prisma.cotizacion.findUnique({ where: { id: cotizacionId } });
  if (!cotizacion) return;
  if (cotizacion.status !== "Firmada" || cotizacion.servicioId) return;
  // Un Servicio siempre necesita un cliente real — si sigue siendo
  // prospecto, primero hay que convertirlo en cliente.
  if (!cotizacion.clienteId) return;

  const userId = await currentUserId();
  const servicioId = await asegurarServicioParaCotizacion(cotizacionId, userId);
  if (!servicioId) return;

  revalidatePath(`/admin/cotizaciones/${cotizacionId}`);
  revalidatePath("/admin/cotizaciones");
  revalidatePath("/admin");
  redirect(`/admin/servicios/${servicioId}`);
}

export async function marcarCotizacionGanada(id: number) {
  if (!(await requiereNivelCotizacion(id, "Editar"))) return;

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id },
    include: { servicio: true, ordenCambio: true },
  });
  if (!cotizacion || cotizacion.status !== "Enviada") return;

  const servicioSeAprueba = cotizacion.servicio?.status === "Cotizado";
  const ordenSeAprueba = cotizacion.ordenCambio?.status === "Pendiente";
  const userId = await currentUserId();

  await prisma.$transaction([
    prisma.cotizacion.update({
      where: { id },
      data: { status: "Firmada", fechaFirma: new Date() },
    }),
    ...(servicioSeAprueba && cotizacion.servicioId
      ? [
          prisma.servicio.update({
            where: { id: cotizacion.servicioId },
            data: { status: "Aprobado" as const },
          }),
        ]
      : []),
    ...(ordenSeAprueba && cotizacion.ordenCambioId
      ? [
          prisma.ordenCambio.update({
            where: { id: cotizacion.ordenCambioId },
            data: { status: "Aprobada" as const, aprobadoPorId: userId, aprobadoEn: new Date() },
          }),
        ]
      : []),
  ]);

  await registrarEvento("cotizacion.ganada_manual", "Cotizacion", id, {});

  revalidatePath(`/admin/cotizaciones/${id}`);
  revalidatePath("/admin/cotizaciones");
  if (cotizacion.servicioId) revalidatePath(`/admin/servicios/${cotizacion.servicioId}`);
  revalidatePath("/admin");
}

export async function marcarCotizacionPerdida(id: number) {
  if (!(await requiereNivelCotizacion(id, "Editar"))) return;

  const cotizacion = await prisma.cotizacion.findUnique({ where: { id } });
  if (!cotizacion || cotizacion.status !== "Enviada") return;

  await prisma.cotizacion.update({ where: { id }, data: { status: "Perdida" } });
  await registrarEvento("cotizacion.perdida", "Cotizacion", id, {});

  revalidatePath(`/admin/cotizaciones/${id}`);
  revalidatePath("/admin/cotizaciones");
  revalidatePath("/admin");
}

export async function confirmarPagoCotizacion(cotizacionId: number, pagoId: number) {
  if (!(await requiereNivelCotizacion(cotizacionId, "Editar"))) return;

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id: cotizacionId },
    include: { pagos: true },
  });
  if (!cotizacion) return;

  const userId = await currentUserId();

  // El pago que se está confirmando todavía cuenta como no-confirmado en
  // cotizacion.pagos (se acaba de leer de la base), así que lo sumamos a
  // mano para saber si con este pago ya queda saldada.
  const pagoQueSeConfirma = cotizacion.pagos.find((p) => p.id === pagoId);
  const pagosConEsteConfirmado = cotizacion.pagos.map((p) =>
    p.id === pagoId ? { ...p, confirmado: true } : p
  );
  const quedaSaldada = pagoQueSeConfirma
    ? cotizacionQuedaSaldada(cotizacion, pagosConEsteConfirmado)
    : false;

  await prisma.$transaction([
    prisma.pago.update({
      where: { id: pagoId },
      data: { confirmado: true, confirmadoPorId: userId, confirmadoEn: new Date() },
    }),
    ...(quedaSaldada
      ? [
          prisma.cotizacion.update({
            where: { id: cotizacionId },
            data: { status: "Pagada" as const, pagoConfirmado: true, fechaPago: new Date() },
          }),
        ]
      : []),
  ]);

  await registrarEvento("cotizacion.pago_confirmado", "Cotizacion", cotizacionId, {
    pagoId,
    quedaSaldada,
  });

  revalidatePath(`/admin/cotizaciones/${cotizacionId}`);
  if (cotizacion.servicioId) revalidatePath(`/admin/servicios/${cotizacion.servicioId}`);
  revalidatePath("/admin/cotizaciones");
  revalidatePath("/admin");
}
