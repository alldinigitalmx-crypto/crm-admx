"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { requiereNivelPago, requiereNivelPagoNuevo } from "@/lib/alcance";
import { registrarEvento } from "@/lib/evento";
import { cotizacionQuedaSaldada } from "@/lib/cotizacion";
import type { Moneda, MetodoPago } from "@/generated/prisma/client";

export type PagoFormState = { error?: string } | undefined;

async function currentUserId() {
  const usuario = await currentUsuario();
  return usuario?.id ?? null;
}

function parsePagoForm(formData: FormData) {
  const servicioIdRaw = String(formData.get("servicioId") ?? "");
  const fechaRaw = String(formData.get("fecha") ?? "");
  const metodoPago = String(formData.get("metodoPago") ?? "") as MetodoPago;
  const montoRaw = String(formData.get("monto") ?? "");
  const comisionRaw = String(formData.get("comision") ?? "");
  const monedaRaw = String(formData.get("moneda") ?? "");
  const moneda = monedaRaw && monedaRaw !== "none" ? (monedaRaw as Moneda) : null;
  // Solo aplica cuando la moneda no es MXN — el campo ni se muestra en el
  // formulario si moneda es MXN/nula, así que aquí se ignora lo que traiga.
  const montoMXNRaw = moneda && moneda !== "MXN" ? String(formData.get("montoMXN") ?? "") : "";
  // El select de Cuenta solo se manda al formulario para un Admin — si el
  // campo ni siquiera vino (usuario interno normal) no se debe tocar el
  // cuentaId que ya tuviera el pago, a diferencia de que sí venga vacío
  // ("Sin cuenta" elegido a propósito).
  const cuentaIdRaw = formData.get("cuentaId");
  const cuentaIdProvisto = cuentaIdRaw !== null;
  const cuentaId = cuentaIdRaw && cuentaIdRaw !== "none" ? Number(cuentaIdRaw) : null;
  const comprobante = String(formData.get("comprobante") ?? "").trim() || null;
  const comprobanteArchivo = String(formData.get("comprobanteArchivo") ?? "").trim() || null;
  const confirmado = formData.get("confirmado") === "on";

  return {
    servicioId: servicioIdRaw ? Number(servicioIdRaw) : null,
    fecha: fechaRaw ? new Date(fechaRaw) : new Date(),
    metodoPago,
    montoRaw,
    comisionRaw,
    moneda,
    montoMXNRaw,
    cuentaId,
    cuentaIdProvisto,
    comprobante,
    comprobanteArchivo,
    confirmado,
  };
}

async function guardarArchivoComprobante(pagoId: number, dataUrl: string, userId: number | null) {
  await prisma.archivo.create({
    data: {
      entidadTipo: "Pago",
      entidadId: pagoId,
      nombre: `comprobante-pago-${pagoId}`,
      url: dataUrl,
      tipo: dataUrl.startsWith("data:application/pdf") ? "Documento" : "Imagen",
      subidoPorId: userId,
    },
  });
}

function validatePagoForm(data: ReturnType<typeof parsePagoForm>) {
  if (!data.servicioId) return "Selecciona un servicio.";
  if (!data.metodoPago) return "Selecciona un método de pago.";
  if (!data.montoRaw || Number.isNaN(Number(data.montoRaw)) || Number(data.montoRaw) <= 0) {
    return "El monto debe ser un número mayor a cero.";
  }
  if (data.comisionRaw && (Number.isNaN(Number(data.comisionRaw)) || Number(data.comisionRaw) < 0)) {
    return "La comisión debe ser un número válido.";
  }
  if (
    data.moneda &&
    data.moneda !== "MXN" &&
    (!data.montoMXNRaw || Number.isNaN(Number(data.montoMXNRaw)) || Number(data.montoMXNRaw) <= 0)
  ) {
    return "Captura el equivalente en pesos (MXN) de este pago.";
  }
  return null;
}

