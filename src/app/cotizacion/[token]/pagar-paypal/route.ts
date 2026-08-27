import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { crearOrdenPaypal, paypalConfigurado } from "@/lib/paypal";
import { montoAPagarAhora } from "@/lib/cotizacion";
import { asegurarServicioParaCotizacion } from "@/lib/cotizacion-servicio";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const origin = new URL(request.url).origin;
  const volver = (query: string) => NextResponse.redirect(`${origin}/cotizacion/${token}${query}`);

  if (!paypalConfigurado()) {
    return volver("?pp=no_configurado");
  }

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { token },
    include: { servicio: true, pagos: true },
  });
  if (!cotizacion) {
    return new Response("Cotización no encontrada", { status: 404 });
  }
  if (cotizacion.status === "Pagada") {
    return volver("");
  }
  const servicioId = await asegurarServicioParaCotizacion(cotizacion.id);
  if (!servicioId) {
    return volver("?pp=sin_cliente");
  }
  // PayPal no acepta COP como moneda de cobro -- antes esto caía al else
  // de abajo y mandaba el monto en COP como si fueran pesos MXN (mismo
  // número, moneda equivocada, cobrando ~20x de más). Se bloquea en vez
  // de adivinar.
  if (cotizacion.moneda === "COP") {
    return volver("?pp=moneda");
  }

  const descripcion = cotizacion.servicio?.descripcion ?? cotizacion.descripcion ?? `Cotización #${cotizacion.id}`;
  const monto = montoAPagarAhora(cotizacion, cotizacion.pagos);
  const moneda = cotizacion.moneda === "USD" || cotizacion.moneda === "EUR" ? cotizacion.moneda : "MXN";

  try {
    const orden = await crearOrdenPaypal({
      titulo: descripcion,
      monto,
      moneda,
      externalReference: token,
      returnUrl: `${origin}/cotizacion/${token}/paypal-retorno`,
      cancelUrl: `${origin}/cotizacion/${token}?pp=cancelado`,
    });

    return NextResponse.redirect(orden.approveUrl);
  } catch (e) {
    console.error("Error creando orden de PayPal:", e);
    return volver("?pp=error");
  }
}
