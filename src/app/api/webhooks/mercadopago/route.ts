import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { obtenerPagoMercadoPago, comisionMercadoPago } from "@/lib/mercadopago";
import { registrarEvento } from "@/lib/evento";
import { cotizacionQuedaSaldada } from "@/lib/cotizacion";
import { asegurarServicioParaCotizacion } from "@/lib/cotizacion-servicio";

// Mercado Pago notifica con distintos formatos según el origen del evento:
// query params (?type=payment&data.id=123) o body JSON ({type, data:{id}}).
// Aceptamos ambos y siempre respondemos 200 para que MP no reintente
// indefinidamente, incluso si el pago no aplica (ej. otro tipo de evento).
async function extraerPaymentId(request: Request): Promise<string | null> {
  const url = new URL(request.url);
  const tipoQuery = url.searchParams.get("type") ?? url.searchParams.get("topic");
  const idQuery = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (idQuery && (!tipoQuery || tipoQuery === "payment")) return idQuery;

  try {
    const body = await request.json();
    if ((body?.type ?? body?.topic) === "payment" && body?.data?.id) {
      return String(body.data.id);
    }
  } catch {
    // sin body JSON válido, no hay más de dónde sacar el id
  }
  return null;
}

export async function POST(request: Request) {
  const paymentId = await extraerPaymentId(request);
  if (!paymentId) return NextResponse.json({ ok: true });

  try {
    const pago = await obtenerPagoMercadoPago(paymentId);
    if (pago.status !== "approved" || !pago.external_reference) {
      return NextResponse.json({ ok: true });
    }

    const cotizacion = await prisma.cotizacion.findUnique({
      where: { token: pago.external_reference },
      include: { pagos: true },
    });
    if (!cotizacion) {
      return NextResponse.json({ ok: true });
    }

    // Idempotencia: si ya se registró este pago de MP o la cotización ya
    // quedó pagada, no dupliques el registro (MP reintenta notificaciones).
    const referencia = `MP-${paymentId}`;
    const existente = await prisma.pago.findFirst({ where: { comprobante: referencia } });
    if (existente || cotizacion.status === "Pagada") {
      return NextResponse.json({ ok: true });
    }

    // Red de seguridad: en el flujo normal ya se creó el Servicio al
    // iniciar el pago (pagar-mercadopago), pero por si este webhook llega
    // para una cotización que aún no lo tiene, lo aseguramos aquí también
    // para no perder un pago real ya aprobado por Mercado Pago.
    const servicioId = await asegurarServicioParaCotizacion(cotizacion.id);
    if (!servicioId) {
      return NextResponse.json({ ok: true });
    }

    const quedaSaldada = cotizacionQuedaSaldada(cotizacion, [
      ...cotizacion.pagos,
      { monto: pago.transaction_amount, confirmado: true },
    ]);

    const nuevoPago = await prisma.$transaction(async (tx) => {
      const creado = await tx.pago.create({
        data: {
          servicioId,
          cotizacionId: cotizacion.id,
          metodoPago: "MercadoPago",
          monto: pago.transaction_amount,
          // Mercado Pago ya trae desglosada su comisión en el mismo pago
          // -- se guarda de una vez para que el ingreso real no cuente de
          // más lo que ellos se quedan (ver montoNetoEnMXN).
          comision: comisionMercadoPago(pago),
          montoIncluyeComision: true,
          confirmado: true,
          confirmadoEn: new Date(),
          comprobante: referencia,
        },
      });
      if (quedaSaldada) {
        await tx.cotizacion.update({
          where: { id: cotizacion.id },
          data: { status: "Pagada", pagoConfirmado: true, fechaPago: new Date() },
        });
      }
      return creado;
    });

    await registrarEvento("cotizacion.pago_mercadopago", "Cotizacion", cotizacion.id, {
      pagoId: nuevoPago.id,
      mercadoPagoId: paymentId,
      quedaSaldada,
    });
  } catch (e) {
    console.error("Error procesando webhook de Mercado Pago:", e);
  }

  return NextResponse.json({ ok: true });
}