export async function crearPago(
  _prevState: PagoFormState,
  formData: FormData
): Promise<PagoFormState> {
  const data = parsePagoForm(formData);
  const error = validatePagoForm(data);
  if (error) return { error };

  // Se valida contra el servicio ya parseado: con alcance "Propio" solo
  // se puede registrar un pago sobre un servicio del que se es
  // responsable, no sobre cualquiera con solo conocer su id.
  if (!(await requiereNivelPagoNuevo(data.servicioId!))) {
    return { error: "No tienes permiso para registrar un pago en ese servicio." };
  }

  const userId = await currentUserId();

  const pago = await prisma.pago.create({
    data: {
      servicioId: data.servicioId!,
      fecha: data.fecha,
      metodoPago: data.metodoPago,
      monto: data.montoRaw,
      comision: data.comisionRaw || null,
      // Captura manual: "monto" es lo que de verdad llegó (neto) y la
      // comisión es solo informativa, no se resta de nuevo -- pedirle al
      // usuario el bruto que cobró la pasarela antes de su comisión era
      // tedioso y propenso a error (rara vez lo sabe de memoria). Los
      // pagos que sí captura la app sola vía webhook (MercadoPago/PayPal,
      // ver esas rutas) conocen el bruto y la comisión exactos de la API
      // del propio gateway, así que esos sí guardan montoIncluyeComision
      // true -- ver montoNetoEnMXN en src/lib/pago-monto.ts.
      montoIncluyeComision: false,
      moneda: data.moneda,
      montoMXN: data.montoMXNRaw || null,
      cuentaId: data.cuentaId,
      comprobante: data.comprobante,
      confirmado: data.confirmado,
      confirmadoPorId: data.confirmado ? userId : null,
      confirmadoEn: data.confirmado ? new Date() : null,
    },
  });

  await registrarEvento("pago.creado", "Pago", pago.id, {
    servicioId: data.servicioId,
    monto: data.montoRaw,
  });

  if (data.comprobanteArchivo) {
    await guardarArchivoComprobante(pago.id, data.comprobanteArchivo, userId);
  }

  revalidatePath("/admin/pagos");
  revalidatePath(`/admin/servicios/${data.servicioId}`);
  revalidatePath("/admin");
  return undefined;
}

export async function actualizarPago(
  id: number,
  _prevState: PagoFormState,
  formData: FormData
): Promise<PagoFormState> {
  if (!(await requiereNivelPago(id, "Editar"))) {
    return { error: "No tienes permiso para editar este pago." };
  }

  const pago = await prisma.pago.findUnique({ where: { id } });
  if (!pago) return { error: "Este pago ya no existe." };

  const data = parsePagoForm(formData);
  const error = validatePagoForm(data);
  if (error) return { error };

  // Si además está moviendo el pago a otro servicio, ese destino también
  // debe ser suyo — si no, con alcance "Propio" podría "regalarse" un
  // pago de un servicio ajeno con solo cambiar el select del formulario.
  if (data.servicioId !== pago.servicioId && !(await requiereNivelPagoNuevo(data.servicioId!))) {
    return { error: "No tienes permiso para mover el pago a ese servicio." };
  }

  const userId = await currentUserId();
  const seConfirmaAhora = data.confirmado && !pago.confirmado;

  await prisma.pago.update({
    where: { id },
    data: {
      servicioId: data.servicioId!,
      fecha: data.fecha,
      metodoPago: data.metodoPago,
      monto: data.montoRaw,
      comision: data.comisionRaw || null,
      // Igual que crearPago: en cuanto una persona edita el monto a mano
      // en este formulario, se asume que lo que escribió es lo que de
      // verdad llegó (neto) y la comisión pasa a ser solo informativa.
      // Si no se forzara aquí, un pago que había quedado con
      // montoIncluyeComision=true (creado por el webhook de MercadoPago/
      // PayPal) le volvía a restar la comisión sobre un monto que la
      // persona ya había corregido a neto -- descontándola dos veces.
      montoIncluyeComision: false,
      moneda: data.moneda,
      montoMXN: data.montoMXNRaw || null,
      ...(data.cuentaIdProvisto ? { cuentaId: data.cuentaId } : {}),
      comprobante: data.comprobante,
      confirmado: data.confirmado,
      confirmadoPorId: seConfirmaAhora ? userId : pago.confirmadoPorId,
      confirmadoEn: seConfirmaAhora ? new Date() : pago.confirmadoEn,
    },
  });

  if (data.comprobanteArchivo) {
    // Reemplaza el comprobante anterior (si había) en vez de acumular varios.
    await prisma.archivo.deleteMany({ where: { entidadTipo: "Pago", entidadId: id } });
    await guardarArchivoComprobante(id, data.comprobanteArchivo, userId);
  }

  revalidatePath("/admin/pagos");
  revalidatePath(`/admin/servicios/${data.servicioId}`);
  if (pago.servicioId !== data.servicioId) revalidatePath(`/admin/servicios/${pago.servicioId}`);
  revalidatePath("/admin");
  return undefined;
}

