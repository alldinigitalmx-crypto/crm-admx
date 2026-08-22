import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { obtenerPagoMercadoPago } from "@/lib/mercadopago";
import { registrarEvento } from "@/lib/evento";

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
    });
    if (!cotizacion || !cotizacion.servicioId) {
      return NextResponse.json({ ok: true });
    }

    // Idempotencia: si ya se registró este pago de MP o la cotización ya
    // quedó pagada, no dupliques el registro (MP reintenta notificaciones).
    const referencia = `MP-${paymentId}`;
    const existente = await prisma.pago.findFirst({ where: { comprobante: referencia } });
    if (existente || cotizacion.status === "Pagada") {
      return NextResponse.json({ ok: true });
    }

    const nuevoPago = await prisma.$transaction(async (tx) => {
      const creado = await tx.pago.create({
        data: {
          servicioId: cotizacion.servicioId!,
          cotizacionId: cotizacion.id,
          metodoPago: "MercadoPago",
          monto: pago.transaction_amount,
          confirmado: true,
          confirmadoEn: new Date(),
          comprobante: referencia,
        },
      });
      await tx.cotizacion.update({
        where: { id: cotizacion.id },
        data: { status: "Pagada", pagoConfirmado: true, fechaPago: new Date() },
      });
      return creado;
    });

    await registrarEvento("cotizacion.pago_mercadopago", "Cotizacion", cotizacion.id, {
      pagoId: nuevoPago.id,
      mercadoPagoId: paymentId,
    });
  } catch (e) {
    console.error("Error procesando webhook de Mercado Pago:", e);
  }

  return NextResponse.json({ ok: true });
}
