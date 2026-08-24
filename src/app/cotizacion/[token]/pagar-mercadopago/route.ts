import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  crearPreferenciaMercadoPago,
  mercadoPagoConfigurado,
  mercadoPagoEsPrueba,
} from "@/lib/mercadopago";
import { esVisitanteDeMexico } from "@/lib/geo";
import { montoAPagarAhora } from "@/lib/cotizacion";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const origin = new URL(request.url).origin;
  const volver = (query: string) => NextResponse.redirect(`${origin}/cotizacion/${token}${query}`);

  if (!mercadoPagoConfigurado()) {
    return volver("?mp=no_configurado");
  }
  if (!(await esVisitanteDeMexico())) {
    return volver("?mp=pais");
  }

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { token },
    include: { servicio: true, cliente: true, pagos: true },
  });
  if (!cotizacion) {
    return new Response("Cotización no encontrada", { status: 404 });
  }
  if (cotizacion.status === "Pagada") {
    return volver("");
  }
  if (!cotizacion.servicioId) {
    return volver("?mp=sin_servicio");
  }

  const descripcion = cotizacion.servicio?.descripcion ?? cotizacion.descripcion ?? `Cotización #${cotizacion.id}`;
  const monto = montoAPagarAhora(cotizacion, cotizacion.pagos);

  try {
    const preferencia = await crearPreferenciaMercadoPago({
      titulo: descripcion,
      monto,
      externalReference: token,
      successUrl: `${origin}/cotizacion/${token}?mp=success`,
      failureUrl: `${origin}/cotizacion/${token}?mp=failure`,
      pendingUrl: `${origin}/cotizacion/${token}?mp=pending`,
      notificationUrl: `${origin}/api/webhooks/mercadopago`,
    });

    const checkoutUrl = mercadoPagoEsPrueba()
      ? preferencia.sandbox_init_point
      : preferencia.init_point;

    return NextResponse.redirect(checkoutUrl);
  } catch (e) {
    console.error("Error creando preferencia de Mercado Pago:", e);
    return volver("?mp=error");
  }
}