export async function eliminarPago(id: number) {
  if (!(await requiereNivelPago(id, "Editar"))) return;

  const pago = await prisma.pago.findUnique({ where: { id } });
  if (!pago) return;

  await prisma.archivo.deleteMany({ where: { entidadTipo: "Pago", entidadId: id } });
  await prisma.pago.delete({ where: { id } });

  revalidatePath("/admin/pagos");
  revalidatePath(`/admin/servicios/${pago.servicioId}`);
  revalidatePath("/admin");
}

export type ComprobanteFormState = { error?: string } | undefined;

export async function subirComprobantePago(
  pagoId: number,
  _prevState: ComprobanteFormState,
  formData: FormData
): Promise<ComprobanteFormState> {
  if (!(await requiereNivelPago(pagoId, "Editar"))) {
    return { error: "No tienes permiso para editar este pago." };
  }

  const dataUrl = String(formData.get("imagen") ?? "");
  if (!dataUrl.startsWith("data:")) {
    return { error: "Selecciona una imagen o PDF." };
  }

  const pago = await prisma.pago.findUnique({ where: { id: pagoId } });
  if (!pago) return { error: "Este pago ya no existe." };

  const userId = await currentUserId();

  await guardarArchivoComprobante(pagoId, dataUrl, userId);

  revalidatePath("/admin/pagos");
  revalidatePath(`/admin/servicios/${pago.servicioId}`);
  return undefined;
}

export async function eliminarComprobantePago(archivoId: number, servicioId: number) {
  if (!(await requiereNivelPagoNuevo(servicioId, "Editar"))) return;

  await prisma.archivo.delete({ where: { id: archivoId } });

  revalidatePath("/admin/pagos");
  revalidatePath(`/admin/servicios/${servicioId}`);
}

export async function confirmarPago(id: number) {
  if (!(await requiereNivelPago(id, "Editar"))) return;

  const pago = await prisma.pago.findUnique({ where: { id } });
  if (!pago || pago.confirmado) return;

  const userId = await currentUserId();

  let quedaSaldada = false;
  if (pago.cotizacionId) {
    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id: pago.cotizacionId },
      include: { pagos: true },
    });
    if (cotizacion) {
      const pagosConEsteConfirmado = cotizacion.pagos.map((p) =>
        p.id === id ? { ...p, confirmado: true } : p
      );
      quedaSaldada = cotizacionQuedaSaldada(cotizacion, pagosConEsteConfirmado);
    }
  }

  await prisma.$transaction([
    prisma.pago.update({
      where: { id },
      data: { confirmado: true, confirmadoPorId: userId, confirmadoEn: new Date() },
    }),
    ...(pago.cotizacionId && quedaSaldada
      ? [
          prisma.cotizacion.update({
            where: { id: pago.cotizacionId },
            data: { status: "Pagada" as const, pagoConfirmado: true, fechaPago: new Date() },
          }),
        ]
      : []),
  ]);

  await registrarEvento("pago.confirmado", "Pago", id, { quedaSaldada });

  revalidatePath("/admin/pagos");
  revalidatePath(`/admin/servicios/${pago.servicioId}`);
  if (pago.cotizacionId) revalidatePath(`/admin/cotizaciones/${pago.cotizacionId}`);
  revalidatePath("/admin/cotizaciones");
  revalidatePath("/admin");
}
