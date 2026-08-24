import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { capturarOrdenPaypal } from "@/lib/paypal";
import { registrarEvento } from "@/lib/evento";
import { cotizacionQuedaSaldada } from "@/lib/cotizacion";
import { asegurarServicioParaCotizacion } from "@/lib/cotizacion-servicio";

// PayPal redirige aquí después de que el pagador aprueba el pago, con
// ?token=<orderId>&PayerID=<...>. Capturamos la orden en el servidor (nunca
// confiamos en el estado que trae la URL) y de ahí decidimos qué mostrar.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const origin = new URL(request.url).origin;
  const url = new URL(request.url);
  const orderId = url.searchParams.get("token");
  const volver = (query: string) => NextResponse.redirect(`${origin}/cotizacion/${token}${query}`);

  if (!orderId) return volver("?pp=error");

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { token },
    include: { pagos: true },
  });
  if (!cotizacion) return new Response("Cotización no encontrada", { status: 404 });
  if (cotizacion.status === "Pagada") return volver("?pp=success");

  // En el flujo normal ya se aseguró el Servicio al iniciar el pago
  // (pagar-paypal); esto es una red de seguridad para no perder una
  // captura ya aprobada por PayPal si de algún modo llegara sin él.
  const servicioId = await asegurarServicioParaCotizacion(cotizacion.id);
  if (!servicioId) return volver("?pp=sin_cliente");

  try {
    const captura = await capturarOrdenPaypal(orderId);
    const pago = captura.purchase_units?.[0]?.payments?.captures?.[0];

    if (captura.status !== "COMPLETED" || !pago || pago.status !== "COMPLETED") {
      return volver("?pp=pending");
    }

    // Idempotencia: PayPal puede reintentar el retorno (doble clic, refresh).
    const referencia = `PP-${pago.id}`;
    const existente = await prisma.pago.findFirst({ where: { comprobante: referencia } });
    if (!existente) {
      const montoPagado = Number(pago.amount.value);
      const quedaSaldada = cotizacionQuedaSaldada(cotizacion, [
        ...cotizacion.pagos,
        { monto: montoPagado, confirmado: true },
      ]);

      const nuevoPago = await prisma.$transaction(async (tx) => {
        const creado = await tx.pago.create({
          data: {
            servicioId,
            cotizacionId: cotizacion.id,
            metodoPago: "PayPal",
            monto: montoPagado,
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

      await registrarEvento("cotizacion.pago_paypal", "Cotizacion", cotizacion.id, {
        pagoId: nuevoPago.id,
        paypalOrderId: orderId,
        quedaSaldada,
      });
    }

    return volver("?pp=success");
  } catch (e) {
    console.error("Error capturando orden de PayPal:", e);
    return volver("?pp=error");
  }
}
